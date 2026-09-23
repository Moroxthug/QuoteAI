import { and, eq, gte, inArray, lte, ne, notInArray } from "drizzle-orm";
import {
  db,
  booksClosesTable,
  costEntriesTable,
  flinksConnectionsTable,
  flinksTransactionsTable,
  invoicePaymentsTable,
  invoicesTable,
  projectsTable,
  quickbooksConnectionsTable,
  quickbooksSyncLogTable,
  timeEntriesTable,
  waveConnectionsTable,
  waveSyncLogTable,
  type BooksClose,
  type BooksCloseSnapshot,
} from "@workspace/db";
import { dayOf } from "../compliance/remittance.js";
import { linksFor } from "./links.js";
import { claimsInRange } from "./claims.js";

// ── Phase 88: the month-end close ────────────────────────────────────────────
// Not a ledger close (the books live in QuickBooks/Wave or with the
// accountant). It is the list of things in QuoteAI that are not finished for
// the month — every one a count, an amount and a link to where it is fixed —
// so "the books are done for August" is something a person can check, and a
// month marked closed says when something new turned up in it afterwards.

export type CheckKey = "bank_unmatched" | "payments_unbanked" | "costs_pending" | "claims_open" | "tax_unsplit" | "invoices_draft" | "time_unapproved" | "not_in_books";

export type CheckRow = { id: string; label: string; date: string; cents: number; href: string };
export type CheckItem = { key: CheckKey; applies: boolean; count: number; cents: number; href: string; rows: CheckRow[] };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonth = (s: string) => MONTH.test(s);

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  // Pad a day each side in SQL and settle the company's local day in JS (same as the tax worksheet).
  return { first, last, from: new Date(Date.UTC(y, m - 1, 0)), to: new Date(Date.UTC(y, m, 1, 23, 59, 59)) };
}

const costHref = (projectId: string | null) => (projectId ? `/dashboard/jobs/${projectId}?tab=costs` : "/dashboard/documents");
const MAX_ROWS = 25;

