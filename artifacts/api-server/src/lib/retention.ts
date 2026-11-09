import { and, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db, auditLogTable, automationRunsTable, emailEventsTable, notificationsTable, webhookDeliveriesTable } from "@workspace/db";
import { withAuditMaintenance } from "./auditLog.js";
import { purgeExpiredRateLimits } from "./rateLimitStore.js";
import { logger } from "./logger.js";

/**
 * Retention schedule for operational data (audit B12). The privacy policy
 * says technical logs are kept 90 days; this is what makes it true.
 *
 * Business records are NOT here: quotes, contracts, invoices, payments, jobs,
 * clients and conversations are the customer's data and live until the
 * customer deletes them or the account (contracts and invoices then follow
 * the 7-year CRA rule in account/service.ts). The audit trail of contracts
 * and invoices is kept with them for the same reason.
 *
 * Keep docs/SECURITY-AUDIT-2026-11.md (B12) in step with this table.
 */
const DAY = 24 * 3_600_000;
export const RETENTION = {
  /** Resend delivery/bounce events, with recipient addresses. */
  emailEventsDays: 90,
  /** Outgoing webhook delivery attempts. */
  webhookDeliveriesDays: 90,
  /** Finished automation runs (succeeded or dead). Failed/pending stay for retry. */
  automationRunsDays: 90,
  /** In-app notifications, read or not. */
  notificationsDays: 180,
  /** Crew schedule change history (drives "what changed" for workers). */
  scheduleAuditDays: 365,
  /** Sign-ins, two-step, sessions, admin actions. */
  securityAuditDays: 730,
} as const;

const before = (days: number) => new Date(Date.now() - days * DAY);

export async function runRetentionPurges(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const step = async (name: string, fn: () => Promise<number>) => {
    try {
      out[name] = await fn();
    } catch (err) {
      out[name] = -1;
      logger.error({ err, step: name }, "Retention purge step failed");
    }
  };

  await step("emailEvents", async () => (await db.delete(emailEventsTable).where(lt(emailEventsTable.createdAt, before(RETENTION.emailEventsDays)))).rowCount ?? 0);
  await step("webhookDeliveries", async () => (await db.delete(webhookDeliveriesTable).where(lt(webhookDeliveriesTable.createdAt, before(RETENTION.webhookDeliveriesDays)))).rowCount ?? 0);
  await step("automationRuns", async () =>
    (
      await db
        .delete(automationRunsTable)
        .where(and(inArray(automationRunsTable.status, ["succeeded", "dead"]), isNotNull(automationRunsTable.finishedAt), lt(automationRunsTable.finishedAt, before(RETENTION.automationRunsDays))))
    ).rowCount ?? 0,
  );
  await step("notifications", async () => (await db.delete(notificationsTable).where(lt(notificationsTable.createdAt, before(RETENTION.notificationsDays)))).rowCount ?? 0);
  await step("auditLog", () =>
    withAuditMaintenance(async (tx) => {
      const schedule = await tx.delete(auditLogTable).where(and(sql`${auditLogTable.entityType} = 'schedule_block'`, lt(auditLogTable.createdAt, before(RETENTION.scheduleAuditDays))));
      const security = await tx
        .delete(auditLogTable)
        .where(and(inArray(auditLogTable.entityType, ["security", "platform_admin"]), lt(auditLogTable.createdAt, before(RETENTION.securityAuditDays))));
      return (schedule.rowCount ?? 0) + (security.rowCount ?? 0);
    }),
  );
  await step("rateLimits", purgeExpiredRateLimits);
  return out;
}
