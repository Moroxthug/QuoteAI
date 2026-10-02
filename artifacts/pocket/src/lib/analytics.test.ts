import test from "node:test";
import assert from "node:assert/strict";
import {
  averageLine, averageQuote, bestCaption, comparisonOf, compactMoney, dataMonth, kpisOf, leadSources, mainFlag, monthName, monthsOf, quoteToCash, revenueBars, topClients, topShare, winRate,
  type CompanyAnalytics, type Insights, type JobRisk,
} from "./analytics.ts";

const mp = (month: string, invoicedCents: number, costCents = 0, collectedCents = 0) => ({ month, invoicedCents, collectedCents, costCents, marginCents: invoicedCents - costCents, marginPercent: null });
const company = (): CompanyAnalytics => ({
  months: [
    mp("2025-07", 1000), mp("2025-08", 1500), mp("2025-09", 2000),
    mp("2026-04", 3120, 2000, 3000), mp("2026-05", 3680, 2500, 3000), mp("2026-06", 4410, 3000, 4000), mp("2026-07", 3960, 2000, 4000), mp("2026-08", 4310, 2500, 4000), mp("2026-09", 4823, 3091, 4187),
  ],
  totals: { invoicedCents: 0, collectedCents: 0, costCents: 0, marginCents: 0, marginPercent: null, outstandingCents: 1248, overdueCents: 312, pipelineCents: 1876 },
  jobs: { active: 3, risks: [] },
});
const insights = (): Insights => ({
  months: 24,
  quotes: [
    { month: "2026-08", sent: 4, sentCents: 20000, won: 2, wonCents: 9000, lost: 1 },
    { month: "2026-09", sent: 5, sentCents: 34200, won: 3, wonCents: 15000, lost: 2 },
  ],
  cycle: [
    { month: "2026-09", acceptDays: 12, acceptN: 2, invoiceDays: 18, invoiceN: 2, paidDays: 16, paidN: 2 },
    { month: "2026-08", acceptDays: 0, acceptN: 0, invoiceDays: 0, invoiceN: 0, paidDays: 6, paidN: 1 },
  ],
  clients: [
    { clientId: "a", name: "Hart", month: "2026-09", cents: 1300, invoices: 2 }, { clientId: "a", name: "Hart", month: "2026-08", cents: 300, invoices: 1 },
    { clientId: "b", name: "Dental", month: "2026-09", cents: 600, invoices: 1 }, { clientId: "c", name: "Okoye", month: "2026-08", cents: 900, invoices: 1 },
  ],
  leads: [
    { month: "2026-09", source: "manual", leads: 6, won: 3 }, { month: "2026-09", source: "widget", leads: 3, won: 1 }, { month: "2026-08", source: "manual", leads: 3, won: 0 },
  ],
});

test("a period is the month, the quarter so far or the year so far", () => {
  assert.deepEqual(monthsOf("m", "2026-09"), ["2026-09"]);
  assert.deepEqual(monthsOf("q", "2026-09"), ["2026-07", "2026-08", "2026-09"]);
  assert.deepEqual(monthsOf("q", "2026-08"), ["2026-07", "2026-08"]);
  assert.equal(monthsOf("y", "2026-09").length, 9);
  assert.equal(monthsOf("y", "2026-09")[0], "2026-01");
});

test("what it is compared with", () => {
  assert.deepEqual(comparisonOf("m", "2026-01"), ["2025-12"]);
  assert.deepEqual(comparisonOf("q", "2026-08"), ["2026-04", "2026-05"]);
  assert.deepEqual(comparisonOf("q", "2026-02"), ["2025-10", "2025-11"]);
  assert.deepEqual(comparisonOf("y", "2026-03"), ["2025-01", "2025-02", "2025-03"]);
});

test("the six figures", () => {
  const k = kpisOf(company(), "m", "2026-09");
  assert.equal(k.invoicedCents, 4823);
  assert.ok(Math.abs((k.change ?? 0) - ((4823 - 4310) / 4310) * 100) < 1e-9);
  assert.equal(k.collectedCents, 4187);
  assert.ok(Math.abs((k.collectedShare ?? 0) - 86.8) < 0.1);
  assert.equal(k.keptCents, 4823 - 3091);
  assert.equal(k.outstandingCents, 1248);
  assert.equal(kpisOf(company(), "q", "2026-09").invoicedCents, 3960 + 4310 + 4823);
  assert.ok((kpisOf(company(), "y", "2026-09").change ?? 0) > 0);
});

