import { db, invoicesTable, businessProfilesTable, hasFeature } from "@workspace/db";
import { eq } from "drizzle-orm";
import { registerAutomation } from "../lib/automation.js";
import { getQuickbooksConnection } from "../quickbooks/service.js";
import { syncInvoiceToQuickbooks } from "../quickbooks/sync.js";
import { logger } from "../lib/logger.js";

// invoice.paid → post a QuickBooks sales receipt for the paid amount.
registerAutomation("invoice.paid", async (run) => {
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, run.entityId));
  if (!invoice) throw new Error(`Invoice ${run.entityId} not found`);
  if (invoice.status !== "paid") return { skipped: "invoice no longer paid" };

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, run.userId));
  if (!profile || !hasFeature(profile, "quickbooks_sync")) return { skipped: "quickbooks_sync not on plan" };

  const connection = await getQuickbooksConnection(run.userId);
  if (!connection || !connection.isEnabled) return { skipped: "not connected" };

  const result = await syncInvoiceToQuickbooks(invoice, run.userId);
  logger.info({ invoiceId: invoice.id, qboId: result.qboId }, "Invoice synced to QuickBooks");
  return { synced: true, qboId: result.qboId };
});
