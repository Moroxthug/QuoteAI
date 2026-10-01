// The Books screen's rules (Books.dc.html): the month chips, the checklist with its "not needed" marks, when the month can be
// closed, and the bank lines with what each could be matched to. Pure, so they are tested (books.test.ts). The server's
// shapes (routes/books.ts, books/close.ts, books/reconcile.ts) are typed here.

export type CheckKey = "bank_unmatched" | "payments_unbanked" | "costs_pending" | "claims_open" | "tax_unsplit" | "invoices_draft" | "time_unapproved" | "not_in_books";
export type CheckRow = { id: string; label: string; date: string; cents: number; href: string };
export type CheckItem = { key: CheckKey; applies: boolean; count: number; cents: number; href: string; rows: CheckRow[] };
export type CloseDto = { month: string; closedAt: string; closedByName: string | null; note: string; snapshot: Record<string, { count: number; cents: number }> };
export type MonthChecklist = {
  month: string; first: string; last: string; books: "quickbooks" | "wave" | null; bankFeed: boolean; items: CheckItem[]; open: number;
  closed: CloseDto | null; changedSinceClose: CheckKey[]; closedMonths: string[];
};

export type BooksOverview =
  | { enabled: false; requiredPlan?: string }
  | {
    enabled: true; today: string;
    bank: { onPlan: boolean; requiredPlan?: string; connected: boolean; account: { id: string; name: string; institution: string; last4: string | null } | null; lastSyncedAt: string | null };
    books: { provider: "quickbooks" | "wave"; name: string | null; paymentsPulledAt: string | null } | null;
  };

export type BankMatch =
  | { kind: "cost"; id: string; label: string; date: string; amountCents: number; status: string; projectId: string | null; projectName: string | null; fromBankLine: boolean }
  | { kind: "payment"; id: string; invoiceId: string; invoiceNumber: string; customer: string; date: string; amountCents: number; method: string };
export type BankLine = { id: string; date: string; description: string; amountCents: number; status: "unmatched" | "matched" | "ignored"; autoMatched: boolean; match: BankMatch | null };

export type CandidateCost = { id: string; vendor: string; description: string; date: string; totalCents: number; status: string; source: string; projectName: string | null };
export type CandidatePayment = { id: string; invoiceId: string; invoiceNumber: string; customer: string; date: string; amountCents: number; method: string };
export type CandidateInvoice = { id: string; number: string; customer: string; balanceCents: number; dueDate: string; status: string; exact: boolean };
export type Candidates = { direction: "in" | "out"; costs: CandidateCost[]; payments: CandidatePayment[]; invoices: CandidateInvoice[] };

// ── Months ──────────────────────────────────────────────────────────────────

export const monthOf = (day: string): string => day.slice(0, 7);

/** `YYYY-MM` shifted by `by` months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

/** The month chips: the last four months, oldest first, ending with the current one. */
export function monthChips(today: string, closedMonths: string[]): { month: string; closed: boolean }[] {
  const now = monthOf(today);
  return [-3, -2, -1, 0].map((d) => shiftMonth(now, d)).map((month) => ({ month, closed: closedMonths.includes(month) }));
}

/** The month to open on: the one that just ended (the one being closed), as the server also defaults to. */
export const defaultMonth = (today: string): string => shiftMonth(monthOf(today), -1);

/** A month can be closed only once it is over. */
export const monthIsOver = (month: string, today: string): boolean => month < monthOf(today);

/** The first day of `month` at noon on the phone's clock, for Intl month names. */
export function monthDate(month: string): Date {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1, 12);
}

// ── The checklist ───────────────────────────────────────────────────────────

export type CheckState = { key: CheckKey; count: number; href: string; na: boolean; open: boolean; rows: CheckRow[] };

/** The items that apply to this company (no bank feed, no bank items), each open, done or marked not needed. */
export function checklist(items: CheckItem[], na: ReadonlySet<string>): CheckState[] {
  return items.filter((i) => i.applies).map((i) => {
    const marked = na.has(i.key);
    return { key: i.key, count: i.count, href: i.href, rows: i.rows, na: marked, open: i.count > 0 && !marked };
  });
}

