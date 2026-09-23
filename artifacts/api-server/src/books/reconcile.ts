import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, notInArray, or, sql } from "drizzle-orm";
import {
  db,
  flinksTransactionsTable,
  costEntriesTable,
  invoicePaymentsTable,
  invoicesTable,
  projectsTable,
  OPEN_INVOICE_STATUSES,
  COST_CATEGORIES,
  type FlinksTransaction,
} from "@workspace/db";
import { recordPayment } from "../invoices/service.js";
import { writeAudit } from "../lib/notifications.js";

// ── Phase 88: bank line ↔ cost entry ↔ invoice payment ───────────────────────
// Phase 27 matched a bank debit to *a* cost entry with the same total — the
// first one found, even one another bank line already claimed, and never a
// deposit. Now a line is either money out (a cost entry: a receipt, a
// supplier bill, a crew's materials claim) or money in (a payment recorded on
// an invoice), each thing matches at most one line, and the auto-matcher only
// acts when there is exactly one candidate — two $54.21 receipts in the same
// week are a person's call, not a coin toss.

const DAY = 86_400_000;
/** The auto-matcher's window: receipts are entered a day or two off the charge date. */
const AUTO_WINDOW_DAYS = 4;
/** The manual candidate list looks wider — a cheque can take weeks to clear. */
const CANDIDATE_WINDOW_DAYS = 45;

export class ReconcileError extends Error {
  constructor(readonly code: "NOT_FOUND" | "WRONG_DIRECTION" | "ALREADY_MATCHED" | "OVER_BALANCE" | "INVALID", message: string) {
    super(message);
  }
}

/** Cost entries already matched to some bank line (optionally: other than this one). */
function costTaken(exceptTxId?: string) {
  return sql`exists (select 1 from ${flinksTransactionsTable} ft where ft.matched_cost_entry_id = ${costEntriesTable.id}${exceptTxId ? sql` and ft.id <> ${exceptTxId}` : sql``})`;
}
function paymentTaken(exceptTxId?: string) {
  return sql`exists (select 1 from ${flinksTransactionsTable} ft where ft.matched_invoice_payment_id = ${invoicePaymentsTable.id}${exceptTxId ? sql` and ft.id <> ${exceptTxId}` : sql``})`;
}

/**
 * Called by the Flinks sync for each new line: matches it only when exactly
 * one unclaimed thing has the same amount within a few days.
 */
export async function autoMatchLine(userId: string, tx: Pick<FlinksTransaction, "amountCents" | "date">): Promise<{ matchedCostEntryId: string | null; matchedInvoicePaymentId: string | null }> {
  const from = new Date(tx.date.getTime() - AUTO_WINDOW_DAYS * DAY);
  const to = new Date(tx.date.getTime() + AUTO_WINDOW_DAYS * DAY);
  if (tx.amountCents < 0) {
    const rows = await db
      .select({ id: costEntriesTable.id })
      .from(costEntriesTable)
      .where(and(eq(costEntriesTable.userId, userId), eq(costEntriesTable.totalCents, -tx.amountCents), gte(costEntriesTable.date, from), lte(costEntriesTable.date, to), sql`not ${costTaken()}`))
      .limit(2);
    return { matchedCostEntryId: rows.length === 1 ? rows[0]!.id : null, matchedInvoicePaymentId: null };
  }
  if (tx.amountCents > 0) {
    const rows = await db
      .select({ id: invoicePaymentsTable.id })
      .from(invoicePaymentsTable)
      .where(and(eq(invoicePaymentsTable.userId, userId), eq(invoicePaymentsTable.amountCents, tx.amountCents), ne(invoicePaymentsTable.method, "credit_note"), gte(invoicePaymentsTable.date, from), lte(invoicePaymentsTable.date, to), sql`not ${paymentTaken()}`))
      .limit(2);
    return { matchedCostEntryId: null, matchedInvoicePaymentId: rows.length === 1 ? rows[0]!.id : null };
  }
  return { matchedCostEntryId: null, matchedInvoicePaymentId: null };
}

