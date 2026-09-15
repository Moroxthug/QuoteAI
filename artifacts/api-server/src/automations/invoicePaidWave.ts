import { db, invoicesTable, businessProfilesTable, hasFeature } from "@workspace/db";
import { eq } from "drizzle-orm";
import { registerAutomation } from "../lib/automation.js";
import { getWaveConnection } from "../wave/service.js";
import { syncInvoiceToWave } from "../wave/sync.js";
import { logger } from "../lib/logger.js";

// invoice.paid → post a Wave money-in transaction for the paid amount.
registerAutomation("invoice.paid", async (run) => {
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, run.entityId));
  if (!invoice) throw new Error(`Invoice ${run.entityId} not found`);
  if (invoice.status !== "paid") return { skipped: "invoice no longer paid" };

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, run.userId));
  if (!profile || !hasFeature(profile, "wave_sync")) return { skipped: "wave_sync not on plan" };

  const connection = await getWaveConnection(run.userId);
  if (!connection || !connection.isEnabled) return { skipped: "not connected" };

  const result = await syncInvoiceToWave(invoice, run.userId);
  logger.info({ invoiceId: invoice.id, waveId: result.waveId }, "Invoice synced to Wave");
  return { synced: true, waveId: result.waveId };
});