export const openCount = (list: CheckState[]): number => list.filter((i) => i.open).length;

export type CloseState = "closed" | "notOver" | "openItems" | "ready";
/** Whether the month's button works: closed already, still running, items left, or ready. */
export function closeState(month: string, today: string, list: CheckState[], closed: boolean): CloseState {
  if (closed) return "closed";
  if (!monthIsOver(month, today)) return "notOver";
  return openCount(list) > 0 ? "openItems" : "ready";
}

/** The marks of items not needed this month are kept on the phone, per month. */
export const naKey = (month: string): string => `books.na.${month}`;
export function parseNa(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try { const v = JSON.parse(raw); return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []); } catch { return new Set(); }
}
export const serializeNa = (na: ReadonlySet<string>): string => JSON.stringify([...na].sort());

// ── Bank lines ──────────────────────────────────────────────────────────────

/** The company's own calendar day of an instant, as the server reads it: midnight UTC is that date, anything else is the phone's local day. */
export function dayOfIso(iso: string): string {
  const d = new Date(iso);
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) return d.toISOString().slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A calendar day as a date at noon on the phone's clock (so a short date prints the right day). */
export function dayDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
}

export type BankFilter = "open" | "matched" | "ignored";
export const BANK_FILTERS: BankFilter[] = ["open", "matched", "ignored"];
const filterOf = (l: BankLine): BankFilter => (l.status === "unmatched" ? "open" : l.status === "ignored" ? "ignored" : "matched");

/** The lines dated in `month`, newest first. */
export function monthLines(lines: BankLine[], month: string): BankLine[] {
  return lines.filter((l) => monthOf(dayOfIso(l.date)) === month).sort((a, b) => b.date.localeCompare(a.date));
}
export function filterCounts(lines: BankLine[]): Record<BankFilter, number> {
  const c: Record<BankFilter, number> = { open: 0, matched: 0, ignored: 0 };
  for (const l of lines) c[filterOf(l)] += 1;
  return c;
}
export const linesFor = (lines: BankLine[], filter: BankFilter): BankLine[] => lines.filter((l) => filterOf(l) === filter);

/** Money in or out with the board's sign: +$2,340.00 / −$412.66 (the amount itself is formatted by the caller). */
export const signOf = (cents: number): "+" | "−" => (cents < 0 ? "−" : "+");

// ── What a line could be ────────────────────────────────────────────────────

export type Suggestion =
  | { kind: "payment"; id: string; number: string; customer: string }
  | { kind: "invoice"; id: string; number: string; customer: string; exact: boolean }
  | { kind: "cost"; id: string; label: string; date: string };

/** The one thing a line most likely is: a payment on the same amount, an invoice it would settle, a partial deposit, or a cost on the same amount. */
export function suggestion(c: Candidates | undefined): Suggestion | null {
  if (!c) return null;
  if (c.direction === "out") {
    const x = c.costs[0];
    return x ? { kind: "cost", id: x.id, label: x.vendor || x.description, date: x.date } : null;
  }
  const p = c.payments[0];
  if (p) return { kind: "payment", id: p.id, number: p.invoiceNumber, customer: p.customer };
  const inv = c.invoices.find((i) => i.exact) ?? c.invoices[0];
  return inv ? { kind: "invoice", id: inv.id, number: inv.number, customer: inv.customer, exact: inv.exact } : null;
}

export const candidateCount = (c: Candidates | undefined): number => (c ? c.costs.length + c.payments.length + c.invoices.length : 0);

/**
 * A line the sheet has to be opened for ("Match…"): nothing it obviously is, or several things it could be. One strong candidate
 * (a payment, an invoice the deposit settles exactly, a cost on the same amount) or, failing that, one part-settled invoice matches in one tap.
 */
export function needsPicker(c: Candidates | undefined): boolean {
  if (!c) return true;
  const strong = c.costs.length + c.payments.length + c.invoices.filter((i) => i.exact).length;
  if (strong > 0) return strong !== 1;
  return c.invoices.length !== 1;
}