type BankMatchDto =
  | { kind: "cost"; id: string; label: string; date: string; amountCents: number; status: string; projectId: string | null; projectName: string | null }
  | { kind: "payment"; id: string; invoiceId: string; invoiceNumber: string; customer: string; date: string; amountCents: number; method: string };

export type BankLineDto = {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  status: "unmatched" | "matched" | "ignored";
  autoMatched: boolean;
  match: BankMatchDto | null;
};

async function hydrate(userId: string, rows: FlinksTransaction[]): Promise<BankLineDto[]> {
  const costIds = rows.map((r) => r.matchedCostEntryId).filter((x): x is string => !!x);
  const paymentIds = rows.map((r) => r.matchedInvoicePaymentId).filter((x): x is string => !!x);
  const costs = costIds.length
    ? await db
        .select({ id: costEntriesTable.id, vendor: costEntriesTable.vendor, description: costEntriesTable.description, date: costEntriesTable.date, totalCents: costEntriesTable.totalCents, status: costEntriesTable.status, projectId: costEntriesTable.projectId, projectName: projectsTable.name })
        .from(costEntriesTable)
        .leftJoin(projectsTable, eq(projectsTable.id, costEntriesTable.projectId))
        .where(and(eq(costEntriesTable.userId, userId), inArray(costEntriesTable.id, costIds)))
    : [];
  const payments = paymentIds.length
    ? await db
        .select({ id: invoicePaymentsTable.id, invoiceId: invoicePaymentsTable.invoiceId, date: invoicePaymentsTable.date, amountCents: invoicePaymentsTable.amountCents, method: invoicePaymentsTable.method, number: invoicesTable.number, customer: invoicesTable.customer })
        .from(invoicePaymentsTable)
        .innerJoin(invoicesTable, eq(invoicesTable.id, invoicePaymentsTable.invoiceId))
        .where(and(eq(invoicePaymentsTable.userId, userId), inArray(invoicePaymentsTable.id, paymentIds)))
    : [];
  const costById = new Map(costs.map((c) => [c.id, c]));
  const payById = new Map(payments.map((p) => [p.id, p]));
  return rows.map((r) => {
    let match: BankMatchDto | null = null;
    const c = r.matchedCostEntryId ? costById.get(r.matchedCostEntryId) : undefined;
    const p = r.matchedInvoicePaymentId ? payById.get(r.matchedInvoicePaymentId) : undefined;
    if (c) match = { kind: "cost", id: c.id, label: c.vendor || c.description || "", date: c.date.toISOString(), amountCents: c.totalCents, status: c.status, projectId: c.projectId, projectName: c.projectName ?? null };
    else if (p) match = { kind: "payment", id: p.id, invoiceId: p.invoiceId, invoiceNumber: p.number, customer: p.customer?.name ?? "", date: p.date.toISOString(), amountCents: p.amountCents, method: p.method };
    // A match whose target was deleted (FK set null) reads as unmatched, which is what it now is.
    const status = r.matchStatus === "matched" && !match ? "unmatched" : r.matchStatus;
    return { id: r.id, date: r.date.toISOString(), description: r.description, amountCents: r.amountCents, status, autoMatched: r.autoMatched, match };
  });
}

export async function listBankLines(userId: string, opts: { status?: "unmatched" | "matched" | "ignored" | "all"; from?: Date; to?: Date; limit?: number } = {}): Promise<BankLineDto[]> {
  const conds = [eq(flinksTransactionsTable.userId, userId)];
  if (opts.from) conds.push(gte(flinksTransactionsTable.date, opts.from));
  if (opts.to) conds.push(lte(flinksTransactionsTable.date, opts.to));
  // Filter in SQL so an old unmatched line is not pushed past the limit by recent matched ones.
  // A "matched" line whose cost/payment was deleted (FK set null) is unmatched in fact.
  const orphan = and(eq(flinksTransactionsTable.matchStatus, "matched"), isNull(flinksTransactionsTable.matchedCostEntryId), isNull(flinksTransactionsTable.matchedInvoicePaymentId));
  if (opts.status === "unmatched") conds.push(or(eq(flinksTransactionsTable.matchStatus, "unmatched"), orphan)!);
  else if (opts.status === "matched") conds.push(eq(flinksTransactionsTable.matchStatus, "matched"));
  else if (opts.status === "ignored") conds.push(eq(flinksTransactionsTable.matchStatus, "ignored"));
  const rows = await db
    .select()
    .from(flinksTransactionsTable)
    .where(and(...conds))
    .orderBy(desc(flinksTransactionsTable.date))
    .limit(opts.limit ?? 300);
  const lines = await hydrate(userId, rows);
  return !opts.status || opts.status === "all" ? lines : lines.filter((l) => l.status === opts.status);
}

