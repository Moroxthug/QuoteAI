import { and, asc, eq } from "drizzle-orm";
import {
  db,
  quickbooksSyncLogTable,
  invoicesTable,
  invoicePaymentsTable,
  suppliersTable,
  OPEN_INVOICE_STATUSES,
  type Invoice,
  type CostEntry,
  type QuickbooksConnection,
  type QuickbooksSyncEntityType,
} from "@workspace/db";
import { getValidAccessToken, markSynced, getQuickbooksConnection, updateQuickbooksConnection } from "./service.js";
import {
  createExpense,
  createInvoice,
  createPayment,
  deletePayment,
  findInvoiceByDocNumber,
  findOrCreateParty,
  getInvoice,
  getOrCreateRevenueItem,
  listPaymentsSince,
  voidInvoice,
  type QbPayment,
} from "../lib/quickbooksClient.js";
import { deleteLink, findByExternal, getLink, putLink } from "../books/links.js";
import { nameKey, taxSetKey } from "../books/keys.js";
import { recordPayment } from "../invoices/service.js";
import { logger } from "../lib/logger.js";

// ── QuickBooks Online, both directions (Phase 11 → Phase 88) ─────────────────
// Phase 11 posted a paid invoice as one SalesReceipt, so QuickBooks never
// knew an invoice was owed and a payment taken in QuickBooks never reached
// QuoteAI. Now:
//  * a sent invoice becomes a QBO Invoice (accounts receivable), once;
//  * each payment recorded in QuoteAI becomes a QBO Payment applied to it;
//  * a payment recorded in QuickBooks against one of those invoices comes
//    back as an invoice payment (pullQuickbooksPayments, daily and on demand);
//  * a void in QuoteAI voids the QBO invoice.
// accounting_links remembers every pair, so nothing is created twice and
// nothing travels back to where it came from.
//
// Invoices still go over as ONE line (the invoice title). With the invoice's
// tax set mapped to a QBO tax code the line is pre-tax and QuickBooks computes
// the tax; unmapped, it is the tax-included total, as before (a Canadian
// company's tax codes differ per company, which is why the mapping exists).

type Token = { accessToken: string; realmId: string };

async function logSync(params: {
  userId: string;
  entityType: QuickbooksSyncEntityType;
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

async function tokenFor(userId: string): Promise<Token> {
  const token = await getValidAccessToken(userId);
  if (!token) throw new Error("QuickBooks not connected or token refresh failed");
  return token;
}

const dollars = (cents: number) => Math.round(cents) / 100;
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Invoices sent before Phase 88 went over as a SalesReceipt once paid; they are already in the books. */
async function hasLegacyReceipt(userId: string, invoiceId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: quickbooksSyncLogTable.id })
    .from(quickbooksSyncLogTable)
    .where(and(eq(quickbooksSyncLogTable.userId, userId), eq(quickbooksSyncLogTable.entityId, invoiceId), eq(quickbooksSyncLogTable.status, "synced"), eq(quickbooksSyncLogTable.qboType, "SalesReceipt")));
  return !!row;
}

async function customerFor(userId: string, token: Token, invoice: Invoice): Promise<string> {
  const entityType = invoice.clientId ? "client" : "customer_name";
  const entityId = invoice.clientId ?? nameKey(invoice.customer.name || "customer");
  const link = await getLink(userId, "quickbooks", entityType, entityId);
  if (link) return link.externalId;
  const found = await findOrCreateParty(token.realmId, token.accessToken, "Customer", { name: invoice.customer.name, email: invoice.customer.email, suffix: invoice.number });
  await putLink({ userId, provider: "quickbooks", entityType, entityId, externalId: found.id, externalType: "Customer" });
  return found.id;
}

async function vendorFor(userId: string, token: Token, entry: CostEntry): Promise<string | null> {
  let name = entry.vendor.trim();
  if (entry.supplierId) {
    const [supplier] = await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, entry.supplierId));
    name = supplier?.name?.trim() || name;
  }
  if (!name) return null;
  const entityType = entry.supplierId ? "supplier" : "vendor_name";
  const entityId = entry.supplierId ?? nameKey(name);
  if (!entityId) return null;
  const link = await getLink(userId, "quickbooks", entityType, entityId);
  if (link) return link.externalId;
  const found = await findOrCreateParty(token.realmId, token.accessToken, "Vendor", { name });
  await putLink({ userId, provider: "quickbooks", entityType, entityId, externalId: found.id, externalType: "Vendor" });
  return found.id;
}

export type PushResult = { qboId: string; created: boolean } | { skipped: string };

