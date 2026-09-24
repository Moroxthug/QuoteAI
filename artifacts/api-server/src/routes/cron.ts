import { Router } from "express";
import { retryDueAutomations } from "../lib/automation";
import { runContractMaintenance } from "../contracts/maintenance.js";
import { runInvoiceMaintenance } from "../invoices/maintenance.js";
import { runLeadMaintenance } from "../leads/maintenance.js";
import { runJobReviewRequestMaintenance } from "../jobs/maintenance.js";
import { runQuoteFollowupMaintenance } from "../quotes/maintenance.js";
import { rollUpUsageForDate } from "../lib/usage.js";
import { runIncentivesFreshnessCheck } from "../incentives/maintenance.js";
import { runPriceIntelligenceTrendCheck } from "../priceIntelligence/maintenance.js";
import { runFlinksSyncCheck } from "../flinks/maintenance.js";
import { runGoogleLsaPollCheck } from "../googleLsa/maintenance.js";
import { runAccountDeletionMaintenance, expireAccountExports } from "../account/service.js";
import { runScheduleReminderMaintenance } from "../schedule/maintenance.js";
import { runBudgetAlertSweep } from "../jobs/budgetAlerts.js";
import { syncInboundForAllCompanies, pruneExternalEvents } from "../calendar/inbound.js";
import { runComplianceReminders } from "../compliance/service.js";
import { runQuickbooksPaymentPull } from "../quickbooks/maintenance.js";
import { db, cronTicksTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import { automationBacklog, pingHeartbeat, recentAutomationFailures, sendOpsAlert } from "../lib/ops.js";
import { captureException, flush } from "../lib/errorTracking.js";
import { cronAuthorized } from "../lib/cronAuth.js";

const router = Router();

// GET /api/cron/tick — invoked by Vercel Cron (see vercel.json), once a day.
router.get("/cron/tick", async (req, res) => {
  if (!cronAuthorized(req, res)) return;

  const startedAt = Date.now();
  // Phase 69: record the tick so /api/healthz/ops can tell a silent scheduler
  // from a healthy one. Never let bookkeeping stop the tick itself.
  const [tick] = await db.insert(cronTicksTable).values({}).returning({ id: cronTicksTable.id }).catch((err: unknown) => {
    req.log.error({ err }, "Could not record cron tick");
    return [] as { id: string }[];
  });
  try {
    const automations = await retryDueAutomations();
    const contracts = await runContractMaintenance();
    const invoices = await runInvoiceMaintenance();
    const leads = await runLeadMaintenance();
    const reviewRequests = await runJobReviewRequestMaintenance();
    const incentives = await runIncentivesFreshnessCheck();
    const priceTrends = await runPriceIntelligenceTrendCheck();
    const quoteFollowups = await runQuoteFollowupMaintenance();
    const flinksSync = await runFlinksSyncCheck();
    const googleLsaPoll = await runGoogleLsaPollCheck();
    // Phase 72: purge accounts whose grace period ended, drop 7-year-old tombstones, expire old export ZIPs.
    const accountDeletions = await runAccountDeletionMaintenance();
    const accountExports = await expireAccountExports();
    // Phase 75: same-day catch-up for crew reminders (the evening-before pass is /cron/evening).
    const scheduleReminders = await runScheduleReminderMaintenance();
    // Phase 79: jobs whose confirmed costs crossed 90 % / 100 % of budget since the live checks (budget edits, deletions).
    const budgetAlerts = await runBudgetAlertSweep();
    // Phase 85: pull connected calendars and subscribed .ics feeds into the
    // local mirror the dashboard widget reads, and drop what has aged out.
    const calendarInbound = await syncInboundForAllCompanies();
    const calendarPruned = await pruneExternalEvents();
    // Phase 87: filing deadlines and the company's own reminders, ahead of the day they are due.
    const compliance = await runComplianceReminders();
    // Phase 88: payments recorded in QuickBooks come back as invoice payments.
    const quickbooksPull = await runQuickbooksPaymentPull();
    // Roll up yesterday's (and today's, in case cron shifted) usage_events into the daily summary.
    const usage = await rollUpUsageForDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    await rollUpUsageForDate(new Date());
    const result = { automations, contracts, invoices, leads, reviewRequests, incentives, priceTrends, quoteFollowups, flinksSync, googleLsaPoll, accountDeletions, accountExports, scheduleReminders, budgetAlerts, calendarInbound, calendarPruned, compliance, quickbooksPull, usage };
    const tookMs = Date.now() - startedAt;
    if (tick) await db.update(cronTicksTable).set({ finishedAt: new Date(), ok: true, result, tookMs }).where(eq(cronTicksTable.id, tick.id));
    await db.delete(cronTicksTable).where(lt(cronTicksTable.startedAt, new Date(Date.now() - 90 * 24 * 3_600_000)));

    // Anything the retry loop could not fix since the last tick is the
    // operator's problem now: dead runs never retry, and a failed run whose
    // next attempt is already due means the backoff outlived the schedule.
    const backlog = await automationBacklog();
    if (backlog.dead > 0 || backlog.failed > 0) {
      const rows = await recentAutomationFailures(new Date(Date.now() - 25 * 3_600_000));
      await sendOpsAlert(
        `${backlog.dead} dead / ${backlog.failed} failed automation run(s)`,
        [
          `Cron tick finished OK in ${tookMs} ms but the automation queue has ${backlog.dead} dead and ${backlog.failed} overdue-failed run(s).`,
          "",
          ...rows.map((r) => `- [${r.status}] ${r.event} ${r.entityType}/${r.entityId} user=${r.userId} attempts=${r.attempts} — ${(r.lastError ?? "").slice(0, 300)}`),
          rows.length === 0 ? "(older than 25 h — see the admin automations table)" : "",
          "",
          "Retry: POST /api/admin/automations/:id/retry (see docs/RUNBOOKS.md → Cron / automation failures).",
        ],
      );
    }
    await pingHeartbeat();
    await flush(1500);
    res.json({ ok: true, ...result, backlog, tookMs });
  } catch (err) {
    req.log.error({ err }, "Cron tick failed");
    const message = err instanceof Error ? err.message : String(err);
    if (tick) await db.update(cronTicksTable).set({ finishedAt: new Date(), ok: false, error: message.slice(0, 2000), tookMs: Date.now() - startedAt }).where(eq(cronTicksTable.id, tick.id)).catch(() => undefined);
    await captureException(err, { mechanism: "cron", handled: false, level: "fatal", tags: { route: "GET /api/cron/tick" } });
    await sendOpsAlert("Cron tick failed", [`/api/cron/tick threw after ${Date.now() - startedAt} ms:`, message, "", "Nothing scheduled ran after the failing step; the next tick retries everything. See docs/RUNBOOKS.md → Cron / automation failures."]);
    await flush(1500);
    res.status(500).json({ ok: false });
  }
});

// GET /api/cron/evening — the second daily cron (23:00 UTC = 19:00 Toronto /
// 16:00 Vancouver / 20:30 St. John's): texts (or emails) every worker their
// blocks for tomorrow (Phase 75). Deliberately tiny — nothing else belongs
// in the evening slot — and it does not touch cron_ticks, which watches the
// main tick's heartbeat.
router.get("/cron/evening", async (req, res) => {
  if (!cronAuthorized(req, res)) return;
  const startedAt = Date.now();
  try {
    const scheduleReminders = await runScheduleReminderMaintenance();
    res.json({ ok: true, scheduleReminders, tookMs: Date.now() - startedAt });
  } catch (err) {
    req.log.error({ err }, "Evening cron failed");
    await captureException(err, { mechanism: "cron", handled: false, level: "error", tags: { route: "GET /api/cron/evening" } });
    await sendOpsAlert("Evening cron failed", [`/api/cron/evening threw after ${Date.now() - startedAt} ms:`, err instanceof Error ? err.message : String(err), "", "Crew reminders for tomorrow were not sent; the morning tick sends a same-day catch-up."]);
    await flush(1500);
    res.status(500).json({ ok: false });
  }
});

export default router;