async function lineFor(userId: string, txId: string): Promise<FlinksTransaction> {
  const [tx] = await db.select().from(flinksTransactionsTable).where(and(eq(flinksTransactionsTable.id, txId), eq(flinksTransactionsTable.userId, userId)));
  if (!tx) throw new ReconcileError("NOT_FOUND", "Bank line not found");
  return tx;
}

/** Nearest in date first; same-day beats a week off. */
const byDistance = <T extends { date: Date }>(date: Date) => (a: T, b: T) => Math.abs(a.date.getTime() - date.getTime()) - Math.abs(b.date.getTime() - date.getTime());

export async function candidatesFor(userId: string, txId: string) {
  const tx = await lineFor(userId, txId);
  const from = new Date(tx.date.getTime() - CANDIDATE_WINDOW_DAYS * DAY);
  const to = new Date(tx.date.getTime() + CANDIDATE_WINDOW_DAYS * DAY);
  if (tx.amountCents < 0) {
    const costs = await db
      .select({ id: costEntriesTable.id, vendor: costEntriesTable.vendor, description: costEntriesTable.description, date: costEntriesTable.date, totalCents: costEntriesTable.totalCents, status: costEntriesTable.status, source: costEntriesTable.source, projectName: projectsTable.name })
      .from(costEntriesTable)
      .leftJoin(projectsTable, eq(projectsTable.id, costEntriesTable.projectId))
      .where(and(eq(costEntriesTable.userId, userId), eq(costEntriesTable.totalCents, -tx.amountCents), gte(costEntriesTable.date, from), lte(costEntriesTable.date, to), sql`not ${costTaken(tx.id)}`))
      .limit(20);
    return {
      direction: "out" as const,
      costs: costs.sort(byDistance(tx.date)).map((c) => ({ ...c, date: c.date.toISOString(), projectName: c.projectName ?? null })),
      payments: [],
      invoices: [],
    };
  }
  const payments = await db
    .select({ id: invoicePaymentsTable.id, invoiceId: invoicePaymentsTable.invoiceId, date: invoicePaymentsTable.date, amountCents: invoicePaymentsTable.amountCents, method: invoicePaymentsTable.method, number: invoicesTable.number, customer: invoicesTable.customer })
    .from(invoicePaymentsTable)
    .innerJoin(invoicesTable, eq(invoicesTable.id, invoicePaymentsTable.invoiceId))
    .where(and(eq(invoicePaymentsTable.userId, userId), eq(invoicePaymentsTable.amountCents, tx.amountCents), ne(invoicePaymentsTable.method, "credit_note"), gte(invoicePaymentsTable.date, from), lte(invoicePaymentsTable.date, to), sql`not ${paymentTaken(tx.id)}`))
    .limit(20);
  // A deposit nobody recorded yet: open invoices this amount would settle or reduce.
  const invoices = await db
    .select({ id: invoicesTable.id, number: invoicesTable.number, customer: invoicesTable.customer, totalCents: invoicesTable.totalCents, paidCents: invoicesTable.paidCents, dueDate: invoicesTable.dueDate, status: invoicesTable.status })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.userId, userId), inArray(invoicesTable.status, [...OPEN_INVOICE_STATUSES]), ne(invoicesTable.type, "credit_note"), sql`${invoicesTable.totalCents} - ${invoicesTable.paidCents} >= ${tx.amountCents}`))
    .orderBy(desc(invoicesTable.issueDate))
    .limit(50);
  const exact = invoices.filter((i) => i.totalCents - i.paidCents === tx.amountCents);
  const partial = invoices.filter((i) => i.totalCents - i.paidCents !== tx.amountCents);
  return {
    direction: "in" as const,
    costs: [],
    payments: payments.sort(byDistance(tx.date)).map((p) => ({ id: p.id, invoiceId: p.invoiceId, invoiceNumber: p.number, customer: p.customer?.name ?? "", date: p.date.toISOString(), amountCents: p.amountCents, method: p.method })),
    invoices: [...exact, ...partial].slice(0, 15).map((i) => ({ id: i.id, number: i.number, customer: i.customer?.name ?? "", balanceCents: i.totalCents - i.paidCents, dueDate: i.dueDate.toISOString(), status: i.status, exact: i.totalCents - i.paidCents === tx.amountCents })),
  };
}

