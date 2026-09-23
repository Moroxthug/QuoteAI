import { db, waveSyncLogTable, type Invoice, type CostEntry } from "@workspace/db";
import { getValidAccessToken, markSynced, getWaveConnection } from "./service.js";
import { createMoneyTransaction, getOrCreateCustomer } from "../lib/waveClient.js";
import { getLink, putLink } from "../books/links.js";
import { nameKey } from "../books/keys.js";

// v1 scope: each synced invoice/cost lands as ONE money transaction in Wave
// (the invoice/expense total, tax-inclusive) rather than a full line-by-line
// + tax-code breakdown — same simplification as the QuickBooks sync (Phase
// 11), for the same reason: a company's Wave tax-code setup differs per
// company and detailed tax mapping is out of scope for a one-way "get it
// into your books" sync. A company can re-categorize the line in Wave
// afterwards if they want more detail.

async function logSync(params: {
  userId: string;
  entityType: "invoice" | "cost_entry";
  entityId: string;
  status: "synced" | "failed";
  waveId?: string;
  waveType?: string;
  error?: string;
}): Promise<void> {
  await db.insert(waveSyncLogTable).values({
    userId: params.userId,
    entityType: params.entityType,
    entityId: params.entityId,
    status: params.status,
    waveId: params.waveId ?? null,
    waveType: params.waveType ?? null,
    error: params.error?.slice(0, 2000) ?? null,
  });
}

export async function syncInvoiceToWave(invoice: Invoice, userId: string): Promise<{ waveId: string }> {
  try {
    const connection = await getWaveConnection(userId);
    if (!connection) throw new Error("Wave not connected");
    if (!connection.paymentAccount) throw new Error("No Wave deposit account set — pick one in Settings → Integrations");
    if (!connection.incomeAccount) throw new Error("No Wave income account set — pick one in Settings → Integrations");

    const token = await getValidAccessToken(userId);
    if (!token) throw new Error("Wave not connected or token refresh failed");

    // Phase 88: the Wave customer is remembered per client, so a renamed or re-typed customer is not created twice.
    const linkType = invoice.clientId ? "client" : "customer_name";
    const linkId = invoice.clientId ?? nameKey(invoice.customer.name || "customer");
    const link = await getLink(userId, "wave", linkType, linkId);
    const customer = link ? { id: link.externalId } : await getOrCreateCustomer(token.accessToken, token.businessId, invoice.customer.name);
    if (!link) await putLink({ userId, provider: "wave", entityType: linkType, entityId: linkId, externalId: customer.id, externalType: "Customer" });

    const amount = (invoice.totalCents / 100).toFixed(2);
    const transaction = await createMoneyTransaction(token.accessToken, token.businessId, {
      externalId: `quoteai-invoice-${invoice.id}`,
      date: (invoice.paidAt ?? new Date()).toISOString().slice(0, 10),
      description: `${invoice.title || `Invoice ${invoice.number}`} — synced from QuoteAI`,
      anchorAccountId: connection.paymentAccount.id,
      anchorAmount: amount,
      anchorDirection: "DEPOSIT",
      lineAccountId: connection.incomeAccount.id,
      lineAmount: amount,
      lineBalance: "INCREASE",
      customerId: customer.id,
    });

    await logSync({ userId, entityType: "invoice", entityId: invoice.id, status: "synced", waveId: transaction.id, waveType: "MoneyTransaction" });
    await markSynced(userId);
    return { waveId: transaction.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logSync({ userId, entityType: "invoice", entityId: invoice.id, status: "failed", error: message });
    throw err;
  }
}

export async function syncCostEntryToWave(entry: CostEntry, userId: string): Promise<{ waveId: string }> {
  try {
    const connection = await getWaveConnection(userId);
    if (!connection) throw new Error("Wave not connected");
    if (!connection.paymentAccount) throw new Error("No Wave payment account set — pick one in Settings → Integrations");
    const accountRef = connection.categoryMap[entry.category];
    if (!accountRef) throw new Error(`No Wave expense account mapped for category "${entry.category}" — set it in Settings → Integrations`);

    const token = await getValidAccessToken(userId);
    if (!token) throw new Error("Wave not connected or token refresh failed");

    const amount = (entry.totalCents / 100).toFixed(2);
    const transaction = await createMoneyTransaction(token.accessToken, token.businessId, {
      externalId: `quoteai-cost-${entry.id}`,
      date: entry.date.toISOString().slice(0, 10),
      description: `${entry.description || entry.vendor || entry.category} — synced from QuoteAI`,
      anchorAccountId: connection.paymentAccount.id,
      anchorAmount: amount,
      anchorDirection: "WITHDRAWAL",
      lineAccountId: accountRef.id,
      lineAmount: amount,
      lineBalance: "INCREASE",
    });

    await logSync({ userId, entityType: "cost_entry", entityId: entry.id, status: "synced", waveId: transaction.id, waveType: "MoneyTransaction" });
    await markSynced(userId);
    return { waveId: transaction.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logSync({ userId, entityType: "cost_entry", entityId: entry.id, status: "failed", error: message });
    throw err;
  }
}
