import test from "node:test";
import assert from "node:assert/strict";
import {
  initialsOf, leftOut, likelyDuplicates, limitOf, monthBars, monthFigures, payer, previousMonth, sameName, sharesBook, shortNames, shownMonth,
  type CrewPerson, type CrewWorker, type GroupDto, type GroupOverview, type OverviewCompany,
} from "./group.ts";

const totals = { invoicedCents: 0, collectedCents: 0, costCents: 0, marginCents: 0, marginPercent: null, outstandingCents: 0, overdueCents: 0, pipelineCents: 0 };
const co = (orgId: string, name: string, series: [string, number, number][], outstanding = 0, overdue = 0): OverviewCompany => ({
  orgId, companyName: name, province: "ON", totals: { ...totals, outstandingCents: outstanding, overdueCents: overdue }, activeJobs: 2,
  series: series.map(([month, invoicedCents, costCents]) => ({ month, invoicedCents, costCents })),
});
const overview = (): GroupOverview => ({
  months: 3,
  companies: [
    co("a", "Rossi Renovations", [["2026-07", 38200, 0], ["2026-08", 36900, 20000], ["2026-09", 41870, 28630]], 3120, 1000),
    co("b", "Rossi Commercial", [["2026-07", 12100, 0], ["2026-08", 15600, 9000], ["2026-09", 18450, 13100]], 6420, 2000),
  ],
  excluded: [],
  consolidated: { invoicedCents: 0, costCents: 0, marginCents: 0, marginPercent: null, outstandingCents: 9540, overdueCents: 3000, activeJobs: 4 },
  intercompany: { invoicedCents: 2400, costCents: 2400, byMonth: [{ month: "2026-09", invoicedCents: 2400, costCents: 2400 }] },
  series: [{ month: "2026-07", invoicedCents: 0, collectedCents: 0, costCents: 0 }, { month: "2026-08", invoicedCents: 0, collectedCents: 0, costCents: 0 }, { month: "2026-09", invoicedCents: 0, collectedCents: 0, costCents: 0 }],
});

test("the shared first word of the names is dropped", () => {
  assert.deepEqual(shortNames(["Rossi Renovations", "Rossi Commercial"]), ["Renovations", "Commercial"]);
  assert.deepEqual(shortNames(["Rossi Renovations", "Okoye Build"]), ["Rossi Renovations", "Okoye Build"]);
  assert.deepEqual(shortNames(["Rossi", "Rossi"]), ["Rossi", "Rossi"]);
  assert.equal(initialsOf("Luca Bianchi"), "LB");
});

test("all the companies' month leaves the work between them out", () => {
  const f = monthFigures(overview(), "all", "2026-09");
  assert.equal(f.invoicedCents, 41870 + 18450 - 2400);
  assert.equal(f.costCents, 28630 + 13100 - 2400);
  assert.equal(f.profitCents, f.invoicedCents - f.costCents);
  assert.equal(f.outstandingCents, 9540);
  assert.equal(f.overdueCents, 3000);
  assert.ok(Math.abs((f.marginPercent ?? 0) - ((f.invoicedCents - f.costCents) / f.invoicedCents) * 100) < 1e-9);
});

test("one company's month is its own, and says how it moved", () => {
  const f = monthFigures(overview(), "a", "2026-09");
  assert.equal(f.invoicedCents, 41870);
  assert.equal(f.outstandingCents, 3120);
  assert.ok(Math.abs((f.change ?? 0) - ((41870 - 36900) / 36900) * 100) < 1e-9);
  assert.equal(monthFigures(overview(), "a", "2026-07").change, null);
});

test("what was left out is the larger side of the work between companies", () => {
  assert.equal(leftOut(overview(), "2026-09"), 2400);
  assert.equal(leftOut(overview(), "2026-08"), null);
});

test("the bars stack each company and share one scale", () => {
  const { bars, max } = monthBars(overview(), "all", 2);
  assert.deepEqual(bars.map((b) => b.month), ["2026-08", "2026-09"]);
  assert.equal(bars[1]!.totalCents, 60320);
  assert.equal(max, 60320);
  assert.equal(monthBars(overview(), "b", 3).bars[2]!.parts.length, 1);
});