async function setMatch(userId: string, txId: string, patch: { matchedCostEntryId?: string | null; matchedInvoicePaymentId?: string | null; matchStatus: "matched" | "unmatched" | "ignored" }, actor: { id: string | null; ip?: string | null }) {
  await db
    .update(flinksTransactionsTable)
    .set({ matchedCostEntryId: patch.matchedCostEntryId ?? null, matchedInvoicePaymentId: patch.matchedInvoicePaymentId ?? null, matchStatus: patch.matchStatus, autoMatched: false })
    .where(and(eq(flinksTransactionsTable.id, txId), eq(flinksTransactionsTable.userId, userId)));
  await writeAudit({ userId, actorType: "user", actorId: actor.id, entityType: "bank_line", entityId: txId, action: patch.matchStatus === "matched" ? "matched" : patch.matchStatus, diff: { costEntryId: patch.matchedCostEntryId ?? null, invoicePaymentId: patch.matchedInvoicePaymentId ?? null }, ip: actor.ip ?? null });
}

export async function matchCost(userId: string, txId: string, costEntryId: string, actor: { id: string | null; ip?: string | null }): Promise<void> {
  const tx = await lineFor(userId, txId);
  if (tx.amountCents >= 0) throw new ReconcileError("WRONG_DIRECTION", "Money in matches a payment, not a cost");
  const [cost] = await db.select({ id: costEntriesTable.id }).from(costEntriesTable).where(and(eq(costEntriesTable.id, costEntryId), eq(costEntriesTable.userId, userId)));
  if (!cost) throw new ReconcileError("NOT_FOUND", "Cost entry not found");
  const [other] = await db.select({ id: flinksTransactionsTable.id }).from(flinksTransactionsTable).where(and(eq(flinksTransactionsTable.matchedCostEntryId, costEntryId), ne(flinksTransactionsTable.id, txId)));
  if (other) throw new ReconcileError("ALREADY_MATCHED", "That cost is already matched to another bank line");
  await setMatch(userId, txId, { matchedCostEntryId: costEntryId, matchStatus: "matched" }, actor);
}

export async function matchPayment(userId: string, txId: string, paymentId: string, actor: { id: string | null; ip?: string | null }): Promise<void> {
  const tx = await lineFor(userId, txId);
  if (tx.amountCents <= 0) throw new ReconcileError("WRONG_DIRECTION", "Money out matches a cost, not a payment");
  const [payment] = await db.select({ id: invoicePaymentsTable.id }).from(invoicePaymentsTable).where(and(eq(invoicePaymentsTable.id, paymentId), eq(invoicePaymentsTable.userId, userId)));
  if (!payment) throw new ReconcileError("NOT_FOUND", "Payment not found");
  const [other] = await db.select({ id: flinksTransactionsTable.id }).from(flinksTransactionsTable).where(and(eq(flinksTransactionsTable.matchedInvoicePaymentId, paymentId), ne(flinksTransactionsTable.id, txId)));
  if (other) throw new ReconcileError("ALREADY_MATCHED", "That payment is already matched to another bank line");
  await setMatch(userId, txId, { matchedInvoicePaymentId: paymentId, matchStatus: "matched" }, actor);
}

