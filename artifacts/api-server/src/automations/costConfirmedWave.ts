import { db, costEntriesTable, businessProfilesTable, hasFeature } from "@workspace/db";
import { eq } from "drizzle-orm";
import { registerAutomation } from "../lib/automation.js";
import { getWaveConnection } from "../wave/service.js";
import { syncCostEntryToWave } from "../wave/sync.js";
import { logger } from "../lib/logger.js";

// cost.confirmed → post a Wave money-out transaction for the confirmed cost entry.
registerAutomation("cost.confirmed", async (run) => {
  const [entry] = await db.select().from(costEntriesTable).where(eq(costEntriesTable.id, run.entityId));
  if (!entry) throw new Error(`Cost entry ${run.entityId} not found`);
  if (entry.status !== "confirmed") return { skipped: "cost entry no longer confirmed" };

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, run.userId));
  if (!profile || !hasFeature(profile, "wave_sync")) return { skipped: "wave_sync not on plan" };

  const connection = await getWaveConnection(run.userId);
  if (!connection || !connection.isEnabled) return { skipped: "not connected" };

  const result = await syncCostEntryToWave(entry, run.userId);
  logger.info({ costEntryId: entry.id, waveId: result.waveId }, "Cost entry synced to Wave");
  return { synced: true, waveId: result.waveId };
});
