import { db, quickbooksConnectionsTable, businessProfilesTable, hasFeature } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { pullQuickbooksPayments } from "./sync.js";
import { logger } from "../lib/logger.js";

/**
 * Daily cron hook (Phase 88): brings back payments recorded in QuickBooks
 * for every enabled connection that has the pull switched on. `onlyUserIds`
 * scopes a run to named companies — tests share one database.
 */
export async function runQuickbooksPaymentPull(onlyUserIds?: string[]): Promise<{ connections: number; recorded: number; conflicts: number; failed: number }> {
  if (onlyUserIds && onlyUserIds.length === 0) return { connections: 0, recorded: 0, conflicts: 0, failed: 0 };
  const where = and(
    eq(quickbooksConnectionsTable.isEnabled, true),
    eq(quickbooksConnectionsTable.pullPayments, true),
    onlyUserIds ? inArray(quickbooksConnectionsTable.userId, onlyUserIds) : undefined,
  );
  const connections = await db.select().from(quickbooksConnectionsTable).where(where);
  let recorded = 0;
  let conflicts = 0;
  let failed = 0;
  for (const conn of connections) {
    try {
      const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, conn.userId));
      if (!hasFeature(profile, "quickbooks_sync")) continue;
      const r = await pullQuickbooksPayments(conn.userId, conn);
      recorded += r.recorded;
      conflicts += r.conflicts;
    } catch (err) {
      failed++;
      logger.error({ err, userId: conn.userId }, "QuickBooks payment pull failed for connection");
    }
  }
  return { connections: connections.length, recorded, conflicts, failed };
}
