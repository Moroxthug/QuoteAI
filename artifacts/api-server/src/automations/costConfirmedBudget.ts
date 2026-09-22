import { db, costEntriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { registerAutomation } from "../lib/automation.js";
import { checkJobBudget } from "../jobs/budgetAlerts.js";

// Phase 79: cost.confirmed → compare the job's confirmed costs with its cost
// budget and raise the 90 % / 100 % margin alert when a threshold is crossed.
registerAutomation("cost.confirmed", async (run) => {
  const [entry] = await db.select({ projectId: costEntriesTable.projectId }).from(costEntriesTable).where(eq(costEntriesTable.id, run.entityId));
  if (!entry?.projectId) return { skipped: "no job" };
  const result = await checkJobBudget(entry.projectId);
  return { level: result?.level ?? 0, alerted: result?.alerted ?? null };
});
