// Analytics (Analytics.dc.html): how the business is doing for a month, a quarter or the year so far. The server sends figures by month
// (GET /api/analytics/company and /api/analytics/insights); this adds them up for the period, finds what to compare with, and shapes the
// cards. Pure, so they are tested (analytics.test.ts).
import type { Locale } from "./format.ts";

export type Period = "m" | "q" | "y";
export const PERIODS: Period[] = ["m", "q", "y"];

export type MonthPoint = { month: string; invoicedCents: number; collectedCents: number; costCents: number; marginCents: number; marginPercent: number | null };
export type RiskFlag = "over_budget" | "budget_burn" | "behind_schedule" | "overdue_invoices" | "unbilled_completion" | "billing_gap";
export type JobRisk = { id: string; name: string; flags: RiskFlag[]; score: number; detail: { overBudgetCents: number; burnPercent: number | null; daysBehind: number; overdueCents: number; billingGapCents: number } };
export type CompanyAnalytics = {
  months: MonthPoint[];
  totals: { invoicedCents: number; collectedCents: number; costCents: number; marginCents: number; marginPercent: number | null; outstandingCents: number; overdueCents: number; pipelineCents: number };
  jobs: { active: number; risks: JobRisk[] };
};
export type QuoteMonth = { month: string; sent: number; sentCents: number; won: number; wonCents: number; lost: number };
export type CycleMonth = { month: string; acceptDays: number; acceptN: number; invoiceDays: number; invoiceN: number; paidDays: number; paidN: number };
export type ClientMonth = { clientId: string; name: string; month: string; cents: number; invoices: number };
export type LeadMonth = { month: string; source: string; leads: number; won: number };
export type Insights = { months: number; quotes: QuoteMonth[]; cycle: CycleMonth[]; clients: ClientMonth[]; leads: LeadMonth[] };

// ── Periods ─────────────────────────────────────────────────────────────────

const key = (y: number, m0: number): string => `${y + Math.floor(m0 / 12)}-${String(((m0 % 12) + 12) % 12 + 1).padStart(2, "0")}`;
const parts = (month: string): [number, number] => [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1];

/** The months a period covers, ending with `latest` (a "YYYY-MM"): the month; its quarter so far; the year so far. */
export function monthsOf(period: Period, latest: string): string[] {
  const [y, m] = parts(latest);
  const start = period === "m" ? m : period === "q" ? m - (m % 3) : 0;
  return Array.from({ length: m - start + 1 }, (_, i) => key(y, start + i));
}

/** The months to compare with: the month before; the quarter before (as many months); the same months a year ago. */
export function comparisonOf(period: Period, latest: string): string[] {
  const [y, m] = parts(latest);
  const mine = monthsOf(period, latest);
  if (period === "y") return mine.map((k) => key(parts(k)[0] - 1, parts(k)[1]));
  const first = parts(mine[0]!)[1];
  const span = period === "m" ? 1 : 3;
  return Array.from({ length: mine.length }, (_, i) => key(y, first - span + i));
}

const sum = <T>(rows: T[], months: string[], pick: (r: T) => number, of: (r: T) => string): number => rows.reduce((n, r) => n + (months.includes(of(r)) ? pick(r) : 0), 0);

export const invoicedIn = (a: CompanyAnalytics, months: string[]): number => sum(a.months, months, (m) => m.invoicedCents, (m) => m.month);

/** The six figures at the top for the period: invoiced and how it moved, collected and its share, costs, margin and what was kept, what is owed, what is still to bill. */
export function kpisOf(a: CompanyAnalytics, period: Period, latest: string) {
  const months = monthsOf(period, latest);
  const before = comparisonOf(period, latest);
  const invoiced = invoicedIn(a, months);
  const prev = invoicedIn(a, before);
  const collected = sum(a.months, months, (m) => m.collectedCents, (m) => m.month);
  const cost = sum(a.months, months, (m) => m.costCents, (m) => m.month);
  return {
    invoicedCents: invoiced,
    change: prev > 0 ? ((invoiced - prev) / prev) * 100 : null,
    collectedCents: collected,
    collectedShare: invoiced > 0 ? (collected / invoiced) * 100 : null,
    costCents: cost,
    keptCents: invoiced - cost,
    marginPercent: invoiced > 0 ? ((invoiced - cost) / invoiced) * 100 : null,
    outstandingCents: a.totals.outstandingCents,
    overdueCents: a.totals.overdueCents,
    toInvoiceCents: a.totals.pipelineCents,
  };
}

