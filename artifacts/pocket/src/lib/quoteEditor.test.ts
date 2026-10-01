import assert from "node:assert/strict";
import { test } from "node:test";
import { addLine, canSend, deltaFrom, editLine, flagsOf, lineCount, moveLineUp, newLine, normalizeSchedule, parseAmount, removeLine, scheduleView, segments, stepTerm, toggleHoldback } from "./quoteEditor.ts";
import type { Chapter, Schedule } from "./quoteMath.ts";

const v = (d: string, q = 1, p = 10) => ({ descrizione: d, um: "ea", quantita: q, prezzoUnitario: p, totale: q * p });
const caps = (): Chapter[] => [
  { lettera: "A", titolo: "Prep", subtotale: 0, voci: [v("a"), v("b"), v("c")] },
  { lettera: "B", titolo: "Tile", subtotale: 0, voci: [v("d")] },
];

test("amounts read with comma or dot decimals", () => {
  assert.equal(parseAmount("18.5"), 18.5);
  assert.equal(parseAmount("18,50"), 18.5);
  assert.equal(parseAmount("$1,234.50"), 1234.5);
  assert.equal(parseAmount("1.234,50"), 1234.5);
  assert.equal(parseAmount("1 234,50"), 1234.5);
  assert.equal(parseAmount(""), 0);
  assert.equal(parseAmount("abc"), 0);
});

test("editing a line changes only that line and never goes below zero", () => {
  const next = editLine(caps(), 0, 1, "quantita", 4);
  assert.equal(next[0]!.voci[1]!.quantita, 4);
  assert.equal(next[0]!.voci[0]!.quantita, 1);
  assert.equal(editLine(caps(), 0, 0, "prezzoUnitario", -3)[0]!.voci[0]!.prezzoUnitario, 0);
  assert.equal(editLine(caps(), 0, 0, "descrizione", "Renamed")[0]!.voci[0]!.descrizione, "Renamed");
  assert.equal(caps()[0]!.voci[1]!.quantita, 1);
});

test("a line moves up inside its chapter only", () => {
  assert.deepEqual(moveLineUp(caps(), 0, 2)[0]!.voci.map((x) => x.descrizione), ["a", "c", "b"]);
  assert.deepEqual(moveLineUp(caps(), 0, 0)[0]!.voci.map((x) => x.descrizione), ["a", "b", "c"]);
  assert.deepEqual(moveLineUp(caps(), 1, 0)[1]!.voci.map((x) => x.descrizione), ["d"]);
});

test("a line is added to the last chapter, a quote with none gets one, an emptied chapter goes", () => {
  assert.deepEqual(addLine(caps(), newLine({ descrizione: "x" }))[1]!.voci.map((x) => x.descrizione), ["d", "x"]);
  const fresh = addLine([], newLine({ descrizione: "x" }), "Work");
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0]!.titolo, "Work");
  assert.equal(removeLine(caps(), 1, 0).length, 1);
  assert.equal(lineCount(caps()), 4);
});

test("price flags: reference above the quote is low, below is high", () => {
  assert.deepEqual(flagsOf([{ chapter: "A", index: 0, changePct: 8, deltaTotal: 5 }, { chapter: "B", index: 2, changePct: -12, deltaTotal: -3 }]), { "A:0": "low", "B:2": "high" });
});

const sched = (): Schedule => ({
  currency: "CAD", derived: true, holdback: { enabled: false, percent: 10 },
  terms: [
    { id: "d", type: "deposit", label: "Deposit", trigger: "on_signing", amountType: "percent", value: 30, dueDays: 0 },
    { id: "m", type: "milestone", label: "Tile set", trigger: "milestone", amountType: "percent", value: 30, dueDays: 15 },
    { id: "f", type: "completion", label: "Completion", trigger: "on_completion", amountType: "percent", value: 40, dueDays: 15 },
  ],
});

test("the schedule view: the last term takes what is left, to the cent", () => {
  const view = scheduleView(sched(), 1000.01);
  assert.deepEqual(view.rows.map((r) => [r.id, r.pct, r.editable, r.rest]), [["d", 30, true, false], ["m", 30, true, false], ["f", 40, false, true]]);
  assert.equal(view.rows.reduce((n, r) => n + r.cents, 0), 100001);
  assert.equal(view.over, false);
});

test("steppers move 5 points and the rest follows; over 100% is flagged and blocks sending", () => {
  let s = stepTerm(sched(), "d", 1);
  assert.equal(s.terms[0]!.value, 35);
  assert.equal(scheduleView(s, 100).restPct, 35);
  s = stepTerm(stepTerm(stepTerm(sched(), "d", 1, 80), "d", 1, 80), "m", 1, 80);
  for (let i = 0; i < 12; i++) s = stepTerm(s, "m", 1, 80);
  const view = scheduleView(s, 100);
  assert.equal(view.over, true);
  assert.equal(canSend(s, 100), false);
  assert.equal(canSend(sched(), 100), true);
  assert.equal(canSend(null, 100), true);
  assert.deepEqual(stepTerm(sched(), "f", 1), sched()); // the last term has no stepper
  assert.equal(stepTerm(sched(), "d", -1).terms[0]!.value, 25);
  let low = sched(); for (let i = 0; i < 10; i++) low = stepTerm(low, "d", -1);
  assert.equal(low.terms[0]!.value, 0);
});

test("normalising writes the last term so the percents add to 100", () => {
  const s = normalizeSchedule(stepTerm(sched(), "d", 1));
  assert.deepEqual(s.terms.map((t) => t.value), [35, 30, 35]);
});

test("holdback toggles and shows its cents", () => {
  const on = toggleHoldback(sched());
  assert.equal(on.holdback.enabled, true);
  assert.equal(scheduleView(on, 1000).holdbackCents, 10000);
  assert.equal(scheduleView(sched(), 1000).holdbackCents, 0);
  assert.deepEqual(segments(scheduleView(on, 1000)).map((x) => x.id), ["d", "m", "f", "holdback"]);
});

test("the change from the first total", () => {
  assert.equal(deltaFrom(1865.1, 1865.1), 0);
  assert.equal(deltaFrom(1934.5, 1865.1), 69.4);
});
