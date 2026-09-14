import { db, quickbooksSyncLogTable, type Invoice, type CostEntry } from "@workspace/db";
import { getValidAccessToken, markSynced, getQuickbooksConnection } from "./service.js";
import {
  createSalesReceipt,
  createExpense,
  getOrCreateRevenueItem,
  getOrCreateCustomer,
} from "../lib/quickbooksClient.js";

// v1 scope: each synced invoice/cost lands as ONE line in QuickBooks (the
// invoice/expense total, tax-inclusive) rather than a full line-by-line +
// tax-code breakdown — QBO's Canadian tax-code setup differs per company and
// is out of scope for a one-way "get it into your books" sync (see
// docs/GROWTH-PLATFORM-PLAN.md Phase 11). A company can re-categorize the
// line in QuickBooks afterwards if they want more detail.

async function logSync(params: {
  userId: string;
  entityType: "invoice" | "cost_entry";
  entityId: string;
  status: "synced" | "failed";
  qboId?: string;
  qboType?: string;
  error?: string;
}): Promise<void> {
  await db.insert(quickbooksSyncLogTable).values({
    userId: params.userId,
    entityType: params.entityType,
    entityId: params.entityId,
    status: params.status,
    qboId: params.qboId ?? null,
    qboType: params.qboType ?? null,
    error: params.error?.slice(0, 2000) ?? null,
  });
}

export async function syncInvoiceToQuickbooks(invoice: Invoice, userId: string): Promise<{ qboId: string }> {
  try {
    const token = await getValidAccessToken(userId);
    if (!token) throw new Error("QuickBooks not connected or token refresh failed");

    const customer = await getOrCreateCustomer(token.realmId, token.accessToken, invoice.customer.name);
    const item = await getOrCreateRevenueItem(token.realmId, token.accessToken);

    const amount = invoice.totalCents / 100;
    const receipt = await createSalesReceipt(token.realmId, token.accessToken, {
      CustomerRef: { value: customer.Id },
      TxnDate: (invoice.paidAt ?? new Date()).toISOString().slice(0, 10),
      DocNumber: invoice.number.slice(0, 21),
      PrivateNote: `Synced from QuoteAI — invoice ${invoice.number}`,
      Line: [
        {
          Amount: amount,
          DetailType: "SalesItemLineDetail",
          Description: invoice.title || `Invoice ${invoice.number}`,
          SalesItemLineDetail: { ItemRef: { value: item.Id }, Qty: 1, UnitPrice: amount },
        },
      ],
    });

    await logSync({ userId, entityType: "invoice", entityId: invoice.id, status: "synced", qboId: receipt.Id, qboType: "SalesReceipt" });
    await markSynced(userId);
    return { qboId: receipt.Id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logSync({ userId, entityType: "invoice", entityId: invoice.id, status: "failed", error: message });
    throw err;
  }
}

export async function syncCostEntryToQuickbooks(entry: CostEntry, userId: string): Promise<{ qboId: string }> {
  try {
    const connection = await getQuickbooksConnection(userId);
    if (!connection) throw new Error("QuickBooks not connected");
    if (!connection.paymentAccount) throw new Error("No QuickBooks payment account set — pick one in Settings → Integrations");
    const accountRef = connection.categoryMap[entry.category];
    if (!accountRef) throw new Error(`No QuickBooks expense account mapped for category "${entry.category}" — set it in Settings → Integrations`);

    const token = await getValidAccessToken(userId);
    if (!token) throw new Error("QuickBooks not connected or token refresh failed");

    const amount = entry.totalCents / 100;
    const expense = await createExpense(token.realmId, token.accessToken, {
      PaymentType: "Cash",
      AccountRef: { value: connection.paymentAccount.id },
      TxnDate: entry.date.toISOString().slice(0, 10),
      PrivateNote: `Synced from QuoteAI — ${entry.vendor || entry.description || "cost entry"}`,
      Line: [
        {
          Amount: amount,
          DetailType: "AccountBasedExpenseLineDetail",
          Description: entry.description || entry.vendor || entry.category,
          AccountBasedExpenseLineDetail: { AccountRef: { value: accountRef.id } },
        },
      ],
    });

    await logSync({ userId, entityType: "cost_entry", entityId: entry.id, status: "synced", qboId: expense.Id, qboType: "Purchase" });
    await markSynced(userId);
    return { qboId: expense.Id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logSync({ userId, entityType: "cost_entry", entityId: entry.id, status: "failed", error: message });
    throw err;
  }
}
