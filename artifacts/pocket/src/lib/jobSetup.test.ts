import assert from "node:assert/strict";
import { test } from "node:test";
import { addWork, budgetRows, layout, margin, newMilestone, nextWork, parseDay, setupBody, shares, startOptions, stepCents, window, workDays, isoDay, type DraftMilestone } from "./jobSetup.ts";
import type { JobDetail } from "./jobDetail.ts";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12);
const ms = (days: number, o: Partial<DraftMilestone> = {}): DraftMilestone => ({ key: String(Math.random()), title: "M", tasks: 0, valueCents: 0, days, start: null, end: null, term: null, ...o });

test("a weekend moves to Monday and working days skip the weekend", () => {
  assert.equal(isoDay(nextWork(d(2026, 10, 3))), "2026-10-05"); // Sat -> Mon
  assert.equal(isoDay(nextWork(d(2026, 10, 7))), "2026-10-07");
  assert.equal(isoDay(addWork(d(2026, 10, 1), 3)), "2026-10-06"); // Thu + 3 working days = Tue
  assert.equal(workDays(d(2026, 10, 1), d(2026, 10, 6)), 4); // Thu, Fri, Mon, Tue
  assert.equal(workDays(d(2026, 10, 3), d(2026, 10, 4)), 1); // a weekend still counts as at least one
});

test("laying out keeps order and each length, one after another", () => {
  const out = layout([ms(1), ms(2), ms(1)], d(2026, 10, 3)); // starts Sat -> Mon Oct 5
  assert.deepEqual(out.map((m) => [m.start, m.end]), [["2026-10-05", "2026-10-05"], ["2026-10-06", "2026-10-07"], ["2026-10-08", "2026-10-08"]]);
  assert.equal(parseDay("2026-10-08").getDate(), 8);
});

test("the window and the working days it covers", () => {
  assert.equal(window([ms(1)]), null);
  const w = window(layout([ms(1), ms(3)], d(2026, 10, 5)))!;
  assert.equal(isoDay(w.from), "2026-10-05");
  assert.equal(isoDay(w.to), "2026-10-08");
  assert.equal(w.days, 4);
});

test("shares add up to 100, by value or equally", () => {
  assert.deepEqual(shares([ms(1, { valueCents: 300 }), ms(1, { valueCents: 200 }), ms(1, { valueCents: 450 }), ms(1, { valueCents: 50 })]).reduce((n, v) => n + v, 0), 100);
  assert.deepEqual(shares([ms(1), ms(1), ms(1)]).reduce((n, v) => n + v, 0), 100);
  assert.deepEqual(shares([]), []);
  assert.deepEqual(shares([ms(1, { valueCents: 15 }), ms(1, { valueCents: 20 }), ms(1, { valueCents: 45 }), ms(1, { valueCents: 20 })]), [15, 20, 45, 20]);
});

test("the next four Mondays and Wednesdays after today", () => {
  assert.deepEqual(startOptions(d(2026, 9, 30)).map(isoDay), ["2026-10-05", "2026-10-07", "2026-10-12", "2026-10-14"]);
  assert.deepEqual(startOptions(d(2026, 10, 5)).map(isoDay), ["2026-10-07", "2026-10-12", "2026-10-14", "2026-10-19"]);
});

test("a step is about one percent of the contract, on a round number", () => {
  assert.equal(stepCents(221_000), 2500);
  assert.equal(stepCents(4_235_500), 50_000);
  assert.equal(stepCents(99_999_999), 100_000);
});

test("margin is what is left of the contract after the costs", () => {
  assert.deepEqual(margin(221_000, 146_500), { cents: 74_500, pct: 33.7 });
  assert.deepEqual(margin(0, 100), { cents: -100, pct: 0 });
});

test("budget rows are one per category with the labels of their lines", () => {
  const detail = { budget: [
    { id: "1", category: "materials", chapterRef: null, label: "Vinyl plank", plannedCents: 50_000, sortOrder: 0 },
    { id: "2", category: "materials", chapterRef: null, label: "Underlay", plannedCents: 32_000, sortOrder: 1 },
    { id: "3", category: "labour", chapterRef: null, label: "", plannedCents: 54_000, sortOrder: 2 },
  ] } as unknown as JobDetail;
  const rows = budgetRows(detail);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[0], { category: "materials", cents: 82_000, note: "Vinyl plank, Underlay" });
  assert.deepEqual(rows[1], { category: "labour", cents: 54_000, note: "" });
  assert.equal(rows[2]!.cents, 0);
});

test("the save body keeps server ids, links the payment term and leaves out empty categories", () => {
  const body = setupBody({
    name: "  Hallway flooring ", plannedStart: "2026-10-05",
    milestones: [{ ...newMilestone("New milestone", "k"), start: "2026-10-05", end: "2026-10-05" }, { ...ms(2, { id: "abc", title: "Lay plank", start: "2026-10-06", end: "2026-10-07", valueCents: 1000, term: { id: "t1", label: "Progress", amountCents: 88_400 } }) }],
    budget: [{ category: "materials", cents: 82_000, note: "Vinyl" }, { category: "labour", cents: 0, note: "" }],
  });
  assert.equal(body.name, "Hallway flooring");
  assert.equal("id" in body.milestones[0]!, false);
  assert.equal(body.milestones[1]!.id, "abc");
  assert.equal(body.milestones[1]!.paymentTermId, "t1");
  assert.equal(body.milestones[0]!.paymentTermId, null);
  assert.deepEqual(body.budget, [{ category: "materials", label: "Vinyl", plannedCents: 82_000 }]);
});