/** The bars of the revenue card: the last six months, the last four quarters, the last four years; each with its label parts and the total. */
export function revenueBars(a: CompanyAnalytics, period: Period, latest: string): { key: string; year: number; index: number; cents: number }[] {
  const [y, m] = parts(latest);
  if (period === "m") return Array.from({ length: 6 }, (_, i) => { const k = key(y, m - 5 + i); return { key: k, year: parts(k)[0], index: parts(k)[1], cents: invoicedIn(a, [k]) }; });
  if (period === "q") {
    const q = Math.floor(m / 3);
    return Array.from({ length: 4 }, (_, i) => {
      const n = q - 3 + i;
      const yy = y + Math.floor(n / 4);
      const qq = ((n % 4) + 4) % 4;
      return { key: `${yy}-Q${qq + 1}`, year: yy, index: qq, cents: invoicedIn(a, [key(yy, qq * 3), key(yy, qq * 3 + 1), key(yy, qq * 3 + 2)]) };
    });
  }
  return Array.from({ length: 4 }, (_, i) => {
    const yy = y - 3 + i;
    return { key: String(yy), year: yy, index: 0, cents: invoicedIn(a, Array.from({ length: 12 }, (_, k) => key(yy, k))) };
  });
}

/** The caption under the revenue bars when the latest bar is the best so far, else null. */
export function bestCaption(bars: { cents: number }[], period: Period, a: CompanyAnalytics, latest: string): "month" | "quarter" | null {
  const last = bars[bars.length - 1];
  if (!last || last.cents <= 0 || period === "y") return null;
  if (period === "q") return bars.slice(0, -1).every((b) => b.cents < last.cents) && bars.some((b) => b.cents > 0 && b !== last) ? "quarter" : null;
  const thisYear = monthsOf("y", latest);
  const rest = thisYear.slice(0, -1).map((k) => invoicedIn(a, [k]));
  return rest.length > 0 && rest.every((c) => c < last.cents) ? "month" : null;
}

// ── Quotes ──────────────────────────────────────────────────────────────────

const inMonths = <T extends { month: string }>(rows: T[], months: string[]): T[] => rows.filter((r) => months.includes(r.month));

/** Quotes decided in the period: won over won plus lost, as a percent; null when none were decided. */
export function winRate(i: Insights, months: string[]): { won: number; decided: number; percent: number | null } {
  const rows = inMonths(i.quotes, months);
  const won = rows.reduce((n, r) => n + r.won, 0);
  const decided = won + rows.reduce((n, r) => n + r.lost, 0);
  return { won, decided, percent: decided > 0 ? Math.round((won / decided) * 100) : null };
}

/** The average size of the quotes sent in the given months, in cents, or null when none were sent. */
export function averageQuote(i: Insights, months: string[]): number | null {
  const rows = inMonths(i.quotes, months);
  const sent = rows.reduce((n, r) => n + r.sent, 0);
  return sent > 0 ? Math.round(rows.reduce((n, r) => n + r.sentCents, 0) / sent) : null;
}

/** The average quote at each bar of the revenue card (so the line has the same months as the bars). */
export function averageLine(i: Insights, bars: { key: string }[], period: Period, latest: string): { key: string; cents: number | null }[] {
  return bars.map((b) => {
    const ms = period === "m" ? [b.key] : period === "q" ? [0, 1, 2].map((n) => `${b.key.slice(0, 4)}-${String((Number(b.key.slice(6)) - 1) * 3 + n + 1).padStart(2, "0")}`) : Array.from({ length: 12 }, (_, n) => `${b.key}-${String(n + 1).padStart(2, "0")}`);
    return { key: b.key, cents: averageQuote(i, ms.filter((m) => m <= latest)) };
  });
}

