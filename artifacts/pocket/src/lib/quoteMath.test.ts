import assert from "node:assert/strict";
import { test } from "node:test";
import { canToggleDeposit, defaultChannel, depositAmount, depositTerm, isFixed, maskEmail, maskPhone, recompute, setLineQuantity, stepOf, stepQuantity, toggleDeposit, validEmail, validPhone, type Chapter, type Schedule } from "./quoteMath.ts";

const caps: Chapter[] = [
  { lettera: "A", titolo: "Painting", subtotale: 0, voci: [{ descrizione: "Walls", um: "sq ft", quantita: 1120, prezzoUnitario: 2.1, totale: 0 }, { descrizione: "Repair", um: "lot", quantita: 1, prezzoUnitario: 640, totale: 0 }] },
  { lettera: "B", titolo: "Prep", subtotale: 0, voci: [{ descrizione: "Primer", um: "sq ft", quantita: 48, prezzoUnitario: 1.85, totale: 0 }] },
];

test("totals round every line and chapter to the cent, then tax", () => {
  const t = recompute(caps, 13);
  assert.equal(t.capitoli[0]!.voci[0]!.totale, 2352);
  assert.equal(t.capitoli[0]!.subtotale, 2992);
  assert.equal(t.capitoli[1]!.subtotale, 88.8);
  assert.equal(t.subtotale, 3080.8);
  assert.equal(t.ivaValore, 400.5);
  assert.equal(t.totale, 3481.3);
  assert.equal(t.sconto, null);
});

test("a discount comes off before tax", () => {
  const t = recompute(caps, 13, 10);
  assert.equal(t.imponibile, 2772.72);
  assert.equal(t.ivaValore, 360.45);
  assert.equal(t.totale, 3133.17);
  assert.deepEqual(t.sconto, { percentuale: 10, importoScontato: 2772.72 });
});

test("lump sums are fixed, measured lines are not", () => {
  assert.ok(isFixed({ um: "lot", quantita: 1 }));
  assert.ok(isFixed({ um: "", quantita: 1 }));
  assert.ok(isFixed({ um: "ea", quantita: 1 }));
  assert.ok(!isFixed({ um: "ea", quantita: 4 }));
  assert.ok(!isFixed({ um: "sq ft", quantita: 1120 }));
});

test("the stepper moves about a fiftieth, on a round number", () => {
  assert.equal(stepOf(1120, "sq ft"), 25);
  assert.equal(stepOf(48, "sq ft"), 1);
  assert.equal(stepOf(4, "ea"), 1);
  assert.equal(stepOf(0.2, "m"), 0.5);
  const v = caps[0]!.voci[0]!;
  assert.equal(stepQuantity(v, 1), 1145);
  assert.equal(stepQuantity({ ...v, quantita: 0.5, um: "m" }, -1), 0);
  assert.equal(setLineQuantity(caps, 0, 0, 1000)[0]!.voci[0]!.quantita, 1000);
  assert.equal(setLineQuantity(caps, 0, 0, -5)[0]!.voci[0]!.quantita, 0);
  assert.equal(caps[0]!.voci[0]!.quantita, 1120); // not mutated
});

const schedule = (): Schedule => ({
  currency: "CAD", derived: true, holdback: { enabled: false, percent: 10 },
  terms: [
    { id: "t1", type: "deposit", label: "Deposit", trigger: "on_signing", amountType: "percent", value: 30, dueDays: 0 },
    { id: "t2", type: "milestone", label: "Start", trigger: "milestone", amountType: "percent", value: 40, dueDays: 15 },
    { id: "t3", type: "completion", label: "Final", trigger: "on_completion", amountType: "percent", value: 30, dueDays: 15 },
  ],
});

test("deposit off gives its percent to the last term, on takes 30 back off it", () => {
  const s = schedule();
  assert.equal(depositTerm(s)?.value, 30);
  const off = toggleDeposit(s, "n", "Deposit");
  assert.equal(depositTerm(off), null);
  assert.deepEqual(off.terms.map((t) => [t.id, t.value]), [["t2", 40], ["t3", 60]]);
  assert.equal(off.derived, false);
  const on = toggleDeposit(off, "n2", "Deposit on acceptance");
  assert.deepEqual(on.terms.map((t) => [t.id, t.value]), [["n2", 30], ["t2", 40], ["t3", 30]]);
  assert.equal(on.terms.reduce((n, t) => n + t.value, 0), 100);
  assert.equal(on.terms[0]!.trigger, "on_signing");
});

test("a deposit bigger than the last term takes only what is left", () => {
  const s: Schedule = { ...schedule(), terms: [{ id: "a", type: "milestone", label: "A", trigger: "milestone", amountType: "percent", value: 90, dueDays: 0 }, { id: "b", type: "completion", label: "B", trigger: "on_completion", amountType: "percent", value: 10, dueDays: 0 }] };
  const on = toggleDeposit(s, "n", "Deposit");
  assert.deepEqual(on.terms.map((t) => [t.id, t.value]), [["n", 10], ["a", 90]]);
});

test("the switch needs an all-percent schedule", () => {
  assert.ok(canToggleDeposit(schedule()));
  assert.ok(!canToggleDeposit(null));
  const fixed = schedule();
  fixed.terms[1]!.amountType = "fixed";
  assert.ok(!canToggleDeposit(fixed));
});

test("due on acceptance", () => {
  assert.equal(depositAmount(schedule(), 3481.3), 1044.39);
  assert.equal(depositAmount(toggleDeposit(schedule(), "n", "d"), 100), null);
});

test("sending", () => {
  assert.equal(maskEmail("dana.whitfield@rogers.com"), "dana.w@…");
  assert.equal(maskPhone("(647) 555-0121"), "… 0121");
  assert.equal(defaultChannel("a@b.ca", "6475550121", true), "email");
  assert.equal(defaultChannel("", "6475550121", true), "sms");
  assert.equal(defaultChannel("", "6475550121", false), "email");
  assert.ok(validEmail("a@b.ca"));
  assert.ok(!validEmail("a@b"));
  assert.ok(validPhone("(647) 555-0121"));
  assert.ok(validPhone("+1 647 555 0121"));
  assert.ok(!validPhone("555-0121"));
});
