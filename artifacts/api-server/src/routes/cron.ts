import { Router } from "express";
import { retryDueAutomations } from "../lib/automation";
import { runContractMaintenance } from "../contracts/maintenance.js";
import { runInvoiceMaintenance } from "../invoices/maintenance.js";
import { runLeadMaintenance } from "../leads/maintenance.js";
import { runJobReviewRequestMaintenance } from "../jobs/maintenance.js";
import { rollUpUsageForDate } from "../lib/usage.js";
import { runIncentivesFreshnessCheck } from "../incentives/maintenance.js";

const router = Router();

// GET /api/cron/tick — invoked by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer $CRON_SECRET`; we accept the same header from any
// caller so it can be triggered manually with curl.
router.get("/cron/tick", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: "CRON_SECRET not configured" });
    return;
  }
  const header = req.headers.authorization ?? "";
  if (header !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const startedAt = Date.now();
  try {
    const automations = await retryDueAutomations();
    const contracts = await runContractMaintenance();
    const invoices = await runInvoiceMaintenance();
    const leads = await runLeadMaintenance();
    const reviewRequests = await runJobReviewRequestMaintenance();
    const incentives = await runIncentivesFreshnessCheck();
    // Roll up yesterday's (and today's, in case cron shifted) usage_events into the daily summary.
    const usage = await rollUpUsageForDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    await rollUpUsageForDate(new Date());
    res.json({ ok: true, automations, contracts, invoices, leads, reviewRequests, incentives, usage, tookMs: Date.now() - startedAt });
  } catch (err) {
    req.log.error({ err }, "Cron tick failed");
    res.status(500).json({ ok: false });
  }
});

export default router;