test("the revenue bars: six months, four quarters, four years", () => {
  const m = revenueBars(company(), "m", "2026-09");
  assert.deepEqual(m.map((b) => b.key), ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
  assert.equal(m[5]!.cents, 4823);
  const q = revenueBars(company(), "q", "2026-09");
  assert.deepEqual(q.map((b) => b.key), ["2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3"]);
  assert.equal(q[3]!.cents, 3960 + 4310 + 4823);
  assert.equal(q[2]!.cents, 3120 + 3680 + 4410);
  const y = revenueBars(company(), "y", "2026-09");
  assert.deepEqual(y.map((b) => b.key), ["2023", "2024", "2025", "2026"]);
  assert.equal(y[2]!.cents, 4500);
});

test("the best month or quarter gets its caption", () => {
  const c = company();
  assert.equal(bestCaption(revenueBars(c, "m", "2026-09"), "m", c, "2026-09"), "month");
  assert.equal(bestCaption(revenueBars(c, "m", "2026-07"), "m", c, "2026-07"), null);
  assert.equal(bestCaption(revenueBars(c, "q", "2026-09"), "q", c, "2026-09"), "quarter");
  assert.equal(bestCaption(revenueBars(c, "y", "2026-09"), "y", c, "2026-09"), null);
});

test("win rate counts quotes that were decided", () => {
  assert.deepEqual(winRate(insights(), ["2026-08", "2026-09"]), { won: 5, decided: 8, percent: 63 });
  assert.equal(winRate(insights(), ["2026-01"]).percent, null);
});

test("the average quote, month by month", () => {
  const i = insights();
  assert.equal(averageQuote(i, ["2026-09"]), 6840);
  assert.equal(averageQuote(i, ["2026-08", "2026-09"]), Math.round(54200 / 9));
  assert.equal(averageQuote(i, ["2026-01"]), null);
  const line = averageLine(i, revenueBars(company(), "q", "2026-09"), "q", "2026-09");
  assert.equal(line[3]!.cents, Math.round(54200 / 9));
  assert.equal(line[0]!.cents, null);
});

test("quote to cash averages each step over what happened", () => {
  assert.deepEqual(quoteToCash(insights(), ["2026-09"]), { accept: 6, invoice: 9, paid: 8, total: 23 });
  assert.deepEqual(quoteToCash(insights(), ["2026-08", "2026-09"]), { accept: 6, invoice: 9, paid: 7, total: 22 });
  assert.equal(quoteToCash(insights(), ["2026-01"]).total, 0);
});

test("top clients with their share", () => {
  const rows = topClients(insights(), ["2026-08", "2026-09"], 12000);
  assert.deepEqual(rows.map((r) => [r.name, r.cents, r.invoices, r.share]), [["Hart", 1600, 3, 13], ["Okoye", 900, 1, 8], ["Dental", 600, 1, 5]]);
  assert.equal(topShare(rows), 26);
  assert.equal(topClients(insights(), ["2026-01"], 0).length, 0);
});

test("lead sources by share, with how many were won", () => {
  const rows = leadSources(insights(), ["2026-08", "2026-09"]);
  assert.deepEqual(rows.map((r) => [r.source, r.leads, r.won, r.share]), [["manual", 9, 3, 75], ["widget", 3, 1, 25]]);
  assert.equal(rows[0]!.width, 100);
  assert.ok(Math.abs(rows[1]!.width - 100 / 3) < 1e-9);
});

test("a job's main flag", () => {
  const r = (flags: JobRisk["flags"]): JobRisk => ({ id: "j", name: "Job", flags, score: 1, detail: { overBudgetCents: 0, burnPercent: null, daysBehind: 0, overdueCents: 0, billingGapCents: 0 } });
  assert.equal(mainFlag(r(["billing_gap", "over_budget"])), "over_budget");
  assert.equal(mainFlag(r(["billing_gap", "overdue_invoices"])), "overdue_invoices");
  assert.equal(mainFlag(r(["budget_burn"])), "budget_burn");
});

test("month names follow the locale", () => {
  assert.equal(monthName("2026-09", "en-CA"), "September");
  assert.equal(monthName("2026-09", "fr-CA"), "septembre");
  assert.equal(monthName("2026-08", "en-CA", "short"), "Aug");
});

test("an empty new month shows the one before", () => {
  const c = company();
  assert.equal(dataMonth(c), "2026-09");
  assert.equal(dataMonth({ months: [...c.months, mp("2026-10", 0)] }), "2026-09");
  assert.equal(dataMonth({ months: [...c.months, mp("2026-10", 100)] }), "2026-10");
  assert.equal(dataMonth({ months: [] }), null);
});

test("big amounts are short over a column", () => {
  assert.equal(compactMoney(4_823_000, "en-CA"), "$48.2k");
  assert.equal(compactMoney(13_093_000, "en-CA"), "$131k");
  assert.equal(compactMoney(4_823_000, "fr-CA").replace(/\s/g, ""), "48,2k$");
});