test("the month before wraps over the year", () => {
  assert.equal(previousMonth("2027-01"), "2026-12");
  assert.equal(previousMonth("2026-09"), "2026-08");
});

test("names that look like one person", () => {
  assert.equal(sameName("Dev Patel", "D. Patel"), true);
  assert.equal(sameName("dev patel", "Dev  Patel"), true);
  assert.equal(sameName("Dev Patel", "Dan Patel"), false);
  assert.equal(sameName("Dev Patel", "Dev Singh"), false);
  assert.equal(sameName("Madonna", "Madonna"), true);
  assert.equal(sameName("", ""), false);
});

test("only unlinked people on different companies are offered for linking, once each", () => {
  const w = (id: string, orgId: string, name: string, personId: string | null = null): CrewWorker => ({ id, orgId, companyName: orgId, name, role: "", workerType: "employee", personId, hasLink: false });
  const pairs = likelyDuplicates([w("1", "a", "Dev Patel"), w("2", "b", "D. Patel"), w("3", "a", "Dev Patel"), w("4", "c", "Sam", "p1"), w("5", "b", "Sam")]);
  assert.equal(pairs.length, 1);
  assert.deepEqual([pairs[0]!.a.id, pairs[0]!.b.id], ["1", "2"]);
  assert.equal(likelyDuplicates([w("1", "a", "Dev Patel"), w("2", "a", "Dev Patel")]).length, 0);
  assert.equal(likelyDuplicates([w("1", "a", "Dev Patel", "p"), w("2", "b", "Dev Patel", "p")]).length, 0);
});

test("a person's limit is the lowest of their companies", () => {
  const p: CrewPerson = { personId: "p", name: "Luca", combinedHours: 47.5, overCombined: true, companies: [{ orgId: "a", companyName: "A", workerId: "1", hours: 31.5, weeklyThreshold: 44 }, { orgId: "b", companyName: "B", workerId: "2", hours: 16, weeklyThreshold: 40 }] };
  assert.equal(limitOf(p), 40);
  assert.equal(limitOf({ ...p, companies: [{ ...p.companies[0]!, weeklyThreshold: null }] }), null);
});

test("who pays and who shares the price book", () => {
  const g: GroupDto = {
    id: "g", name: "Rossi", managerOrgId: "a", catalogOrgId: "a", billingOrgId: "a", self: { status: "active", useGroupCatalog: true, covered: false },
    companies: [
      { orgId: "a", companyName: "Rossi Renovations", province: "ON", status: "active", covered: false, useGroupCatalog: true, isManager: true, isBilling: true, isCatalog: true, isCurrent: true, yourRole: "owner" },
      { orgId: "b", companyName: "Rossi Commercial", province: "ON", status: "active", covered: true, useGroupCatalog: false, isManager: false, isBilling: false, isCatalog: false, isCurrent: false, yourRole: "owner" },
      { orgId: "c", companyName: "Rossi Painting", province: "ON", status: "pending", covered: false, useGroupCatalog: false, isManager: false, isBilling: false, isCatalog: false, isCurrent: false, yourRole: null },
    ],
  };
  assert.deepEqual(payer(g), { name: "Rossi Renovations", covers: 2 });
  assert.equal(payer({ ...g, billingOrgId: null }), null);
  assert.equal(sharesBook(g), true);
  assert.equal(sharesBook({ ...g, catalogOrgId: null }), false);
  assert.equal(sharesBook({ ...g, self: { ...g.self, useGroupCatalog: false } }), false);
});

test("a month with nothing yet shows the one before", () => {
  const o = overview();
  assert.equal(shownMonth(o), "2026-09");
  const empty = { ...o, series: [...o.series, { month: "2026-10", invoicedCents: 0, collectedCents: 0, costCents: 0 }], companies: o.companies.map((c) => ({ ...c, series: [...c.series, { month: "2026-10", invoicedCents: 0, costCents: 0 }] })) };
  assert.equal(shownMonth(empty), "2026-09");
  const some = { ...empty, companies: empty.companies.map((c, i) => (i ? c : { ...c, series: c.series.map((x) => (x.month === "2026-10" ? { ...x, invoicedCents: 500 } : x)) })) };
  assert.equal(shownMonth(some), "2026-10");
  assert.equal(shownMonth({ series: [], companies: [] }), null);
});