export async function monthChecklist(userId: string, province: string | null, month: string) {
  const { first, last, from, to } = monthBounds(month);
  const inMonth = (d: Date) => {
    const day = dayOf(d, province);
    return day >= first && day <= last;
  };
  const item = (key: CheckKey, applies: boolean, href: string, rows: CheckRow[]): CheckItem => ({
    key,
    applies,
    href,
    count: rows.length,
    cents: rows.reduce((s, r) => s + Math.abs(r.cents), 0),
    rows: rows.slice(0, MAX_ROWS),
  });

  const [flinks] = await db.select({ userId: flinksConnectionsTable.userId }).from(flinksConnectionsTable).where(eq(flinksConnectionsTable.userId, userId));
  const [qbo] = await db.select().from(quickbooksConnectionsTable).where(eq(quickbooksConnectionsTable.userId, userId));
  const [wave] = await db.select().from(waveConnectionsTable).where(eq(waveConnectionsTable.userId, userId));
  const books = qbo?.isEnabled ? { provider: "quickbooks" as const, since: qbo.connectedAt } : wave?.isEnabled ? { provider: "wave" as const, since: wave.connectedAt } : null;

  // Bank lines
  const lines = flinks
    ? (await db.select().from(flinksTransactionsTable).where(and(eq(flinksTransactionsTable.userId, userId), gte(flinksTransactionsTable.date, from), lte(flinksTransactionsTable.date, to)))).filter((l) => inMonth(l.date))
    : [];
  const bankUnmatched = lines
    .filter((l) => l.matchStatus === "unmatched" || (l.matchStatus === "matched" && !l.matchedCostEntryId && !l.matchedInvoicePaymentId))
    .map((l) => ({ id: l.id, label: l.description, date: l.date.toISOString(), cents: l.amountCents, href: "/dashboard/books?tab=bank" }));

  // Payments
  const payments = (
    await db
      .select({ id: invoicePaymentsTable.id, invoiceId: invoicePaymentsTable.invoiceId, date: invoicePaymentsTable.date, amountCents: invoicePaymentsTable.amountCents, method: invoicePaymentsTable.method, number: invoicesTable.number })
      .from(invoicePaymentsTable)
      .innerJoin(invoicesTable, eq(invoicesTable.id, invoicePaymentsTable.invoiceId))
      .where(and(eq(invoicePaymentsTable.userId, userId), ne(invoicePaymentsTable.method, "credit_note"), gte(invoicePaymentsTable.date, from), lte(invoicePaymentsTable.date, to)))
  ).filter((p) => inMonth(p.date));
  const bankedPaymentIds = new Set(
    payments.length
      ? (await db.select({ id: flinksTransactionsTable.matchedInvoicePaymentId }).from(flinksTransactionsTable).where(and(eq(flinksTransactionsTable.userId, userId), inArray(flinksTransactionsTable.matchedInvoicePaymentId, payments.map((p) => p.id))))).map((r) => r.id)
      : [],
  );
  // Cash never reaches the bank feed; everything else should.
  const paymentsUnbanked = flinks
    ? payments.filter((p) => p.method !== "cash" && !bankedPaymentIds.has(p.id)).map((p) => ({ id: p.id, label: p.number, date: p.date.toISOString(), cents: p.amountCents, href: `/dashboard/invoices/${p.invoiceId}` }))
    : [];

  // Costs
  const costs = (
    await db
      .select({ id: costEntriesTable.id, date: costEntriesTable.date, vendor: costEntriesTable.vendor, description: costEntriesTable.description, totalCents: costEntriesTable.totalCents, taxCents: costEntriesTable.taxCents, taxBreakdown: costEntriesTable.taxBreakdown, status: costEntriesTable.status, projectId: costEntriesTable.projectId, confirmedAt: costEntriesTable.confirmedAt, createdAt: costEntriesTable.createdAt })
      .from(costEntriesTable)
      .where(and(eq(costEntriesTable.userId, userId), gte(costEntriesTable.date, from), lte(costEntriesTable.date, to)))
  ).filter((c) => inMonth(c.date));
  const claims = (await claimsInRange(userId, from, to)).filter((c) => inMonth(c.date));
  const claimIds = new Set(claims.map((c) => c.id));
  const costRow = (c: (typeof costs)[number]): CheckRow => ({ id: c.id, label: c.vendor || c.description, date: c.date.toISOString(), cents: c.totalCents, href: costHref(c.projectId) });
  // A claim is its own line; it is not counted twice as a pending cost.
  const costsPending = costs.filter((c) => c.status === "pending_review" && !claimIds.has(c.id)).map(costRow);
  const claimsOpen = claims.map((c) => ({ id: c.id, label: c.description, date: c.date.toISOString(), cents: c.totalCents, href: "/dashboard/books?tab=claims" }));
  const taxUnsplit = costs
    .filter((c) => {
      const b = c.taxBreakdown ?? {};
      const split = (b.GST ?? 0) + (b.HST ?? 0) + (b.QST ?? 0) + (b.PST ?? 0) + (b.RST ?? 0);
      return c.status === "confirmed" && c.taxCents > 0 && split === 0;
    })
    .map((c) => ({ ...costRow(c), href: costHref(c.projectId) }));

  // Invoices drafted in the month and never sent
  const drafts = (
    await db
      .select({ id: invoicesTable.id, number: invoicesTable.number, issueDate: invoicesTable.issueDate, createdAt: invoicesTable.createdAt, totalCents: invoicesTable.totalCents, type: invoicesTable.type })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.userId, userId), eq(invoicesTable.status, "draft"), gte(invoicesTable.createdAt, from), lte(invoicesTable.createdAt, to)))
  )
    .filter((i) => inMonth(i.createdAt))
    .map((i) => ({ id: i.id, label: i.number, date: i.createdAt.toISOString(), cents: i.totalCents, href: `/dashboard/invoices/${i.id}` }));

  // Hours not approved are labour cost that does not exist yet.
  const time = (
    await db
      .select({ id: timeEntriesTable.id, date: timeEntriesTable.date, hours: timeEntriesTable.hours, projectName: projectsTable.name })
      .from(timeEntriesTable)
      .leftJoin(projectsTable, eq(projectsTable.id, timeEntriesTable.projectId))
      .where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.status, "submitted"), gte(timeEntriesTable.date, from), lte(timeEntriesTable.date, to)))
  )
    .filter((e) => {
      const day = e.date.toISOString().slice(0, 10); // time entries are stored as their local day at UTC midnight
      return day >= first && day <= last;
    })
    .map((e) => ({ id: e.id, label: `${e.projectName ?? ""} · ${e.hours} h`, date: e.date.toISOString(), cents: 0, href: "/dashboard/team?tab=time" }));

  // In QuoteAI but not in the books: since the connection, what should have gone over and has no success on record.
  let notInBooks: CheckRow[] = [];
  if (books) {
    const sinceOk = (d: Date) => d >= books.since;
    const confirmed = costs.filter((c) => c.status === "confirmed" && sinceOk(c.confirmedAt ?? c.createdAt));
    const logTable = books.provider === "quickbooks" ? quickbooksSyncLogTable : waveSyncLogTable;
    const costOk = confirmed.length
      ? new Set((await db.select({ id: logTable.entityId }).from(logTable).where(and(eq(logTable.userId, userId), eq(logTable.entityType, "cost_entry"), eq(logTable.status, "synced"), inArray(logTable.entityId, confirmed.map((c) => c.id))))).map((r) => r.id))
      : new Set<string>();
    notInBooks = confirmed.filter((c) => !costOk.has(c.id)).map(costRow);

    if (books.provider === "quickbooks") {
      const sent = (
        await db
          .select({ id: invoicesTable.id, number: invoicesTable.number, issueDate: invoicesTable.issueDate, totalCents: invoicesTable.totalCents, sentAt: invoicesTable.sentAt })
          .from(invoicesTable)
          .where(and(eq(invoicesTable.userId, userId), notInArray(invoicesTable.status, ["draft", "void"]), ne(invoicesTable.type, "credit_note"), gte(invoicesTable.issueDate, from), lte(invoicesTable.issueDate, to)))
      ).filter((i) => inMonth(i.issueDate) && sinceOk(i.sentAt ?? i.issueDate));
      const invLinks = await linksFor(userId, "quickbooks", "invoice", sent.map((i) => i.id));
      const legacy = sent.length
        ? new Set((await db.select({ id: quickbooksSyncLogTable.entityId }).from(quickbooksSyncLogTable).where(and(eq(quickbooksSyncLogTable.userId, userId), eq(quickbooksSyncLogTable.qboType, "SalesReceipt"), eq(quickbooksSyncLogTable.status, "synced"), inArray(quickbooksSyncLogTable.entityId, sent.map((i) => i.id))))).map((r) => r.id))
        : new Set<string>();
      notInBooks.push(...sent.filter((i) => !invLinks.has(i.id) && !legacy.has(i.id)).map((i) => ({ id: i.id, label: i.number, date: i.issueDate.toISOString(), cents: i.totalCents, href: `/dashboard/invoices/${i.id}` })));
      const recent = payments.filter((p) => sinceOk(p.date));
      const payLinks = await linksFor(userId, "quickbooks", "invoice_payment", recent.map((p) => p.id));
      notInBooks.push(...recent.filter((p) => !payLinks.has(p.id) && !legacy.has(p.invoiceId)).map((p) => ({ id: p.id, label: p.number, date: p.date.toISOString(), cents: p.amountCents, href: `/dashboard/invoices/${p.invoiceId}` })));
    } else {
      // Wave still receives paid invoices as money-in transactions (its API cannot take an invoice payment).
      const paid = (
        await db
          .select({ id: invoicesTable.id, number: invoicesTable.number, paidAt: invoicesTable.paidAt, totalCents: invoicesTable.totalCents })
          .from(invoicesTable)
          .where(and(eq(invoicesTable.userId, userId), eq(invoicesTable.status, "paid"), ne(invoicesTable.type, "credit_note"), gte(invoicesTable.paidAt, from), lte(invoicesTable.paidAt, to)))
      ).filter((i) => i.paidAt && inMonth(i.paidAt) && sinceOk(i.paidAt));
      const ok = paid.length
        ? new Set((await db.select({ id: waveSyncLogTable.entityId }).from(waveSyncLogTable).where(and(eq(waveSyncLogTable.userId, userId), eq(waveSyncLogTable.entityType, "invoice"), eq(waveSyncLogTable.status, "synced"), inArray(waveSyncLogTable.entityId, paid.map((i) => i.id))))).map((r) => r.id))
        : new Set<string>();
      notInBooks.push(...paid.filter((i) => !ok.has(i.id)).map((i) => ({ id: i.id, label: i.number, date: i.paidAt!.toISOString(), cents: i.totalCents, href: `/dashboard/invoices/${i.id}` })));
    }
  }

  const items: CheckItem[] = [
    item("bank_unmatched", !!flinks, "/dashboard/books?tab=bank", bankUnmatched),
    item("payments_unbanked", !!flinks, "/dashboard/books?tab=bank", paymentsUnbanked),
    item("costs_pending", true, "/dashboard/documents", costsPending),
    item("claims_open", true, "/dashboard/books?tab=claims", claimsOpen),
    item("tax_unsplit", true, "/dashboard/compliance?tab=salesTax", taxUnsplit),
    item("invoices_draft", true, "/dashboard/invoices", drafts),
    item("time_unapproved", true, "/dashboard/team?tab=time", time),
    item("not_in_books", !!books, "/dashboard/settings?tab=integrations", notInBooks),
  ];

  const [closed] = await db.select().from(booksClosesTable).where(and(eq(booksClosesTable.userId, userId), eq(booksClosesTable.month, month)));
  return {
    month,
    first,
    last,
    books: books?.provider ?? null,
    bankFeed: !!flinks,
    items,
    open: items.filter((i) => i.applies && i.count > 0).length,
    closed: closed ? serializeClose(closed) : null,
    // Something turned up in a closed month: more open items of a kind than when it was closed.
    changedSinceClose: closed ? items.filter((i) => i.applies && i.count > (closed.snapshot[i.key]?.count ?? 0)).map((i) => i.key) : [],
  };
}

export function snapshotOf(items: CheckItem[]): BooksCloseSnapshot {
  return Object.fromEntries(items.map((i) => [i.key, { count: i.count, cents: i.cents }]));
}

export function serializeClose(c: BooksClose) {
  return { month: c.month, closedAt: c.closedAt.toISOString(), closedByName: c.closedByName, note: c.note, snapshot: c.snapshot };
}
