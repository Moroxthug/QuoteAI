// vitest suite (Phase 61): the assertions below were a plain node:assert script; now run by `pnpm test`.
import assert from "node:assert/strict";
import { lastMonths, monthlySeries, budgetVsActual, costCurve, scheduleVariance, earnedValue, cashFlowForecast, jobRisks, startOfWeekUtc } from "./math.js";
import { test } from "vitest";

test("analytics/math", () => {

  const now = new Date("2026-09-13T15:00:00Z");
  const d = (s: string) => new Date(`${s}T12:00:00Z`);

  // Month keys end with the current month, oldest first.
  assert.deepEqual(lastMonths(3, now), ["2026-07", "2026-08", "2026-09"]);

  // Monthly P&L: drafts/void ignored, credit notes subtract, credit-note "payments" are not cash, only confirmed costs count.
  const months = monthlySeries({
    invoices: [
      { type: "deposit", status: "paid", totalCents: 100_000, issueDate: d("2026-08-03") },
      { type: "progress", status: "draft", totalCents: 999_999, issueDate: d("2026-08-10") },
      { type: "manual", status: "void", totalCents: 999_999, issueDate: d("2026-08-11") },
      { type: "credit_note", status: "sent", totalCents: -20_000, issueDate: d("2026-08-20") },
      { type: "final", status: "sent", totalCents: 50_000, issueDate: d("2026-09-01") },
    ],
    payments: [
      { amountCents: 100_000, date: d("2026-08-05") },
      { amountCents: 20_000, date: d("2026-08-20"), creditNoteId: "cn" },
    ],
    costs: [
      { totalCents: 30_000, date: d("2026-08-15"), status: "confirmed" },
      { totalCents: 5_000, date: d("2026-08-16"), status: "pending_review" },
    ],
    months: 2,
    now,
  });
  assert.deepEqual(months.map((m) => [m.month, m.invoicedCents, m.collectedCents, m.costCents, m.marginPercent]), [
    ["2026-08", 80_000, 100_000, 30_000, 62.5],
    ["2026-09", 50_000, 0, 0, 100],
  ]);

  // Budget vs actual splits pending from confirmed and reports usage %.
  const cats = budgetVsActual(
    [{ category: "materials", plannedCents: 100_000 }, { category: "labour", plannedCents: 50_000 }],
    [{ totalCents: 60_000, date: now, status: "confirmed", category: "materials" }, { totalCents: 10_000, date: now, status: "pending_review", category: "materials" }, { totalCents: 70_000, date: now, status: "confirmed", category: "labour" }],
    ["materials", "labour", "misc"],
  );
  assert.deepEqual(cats.map((c) => [c.category, c.actualCents, c.pendingCents, c.varianceCents, c.usedPercent]), [["materials", 60_000, 10_000, 40_000, 60], ["labour", 70_000, 0, -20_000, 140], ["misc", 0, 0, 0, null]]);

  // Cost curve: cumulative actuals, straight-line plan reaching the budget at planned end.
  const curve = costCurve({ costs: [{ totalCents: 10_000, date: d("2026-08-04"), status: "confirmed" }, { totalCents: 20_000, date: d("2026-08-18"), status: "confirmed" }], budgetCents: 100_000, plannedStart: d("2026-08-03"), plannedEnd: d("2026-08-30"), now });
  assert.equal(curve[0]!.week, "2026-08-03");
  assert.equal(curve[0]!.actualCents, 10_000);
  assert.equal(curve[2]!.actualCents, 30_000);
  assert.equal(curve[curve.length - 1]!.plannedCents, 100_000);
  assert.equal(curve[curve.length - 1]!.week, "2026-09-07");
  assert.ok(curve[1]!.plannedCents > 0 && curve[1]!.plannedCents < 100_000);

  // Schedule variance: finished late, running late, not started late, on track.
  const sched = scheduleVariance(
    [
      { id: "a", title: "A", status: "completed", plannedStart: d("2026-08-03"), plannedEnd: d("2026-08-07"), actualStart: d("2026-08-03"), actualEnd: d("2026-08-10") },
      { id: "b", title: "B", status: "in_progress", plannedStart: d("2026-08-10"), plannedEnd: d("2026-09-01"), actualStart: d("2026-08-10"), actualEnd: null },
      { id: "c", title: "C", status: "planned", plannedStart: d("2026-09-08"), plannedEnd: d("2026-09-20"), actualStart: null, actualEnd: null },
      { id: "d", title: "D", status: "planned", plannedStart: d("2026-09-21"), plannedEnd: d("2026-09-30"), actualStart: null, actualEnd: null },
    ],
    now,
  );
  assert.deepEqual(sched.rows.map((r) => [r.id, r.state, r.slipDays]), [["a", "done_late", 3], ["b", "late", 12], ["c", "not_started_late", 5], ["d", "pending", 0]]);
  assert.equal(sched.daysBehind, 12);
  assert.equal(sched.lateCount, 2);

  // Earned value: 40% done on a $100k job with $70k budget and $35k spent → CPI 0.8, projected cost $87.5k, margin 12.5%.
  const ev = earnedValue({ subtotalCents: 10_000_000, progressPercent: 40, invoicedSubtotalCents: 2_500_000, budgetCents: 7_000_000, costCents: 3_500_000 });
  assert.equal(ev.earnedCents, 4_000_000);
  assert.equal(ev.billingGapCents, 1_500_000);
  assert.equal(ev.costPerformance, 0.8);
  assert.equal(ev.projectedFinalCostCents, 8_750_000);
  assert.equal(ev.projectedMarginPercent, 12.5);
  // Before 10% progress the projection falls back to the budget.
  assert.equal(earnedValue({ subtotalCents: 100, progressPercent: 5, invoicedSubtotalCents: 0, budgetCents: 70, costCents: 10 }).projectedFinalCostCents, 70);

  // Cash-flow forecast: overdue lands in week 0, due dates bucket by week, budgets spread evenly, cumulative net.
  const cf = cashFlowForecast({
    openInvoices: [
      { balanceCents: 10_000, dueDate: d("2026-09-01"), status: "overdue" },
      { balanceCents: 20_000, dueDate: d("2026-09-22"), status: "sent" },
      { balanceCents: 99_999, dueDate: d("2026-12-25"), status: "sent" },
    ],
    upcomingTerms: [{ amountCents: 40_000, expectedDate: d("2026-09-30") }],
    remainingBudgets: [{ remainingCents: 30_000, from: now, to: d("2026-09-27") }],
    weeks: 4,
    now,
  });
  assert.equal(startOfWeekUtc(now).toISOString().slice(0, 10), "2026-09-07");
  assert.deepEqual(cf.map((w) => [w.week, w.overdueCents, w.dueCents, w.expectedCents, w.outflowCents]), [
    ["2026-09-07", 10_000, 0, 0, 10_000],
    ["2026-09-14", 0, 0, 0, 10_000],
    ["2026-09-21", 0, 20_000, 0, 10_000],
    ["2026-09-28", 0, 0, 40_000, 0],
  ]);
  assert.equal(cf[3]!.cumulativeCents, 40_000);

  // Risk flags: over budget beats burn; behind schedule; overdue; unbilled completion; healthy job omitted.
  const risks = jobRisks([
    { id: "1", name: "Over", status: "active", subtotalCents: 1_000_000, budgetCents: 700_000, costCents: 800_000, progressPercent: 50, invoicedSubtotalCents: 500_000, overdueCents: 0, daysBehind: 0, plannedEnd: null, completedAt: null },
    { id: "2", name: "Burn", status: "active", subtotalCents: 1_000_000, budgetCents: 700_000, costCents: 500_000, progressPercent: 30, invoicedSubtotalCents: 300_000, overdueCents: 0, daysBehind: 0, plannedEnd: null, completedAt: null },
    { id: "3", name: "Late+overdue", status: "active", subtotalCents: 1_000_000, budgetCents: 700_000, costCents: 100_000, progressPercent: 20, invoicedSubtotalCents: 200_000, overdueCents: 50_000, daysBehind: 10, plannedEnd: null, completedAt: null },
    { id: "4", name: "Done unbilled", status: "completed", subtotalCents: 1_000_000, budgetCents: 700_000, costCents: 600_000, progressPercent: 100, invoicedSubtotalCents: 800_000, overdueCents: 0, daysBehind: 0, plannedEnd: null, completedAt: now },
    { id: "5", name: "Healthy", status: "active", subtotalCents: 1_000_000, budgetCents: 700_000, costCents: 300_000, progressPercent: 50, invoicedSubtotalCents: 500_000, overdueCents: 0, daysBehind: 1, plannedEnd: null, completedAt: null },
    { id: "6", name: "Done clean", status: "completed", subtotalCents: 1_000_000, budgetCents: 700_000, costCents: 600_000, progressPercent: 100, invoicedSubtotalCents: 1_000_000, overdueCents: 0, daysBehind: 0, plannedEnd: null, completedAt: now },
  ]);
  const byId = Object.fromEntries(risks.map((r) => [r.id, r.flags]));
  assert.deepEqual(byId["1"], ["over_budget"]);
  assert.deepEqual(byId["2"], ["budget_burn"]);
  assert.deepEqual(byId["3"], ["behind_schedule", "overdue_invoices"]);
  assert.deepEqual(byId["4"], ["unbilled_completion"]);
  assert.equal(byId["5"], undefined);
  assert.equal(byId["6"], undefined);
  assert.equal(risks[0]!.id, "3"); // highest score first (30 + 25)
});