/** From a quote sent to money in the bank: the days it takes to accept, to invoice and to get paid (a step with nothing in the period is 0). */
export function quoteToCash(i: Insights, months: string[]): { accept: number; invoice: number; paid: number; total: number } {
  const rows = inMonths(i.cycle, months);
  const avg = (d: (r: CycleMonth) => number, n: (r: CycleMonth) => number): number => {
    const count = rows.reduce((s, r) => s + n(r), 0);
    return count > 0 ? Math.round(rows.reduce((s, r) => s + d(r), 0) / count) : 0;
  };
  const accept = avg((r) => r.acceptDays, (r) => r.acceptN);
  const invoice = avg((r) => r.invoiceDays, (r) => r.invoiceN);
  const paid = avg((r) => r.paidDays, (r) => r.paidN);
  return { accept, invoice, paid, total: accept + invoice + paid };
}

// ── Clients and leads ───────────────────────────────────────────────────────

/** The three clients invoiced the most in the period, each with their share of everything invoiced in it. */
export function topClients(i: Insights, months: string[], invoicedCents: number, count = 3): { clientId: string; name: string; cents: number; invoices: number; share: number }[] {
  const by = new Map<string, { clientId: string; name: string; cents: number; invoices: number }>();
  for (const r of inMonths(i.clients, months)) {
    const c = by.get(r.clientId) ?? { clientId: r.clientId, name: r.name, cents: 0, invoices: 0 };
    c.cents += r.cents;
    c.invoices += r.invoices;
    by.set(r.clientId, c);
  }
  return [...by.values()].filter((c) => c.cents > 0).sort((a, b) => b.cents - a.cents).slice(0, count).map((c) => ({ ...c, share: invoicedCents > 0 ? Math.round((c.cents / invoicedCents) * 100) : 0 }));
}

/** What the top clients bring together, as a percent of what was invoiced. */
export const topShare = (rows: { share: number }[]): number => rows.reduce((n, r) => n + r.share, 0);

/** Where the leads came from in the period: each source's share of the leads (and the bar's width against the largest), and how many were won. */
export function leadSources(i: Insights, months: string[]): { source: string; leads: number; won: number; share: number; width: number }[] {
  const by = new Map<string, { source: string; leads: number; won: number }>();
  for (const r of inMonths(i.leads, months)) {
    const s = by.get(r.source) ?? { source: r.source, leads: 0, won: 0 };
    s.leads += r.leads;
    s.won += r.won;
    by.set(r.source, s);
  }
  const rows = [...by.values()].sort((a, b) => b.leads - a.leads);
  const total = rows.reduce((n, r) => n + r.leads, 0);
  const max = rows[0]?.leads ?? 1;
  return rows.map((r) => ({ ...r, share: total > 0 ? Math.round((r.leads / total) * 100) : 0, width: (r.leads / max) * 100 }));
}

// ── Jobs to look at ─────────────────────────────────────────────────────────

/** The main reason a job is on the list, in the order the board tells it (over budget first). */
export function mainFlag(r: JobRisk): RiskFlag {
  const order: RiskFlag[] = ["over_budget", "overdue_invoices", "behind_schedule", "unbilled_completion", "billing_gap", "budget_burn"];
  return order.find((f) => r.flags.includes(f)) ?? r.flags[0]!;
}

// ── Words ───────────────────────────────────────────────────────────────────

/** The month, quarter or year as a heading label: "September 2026" / "Q3 2026, Jul to Sep" / "2026 so far", with the pieces the locale gives. */
export function monthName(month: string, locale: Locale, style: "long" | "short" = "long"): string {
  const [y, m] = parts(month);
  return new Intl.DateTimeFormat(locale, { month: style }).format(new Date(y, m, 1));
}

/** The latest month that has anything in it: this month, or the one before while this one is still empty (the first days of a month). */
export function dataMonth(a: Pick<CompanyAnalytics, "months">): string | null {
  const m = a.months;
  const last = m[m.length - 1];
  if (!last) return null;
  const has = (p: MonthPoint | undefined) => !!p && (p.invoicedCents !== 0 || p.costCents !== 0 || p.collectedCents !== 0);
  return !has(last) && has(m[m.length - 2]) ? m[m.length - 2]!.month : last.month;
}

/** "$48.2k" / "48,2 k$": a big amount short enough to sit over a column. */
export function compactMoney(cents: number, locale: Locale): string {
  const s = new Intl.NumberFormat(locale, { style: "currency", currency: "CAD", currencyDisplay: "narrowSymbol", notation: "compact", maximumFractionDigits: cents >= 10_000_000 ? 0 : 1 }).format(cents / 100);
  return s.replace("K", "k");
}
