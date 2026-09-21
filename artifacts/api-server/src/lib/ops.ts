// Phase 69: operational health + alerting shared by the cron tick and
// /api/healthz/ops. Everything here is best-effort and never throws.

import { db, automationRunsTable, cronTicksTable } from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Resend } from "resend";
import { logger } from "./logger";
import { captureMessage } from "./errorTracking";

/**
 * How long without a successful tick before the scheduler counts as stale.
 * vercel.json runs the tick daily (Hobby plans allow no more), so the default
 * is 24 h + 1 h grace. Set CRON_STALE_AFTER_HOURS=2 when the schedule moves
 * to hourly.
 */
export function cronStaleAfterMs(): number {
  const hours = Number(process.env.CRON_STALE_AFTER_HOURS ?? "25");
  return (Number.isFinite(hours) && hours > 0 ? hours : 25) * 3_600_000;
}

export type OpsHealth = {
  status: "ok" | "degraded";
  checkedAt: string;
  cron: { lastOkAt: string | null; lastStartedAt: string | null; staleAfterHours: number; stale: boolean; lastError: string | null };
  automations: { failed: number; dead: number };
  problems: string[];
};

/** Automation runs that will never run again (dead) or are waiting on a retry that is already overdue (failed). */
export async function automationBacklog(): Promise<{ failed: number; dead: number }> {
  const since = new Date(Date.now() - 7 * 24 * 3_600_000);
  const [row] = await db
    .select({
      failed: sql<number>`count(*) filter (where ${automationRunsTable.status} = 'failed' and ${automationRunsTable.nextAttemptAt} <= now())`,
      dead: sql<number>`count(*) filter (where ${automationRunsTable.status} = 'dead' and ${automationRunsTable.finishedAt} >= ${since})`,
    })
    .from(automationRunsTable)
    .where(and(gte(automationRunsTable.updatedAt, since), sql`${automationRunsTable.status} in ('failed', 'dead')`));
  return { failed: Number(row?.failed ?? 0), dead: Number(row?.dead ?? 0) };
}

export async function opsHealth(): Promise<OpsHealth> {
  const staleAfter = cronStaleAfterMs();
  const [lastOk] = await db.select({ finishedAt: cronTicksTable.finishedAt }).from(cronTicksTable).where(eq(cronTicksTable.ok, true)).orderBy(desc(cronTicksTable.startedAt)).limit(1);
  const [last] = await db.select({ startedAt: cronTicksTable.startedAt, ok: cronTicksTable.ok, error: cronTicksTable.error }).from(cronTicksTable).orderBy(desc(cronTicksTable.startedAt)).limit(1);
  const automations = await automationBacklog();

  const lastOkAt = lastOk?.finishedAt ?? null;
  const stale = !lastOkAt || Date.now() - lastOkAt.getTime() > staleAfter;
  const problems: string[] = [];
  if (stale) problems.push(lastOkAt ? `no successful cron tick since ${lastOkAt.toISOString()}` : "no successful cron tick recorded");
  if (last && last.ok === false) problems.push(`last cron tick failed: ${last.error ?? "unknown error"}`);
  if (automations.dead > 0) problems.push(`${automations.dead} automation run(s) dead in the last 7 days`);
  if (automations.failed > 0) problems.push(`${automations.failed} automation run(s) failed with an overdue retry`);

  return {
    status: problems.length ? "degraded" : "ok",
    checkedAt: new Date().toISOString(),
    cron: {
      lastOkAt: lastOkAt?.toISOString() ?? null,
      lastStartedAt: last?.startedAt.toISOString() ?? null,
      staleAfterHours: staleAfter / 3_600_000,
      stale,
      lastError: last?.ok === false ? (last.error ?? null) : null,
    },
    automations,
    problems,
  };
}

/** Failed/dead runs since `since`, for the alert email body. */
export async function recentAutomationFailures(since: Date, limit = 20) {
  return db
    .select({
      id: automationRunsTable.id,
      event: automationRunsTable.event,
      status: automationRunsTable.status,
      attempts: automationRunsTable.attempts,
      lastError: automationRunsTable.lastError,
      userId: automationRunsTable.userId,
      entityType: automationRunsTable.entityType,
      entityId: automationRunsTable.entityId,
      updatedAt: automationRunsTable.updatedAt,
    })
    .from(automationRunsTable)
    .where(and(sql`${automationRunsTable.status} in ('failed', 'dead')`, gte(automationRunsTable.updatedAt, since)))
    .orderBy(desc(automationRunsTable.updatedAt))
    .limit(limit);
}

/**
 * Emails the operator (OPS_ALERT_EMAIL, falling back to ADMIN_EMAIL) and
 * records the same text as a warning in error tracking, so a Sentry alert
 * rule can page on it too. Silent when neither channel is configured.
 */
export async function sendOpsAlert(subject: string, lines: string[]): Promise<void> {
  const to = process.env.OPS_ALERT_EMAIL || process.env.ADMIN_EMAIL;
  const text = lines.join("\n");
  logger.warn({ subject, lines }, "Ops alert");
  await captureMessage(`${subject}\n${text}`, { level: "warning", logger: "ops", tags: { ops_alert: subject.slice(0, 60) } });
  const apiKey = process.env.RESEND_API_KEY;
  if (!to || !apiKey) {
    logger.warn("Ops alert not emailed — OPS_ALERT_EMAIL/ADMIN_EMAIL or RESEND_API_KEY missing");
    return;
  }
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "QuoteAI Ops <no-reply@quoteai.ca>",
      to: to.split(",").map((a) => a.trim()).filter(Boolean),
      subject: `[QuoteAI ops] ${subject}`,
      text: `${text}\n\nRunbooks: docs/RUNBOOKS.md`,
    });
  } catch (err) {
    logger.error({ err }, "Failed to send ops alert email");
  }
}

/** Dead-man switch: GET the heartbeat URL (Healthchecks.io, Better Stack, Cronitor…) after a successful tick. */
export async function pingHeartbeat(): Promise<void> {
  const url = process.env.CRON_HEARTBEAT_URL;
  if (!url) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timer);
  } catch (err) {
    logger.warn({ err }, "Cron heartbeat ping failed");
  }
}
