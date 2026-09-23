import { db, invoicesTable, businessProfilesTable, hasFeature } from "@workspace/db";
import { eq } from "drizzle-orm";
import { registerAutomation } from "../lib/automation.js";
import { getQuickbooksConnection } from "../quickbooks/service.js";
import { pushInvoiceToQuickbooks, pushPaymentToQuickbooks, removePaymentFromQuickbooks, voidInvoiceInQuickbooks, type PushResult } from "../quickbooks/sync.js";

// Phase 88: QuickBooks follows the invoice through its life instead of
// receiving one SalesReceipt at the end — sent → Invoice, each payment →
// Payment, payment removed → deleted, void → voided. These replace the
// Phase 11 `invoice.paid` handler. Each push is idempotent (accounting_links),
// so the runner's retries are safe.

async function gate(userId: string): Promise<string | null> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (!profile || !hasFeature(profile, "quickbooks_sync")) return "quickbooks_sync not on plan";
  const connection = await getQuickbooksConnection(userId);
  if (!connection || !connection.isEnabled) return "not connected";
  return null;
}

const out = (r: PushResult) => ("skipped" in r ? { skipped: r.skipped } : { synced: true, qboId: r.qboId });

registerAutomation("accounting.invoice_sent", async (run) => {
  const skipped = await gate(run.userId);
  if (skipped) return { skipped };
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, run.entityId));
  if (!invoice) return { skipped: "invoice removed" };
  return out(await pushInvoiceToQuickbooks(invoice, run.userId));
});

registerAutomation("accounting.payment_recorded", async (run) => {
  const skipped = await gate(run.userId);
  if (skipped) return { skipped };
  return out(await pushPaymentToQuickbooks(run.entityId, run.userId));
});

registerAutomation("accounting.payment_removed", async (run) => {
  const skipped = await gate(run.userId);
  if (skipped) return { skipped };
  const qboPaymentId = typeof run.payload?.qboPaymentId === "string" ? run.payload.qboPaymentId : null;
  if (!qboPaymentId) return { skipped: "no QuickBooks payment" };
  return out(await removePaymentFromQuickbooks(run.entityId, qboPaymentId, run.userId));
});

registerAutomation("accounting.invoice_voided", async (run) => {
  const skipped = await gate(run.userId);
  if (skipped) return { skipped };
  return out(await voidInvoiceInQuickbooks(run.entityId, run.userId));
});