/** A deposit for an invoice nobody marked paid yet: records the payment (dated the deposit day) and matches it, in one click. */
export async function recordPaymentFromLine(userId: string, txId: string, invoiceId: string, actor: { id: string | null; ip?: string | null }): Promise<{ paymentId: string }> {
  const tx = await lineFor(userId, txId);
  if (tx.amountCents <= 0) throw new ReconcileError("WRONG_DIRECTION", "Only money in can pay an invoice");
  if (tx.matchStatus === "matched") throw new ReconcileError("ALREADY_MATCHED", "This bank line is already matched");
  const [inv] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.userId, userId)));
  if (!inv) throw new ReconcileError("NOT_FOUND", "Invoice not found");
  if (!OPEN_INVOICE_STATUSES.includes(inv.status)) throw new ReconcileError("INVALID", "That invoice is not open");
  if (tx.amountCents > inv.totalCents - inv.paidCents) throw new ReconcileError("OVER_BALANCE", "The deposit is more than what is owing on that invoice");
  const { payment } = await recordPayment({
    invoiceId,
    userId,
    amountCents: tx.amountCents,
    method: "bank_transfer",
    date: tx.date,
    reference: tx.description.slice(0, 120),
    note: "Recorded from the bank feed",
    sendReceipt: false,
    ip: actor.ip ?? null,
  });
  await setMatch(userId, txId, { matchedInvoicePaymentId: payment.id, matchStatus: "matched" }, actor);
  return { paymentId: payment.id };
}

/** Money out with no receipt yet (a card charge at the supplier): a pending cost to review, matched to the line. */
export async function costFromLine(userId: string, txId: string, input: { category: (typeof COST_CATEGORIES)[number]; projectId: string | null }, actor: { id: string | null; ip?: string | null }): Promise<{ costEntryId: string }> {
  const tx = await lineFor(userId, txId);
  if (tx.amountCents >= 0) throw new ReconcileError("WRONG_DIRECTION", "Only money out can be a cost");
  if (tx.matchStatus === "matched") throw new ReconcileError("ALREADY_MATCHED", "This bank line is already matched");
  if (input.projectId) {
    const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.id, input.projectId), eq(projectsTable.userId, userId)));
    if (!project) throw new ReconcileError("NOT_FOUND", "Job not found");
  }
  // Pending review, tax unknown: the bank does not say how much of it was GST. The receipt, when it comes, is merged into it.
  const [cost] = await db
    .insert(costEntriesTable)
    .values({
      userId,
      projectId: input.projectId,
      category: input.category,
      vendor: tx.description.slice(0, 200),
      description: tx.description.slice(0, 500),
      date: tx.date,
      subtotalCents: -tx.amountCents,
      totalCents: -tx.amountCents,
      status: "pending_review",
      source: "bank_feed",
      createdBy: "user",
    })
    .returning({ id: costEntriesTable.id });
  await setMatch(userId, txId, { matchedCostEntryId: cost!.id, matchStatus: "matched" }, actor);
  return { costEntryId: cost!.id };
}

export async function unmatchLine(userId: string, txId: string, actor: { id: string | null; ip?: string | null }): Promise<void> {
  await lineFor(userId, txId);
  await setMatch(userId, txId, { matchStatus: "unmatched" }, actor);
}

export async function ignoreLine(userId: string, txId: string, actor: { id: string | null; ip?: string | null }): Promise<void> {
  await lineFor(userId, txId);
  await setMatch(userId, txId, { matchStatus: "ignored" }, actor);
}

/** For the T5018 and the close: the day each cost entry actually left the bank, when a line was matched to it. */
export async function bankDatesForCosts(userId: string, costIds: string[]): Promise<Map<string, Date>> {
  if (costIds.length === 0) return new Map();
  const rows = await db
    .select({ costId: flinksTransactionsTable.matchedCostEntryId, date: flinksTransactionsTable.date })
    .from(flinksTransactionsTable)
    .where(and(eq(flinksTransactionsTable.userId, userId), isNotNull(flinksTransactionsTable.matchedCostEntryId), inArray(flinksTransactionsTable.matchedCostEntryId, costIds), notInArray(flinksTransactionsTable.matchStatus, ["ignored"])));
  return new Map(rows.map((r) => [r.costId!, r.date]));
}
