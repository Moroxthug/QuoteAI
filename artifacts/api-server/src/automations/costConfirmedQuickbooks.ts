import { db, costEntriesTable, businessProfilesTable, hasFeature } from "@workspace/db";
import { eq } from "drizzle-orm";
import { registerAutomation } from "../lib/automation.js";
import { getQuickbooksConnection } from "../quickbooks/service.js";
import { syncCostEntryToQuickbooks } from "../quickbooks/sync.js";
import { logger } from "../lib/logger.js";

// cost.confirmed → post a QuickBooks expense for the confirmed cost entry.
registerAutomation("cost.confirmed", async (run) => {
  const [entry] = await db.select().from(costEntriesTable).where(eq(costEntriesTable.id, run.entityId));
  if (!entry) throw new Error(`Cost entry ${run.entityId} not found`);
  if (entry.status !== "confirmed") return { skipped: "cost entry no longer confirmed" };

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, run.userId));
  if (!profile || !hasFeature(profile, "quickbooks_sync")) return { skipped: "quickbooks_sync not on plan" };

  const connection = await getQuickbooksConnection(run.userId);
  if (!connection || !connection.isEnabled) return { skipped: "not connected" };

  const result = await syncCostEntryToQuickbooks(entry, run.userId);
  logger.info({ costEntryId: entry.id, qboId: result.qboId }, "Cost entry synced to QuickBooks");
  return { synced: true, qboId: result.qboId };
});