/** Sends an invoice to QuickBooks as an Invoice (accounts receivable). Idempotent: linked → nothing; same DocNumber already there → adopted. */
export async function pushInvoiceToQuickbooks(invoice: Invoice, userId: string): Promise<PushResult> {
  if (invoice.type === "credit_note") return { skipped: "credit notes are not sent to QuickBooks" };
  if (invoice.status === "draft") return { skipped: "draft" };
  const link = await getLink(userId, "quickbooks", "invoice", invoice.id);
  if (link) return { qboId: link.externalId, created: false };
  if (await hasLegacyReceipt(userId, invoice.id)) return { skipped: "already in QuickBooks as a sales receipt" };

  try {
    const connection = await getQuickbooksConnection(userId);
    if (!connection) throw new Error("QuickBooks not connected");
    const token = await tokenFor(userId);
    const docNumber = invoice.number.slice(0, 21);

    // A retry after "created in QBO, then crashed before the link was written" must not create a twin.
    const existing = await findInvoiceByDocNumber(token.realmId, token.accessToken, docNumber);
    if (existing) {
      await putLink({ userId, provider: "quickbooks", entityType: "invoice", entityId: invoice.id, externalId: existing.Id, externalType: "Invoice" });
      await logSync({ userId, entityType: "invoice", entityId: invoice.id, status: "synced", qboId: existing.Id, qboType: "Invoice", error: "Already in QuickBooks with the same number — linked, not created again" });
      return { qboId: existing.Id, created: false };
    }

    const customerId = await customerFor(userId, token, invoice);
    const item = await getOrCreateRevenueItem(token.realmId, token.accessToken, connection.incomeAccount);
    const taxCode = connection.taxCodeMap[taxSetKey(invoice.taxLines)];
    const amount = dollars(taxCode ? invoice.taxableCents : invoice.totalCents);
    const created = await createInvoice(token.realmId, token.accessToken, {
      CustomerRef: { value: customerId },
      DocNumber: docNumber,
      TxnDate: day(invoice.issueDate),
      DueDate: day(invoice.dueDate),
      PrivateNote: `Sent from QuoteAI — invoice ${invoice.number}`,
      GlobalTaxCalculation: taxCode ? "TaxExcluded" : "NotApplicable",
      ...((invoice.customer.email ?? "").includes("@") ? { BillEmail: { Address: invoice.customer.email } } : {}),
      Line: [
        {
          Amount: amount,
          DetailType: "SalesItemLineDetail",
          Description: (invoice.title || `Invoice ${invoice.number}`).slice(0, 4000),
          SalesItemLineDetail: { ItemRef: { value: item.Id }, Qty: 1, UnitPrice: amount, ...(taxCode ? { TaxCodeRef: { value: taxCode.id } } : {}) },
        },
      ],
    });
    await putLink({ userId, provider: "quickbooks", entityType: "invoice", entityId: invoice.id, externalId: created.Id, externalType: "Invoice" });
    // QuickBooks computes tax itself on a mapped invoice; a cent of rounding is normal, more means the tax code does not match.
    const drift = Math.round(created.TotalAmt * 100) - invoice.totalCents;
    const note = Math.abs(drift) > 1
      ? `QuickBooks totals this invoice at $${created.TotalAmt.toFixed(2)}; QuoteAI has $${(invoice.totalCents / 100).toFixed(2)}. Check the tax code mapped for "${taxSetKey(invoice.taxLines)}".`
      : undefined;
    await logSync({ userId, entityType: "invoice", entityId: invoice.id, status: "synced", qboId: created.Id, qboType: "Invoice", error: note });
    await markSynced(userId);
    return { qboId: created.Id, created: true };
  } catch (err) {
    await logSync({ userId, entityType: "invoice", entityId: invoice.id, status: "failed", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/** Sends one payment recorded in QuoteAI to QuickBooks, applied to its invoice (created there first when needed). */
export async function pushPaymentToQuickbooks(paymentId: string, userId: string): Promise<PushResult> {
  const [payment] = await db.select().from(invoicePaymentsTable).where(and(eq(invoicePaymentsTable.id, paymentId), eq(invoicePaymentsTable.userId, userId)));
  if (!payment) return { skipped: "payment removed" };
  if (payment.method === "credit_note" || payment.creditNoteId) return { skipped: "credit note applied, not a payment" };
  const link = await getLink(userId, "quickbooks", "invoice_payment", payment.id);
  if (link) return { qboId: link.externalId, created: false };

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, payment.invoiceId));
  if (!invoice) return { skipped: "invoice removed" };
  const pushed = await pushInvoiceToQuickbooks(invoice, userId);
  if ("skipped" in pushed) return pushed;

  try {
    const connection = await getQuickbooksConnection(userId);
    const token = await tokenFor(userId);
    const customerId = await customerFor(userId, token, invoice);
    const amount = dollars(payment.amountCents);
    const created = await createPayment(token.realmId, token.accessToken, {
      CustomerRef: { value: customerId },
      TotalAmt: amount,
      TxnDate: day(payment.date),
      ...(payment.reference ? { PaymentRefNum: payment.reference.slice(0, 21) } : {}),
      PrivateNote: `Recorded in QuoteAI — ${payment.method} on ${invoice.number}`,
      ...(connection?.depositAccount ? { DepositToAccountRef: { value: connection.depositAccount.id } } : {}),
      Line: [{ Amount: amount, LinkedTxn: [{ TxnId: pushed.qboId, TxnType: "Invoice" }] }],
    });
    await putLink({ userId, provider: "quickbooks", entityType: "invoice_payment", entityId: payment.id, externalId: created.Id, externalType: "Payment" });
    await logSync({ userId, entityType: "invoice_payment", entityId: payment.id, status: "synced", qboId: created.Id, qboType: "Payment" });
    await markSynced(userId);
    return { qboId: created.Id, created: true };
  } catch (err) {
    await logSync({ userId, entityType: "invoice_payment", entityId: payment.id, status: "failed", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/** A payment removed in QuoteAI (a mistake, a bounced cheque) is deleted from QuickBooks too. */
export async function removePaymentFromQuickbooks(paymentId: string, qboPaymentId: string, userId: string): Promise<PushResult> {
  try {
    const token = await tokenFor(userId);
    await deletePayment(token.realmId, token.accessToken, qboPaymentId);
    await deleteLink(userId, "quickbooks", "invoice_payment", paymentId);
    await logSync({ userId, entityType: "invoice_payment", entityId: paymentId, status: "synced", qboId: qboPaymentId, qboType: "PaymentDelete" });
    return { qboId: qboPaymentId, created: false };
  } catch (err) {
    await logSync({ userId, entityType: "invoice_payment", entityId: paymentId, status: "failed", qboId: qboPaymentId, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/** A void in QuoteAI voids the linked QBO invoice. Nothing linked → nothing to do. */
export async function voidInvoiceInQuickbooks(invoiceId: string, userId: string): Promise<PushResult> {
  const link = await getLink(userId, "quickbooks", "invoice", invoiceId);
  if (!link) return { skipped: "not in QuickBooks" };
  try {
    const token = await tokenFor(userId);
    const current = await getInvoice(token.realmId, token.accessToken, link.externalId);
    await voidInvoice(token.realmId, token.accessToken, current);
    await logSync({ userId, entityType: "invoice", entityId: invoiceId, status: "synced", qboId: link.externalId, qboType: "InvoiceVoid" });
    return { qboId: link.externalId, created: false };
  } catch (err) {
    await logSync({ userId, entityType: "invoice", entityId: invoiceId, status: "failed", qboId: link.externalId, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * Invoices that were already out when QuickBooks was connected: sends each
 * open one and the payments already on it, so a payment later recorded in
 * QuickBooks has an invoice to land on. Bounded; run it again for more.
 */
export async function backfillOpenInvoices(userId: string, limit = 50): Promise<{ invoices: number; payments: number; failed: number }> {
  const open = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.userId, userId))
    .orderBy(asc(invoicesTable.issueDate));
  let invoices = 0;
  let payments = 0;
  let failed = 0;
  for (const inv of open.filter((i) => OPEN_INVOICE_STATUSES.includes(i.status) && i.type !== "credit_note")) {
    if (invoices >= limit) break;
    try {
      const r = await pushInvoiceToQuickbooks(inv, userId);
      if ("skipped" in r) continue;
      if (r.created) invoices++;
      const paid = await db.select({ id: invoicePaymentsTable.id }).from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, inv.id));
      for (const p of paid) {
        const pr = await pushPaymentToQuickbooks(p.id, userId);
        if ("created" in pr && pr.created) payments++;
      }
    } catch (err) {
      failed++;
      logger.warn({ err, invoiceId: inv.id }, "QuickBooks backfill: invoice failed (logged)");
    }
  }
  return { invoices, payments, failed };
}

export async function syncCostEntryToQuickbooks(entry: CostEntry, userId: string): Promise<{ qboId: string }> {
  try {
    const connection = await getQuickbooksConnection(userId);
    if (!connection) throw new Error("QuickBooks not connected");
    if (!connection.paymentAccount) throw new Error("No QuickBooks payment account set — pick one in Settings → Integrations");
    const accountRef = connection.categoryMap[entry.category];
    if (!accountRef) throw new Error(`No QuickBooks expense account mapped for category "${entry.category}" — set it in Settings → Integrations`);

    const token = await tokenFor(userId);
    const vendorId = await vendorFor(userId, token, entry);

    const amount = dollars(entry.totalCents);
    const expense = await createExpense(token.realmId, token.accessToken, {
      PaymentType: "Cash",
      AccountRef: { value: connection.paymentAccount.id },
      TxnDate: day(entry.date),
      ...(vendorId ? { EntityRef: { value: vendorId, type: "Vendor" } } : {}),
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
    await logSync({ userId, entityType: "cost_entry", entityId: entry.id, status: "failed", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// ── Pull: payments recorded in QuickBooks ────────────────────────────────────

export type PullResult = { read: number; recorded: number; conflicts: number; skipped: number };

const PAGE = 200;
const MAX_PAGES = 5;

/**
 * Reads QBO payments changed since the cursor and records the ones applied to
 * a QuoteAI invoice. Never guesses:
 *  - a payment we pushed, or already pulled, is skipped (accounting_links);
 *  - a payment on an invoice QuoteAI did not send is not ours;
 *  - more than the QuoteAI balance (someone recorded it on both sides), a
 *    void or a draft is logged as a conflict for a person, never recorded.
 * Edits and deletions of a payment already pulled are not followed.
 */
export async function pullQuickbooksPayments(userId: string, connection?: QuickbooksConnection | null): Promise<PullResult> {
  const conn = connection ?? (await getQuickbooksConnection(userId));
  const result: PullResult = { read: 0, recorded: 0, conflicts: 0, skipped: 0 };
  if (!conn || !conn.isEnabled || !conn.pullPayments) return result;
  const token = await tokenFor(userId);
  let cursor = conn.paymentsCursor ?? conn.connectedAt;

  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await listPaymentsSince(token.realmId, token.accessToken, cursor, PAGE);
    for (const p of batch) {
      result.read++;
      await pullOne(userId, p, result);
      const updated = p.MetaData?.LastUpdatedTime ? new Date(p.MetaData.LastUpdatedTime) : null;
      if (updated && !Number.isNaN(updated.getTime()) && updated > cursor) cursor = updated;
    }
    await updateQuickbooksConnection(userId, { paymentsCursor: cursor });
    if (batch.length < PAGE) break;
  }
  await updateQuickbooksConnection(userId, { paymentsPulledAt: new Date() });
  return result;
}

async function pullOne(userId: string, p: QbPayment, result: PullResult): Promise<void> {
  if (await findByExternal(userId, "quickbooks", "Payment", p.Id)) {
    result.skipped++;
    return;
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.TxnDate) ? new Date(`${p.TxnDate}T12:00:00Z`) : new Date();
  for (const line of p.Line ?? []) {
    for (const txn of line.LinkedTxn ?? []) {
      if (txn.TxnType !== "Invoice") continue;
      const externalId = `${p.Id}:${txn.TxnId}`;
      if (await findByExternal(userId, "quickbooks", "PaymentLine", externalId)) {
        result.skipped++;
        continue;
      }
      const invLink = await findByExternal(userId, "quickbooks", "Invoice", txn.TxnId);
      if (!invLink) {
        result.skipped++;
        continue;
      }
      const [invoice] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invLink.entityId), eq(invoicesTable.userId, userId)));
      const amountCents = Math.round(line.Amount * 100);
      const conflict = async (why: string) => {
        result.conflicts++;
        await logSync({ userId, entityType: "payment_pull", entityId: invLink.entityId, status: "failed", qboId: p.Id, qboType: "Payment", error: why });
      };
      if (!invoice) {
        await conflict(`QuickBooks payment ${p.Id} is applied to an invoice that no longer exists in QuoteAI — not recorded.`);
        continue;
      }
      const balance = invoice.totalCents - invoice.paidCents;
      if (invoice.status === "void" || invoice.status === "draft") {
        await conflict(`QuickBooks payment ${p.Id} ($${(amountCents / 100).toFixed(2)}) is applied to ${invoice.number}, which is ${invoice.status} in QuoteAI — not recorded.`);
        continue;
      }
      if (amountCents <= 0 || amountCents > balance) {
        await conflict(
          `QuickBooks payment ${p.Id} of $${(amountCents / 100).toFixed(2)} on ${invoice.number} is more than the $${(Math.max(0, balance) / 100).toFixed(2)} still owing in QuoteAI — probably recorded in both places. Not recorded; check both sides.`,
        );
        continue;
      }
      await recordPayment({
        invoiceId: invoice.id,
        userId,
        amountCents,
        method: "other",
        date,
        reference: `QuickBooks ${p.PaymentRefNum ? p.PaymentRefNum : `#${p.Id}`}`.slice(0, 120),
        note: "Recorded in QuickBooks",
        sendReceipt: false,
        external: { provider: "quickbooks", externalType: "PaymentLine", externalId },
      });
      result.recorded++;
    }
  }
}
