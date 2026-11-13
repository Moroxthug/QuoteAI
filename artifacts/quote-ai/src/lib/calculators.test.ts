import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, salesTax, holdback, priceFrom, marginFromMarkup, markupFromMargin, labourRate } from "./calculators";

test("parseAmount reads English and French numbers", () => {
  assert.equal(parseAmount("1,250.50", "en"), 1250.5);
  assert.equal(parseAmount("$1250", "en"), 1250);
  assert.equal(parseAmount("1 250,50", "fr"), 1250.5);
  assert.equal(parseAmount("1 250,50 $", "fr"), 1250.5);
  assert.equal(parseAmount("12 %", "en"), 12);
  assert.equal(parseAmount("12.5", "fr"), 12.5);
  assert.equal(parseAmount("", "en"), null);
  assert.equal(parseAmount("abc", "en"), null);
});

test("salesTax adds Ontario HST and Quebec GST + QST", () => {
  const on = salesTax(10000, "ON", "add");
  assert.deepEqual(on.lines.map((l) => l.amount), [1300]);
  assert.equal(on.total, 11300);
  const qc = salesTax(10000, "QC", "add");
  assert.deepEqual(qc.lines.map((l) => [l.code, l.amount]), [["GST", 500], ["QST", 997.5]]);
  assert.equal(qc.total, 11497.5);
});

test("salesTax extracts tax from a tax-included total, lines add up", () => {
  const qc = salesTax(11497.5, "QC", "extract");
  assert.equal(qc.subtotal, 10000);
  assert.equal(qc.tax, 1497.5);
  for (const total of [99.99, 1234.56, 57.01]) {
    for (const p of ["BC", "QC", "ON", "AB", "SK"] as const) {
      const r = salesTax(total, p, "extract");
      const sum = Math.round((r.subtotal + r.lines.reduce((s, l) => s + l.amount, 0)) * 100) / 100;
      assert.equal(sum, total, `${p} ${total}`);
    }
  }
});

test("holdback keeps 10 % back and taxes it on release", () => {
  const r = holdback(50000, 10, 13);
  assert.equal(r.holdback, 5000);
  assert.equal(r.net, 45000);
  assert.equal(r.taxNow, 5850);
  assert.equal(r.payableNow, 50850);
  assert.equal(r.taxOnRelease, 650);
  assert.equal(r.releaseTotal, 5650);
});

test("markup and margin", () => {
  const m = priceFrom(1000, 25, "markup")!;
  assert.equal(m.price, 1250);
  assert.equal(Math.round(m.marginPct * 100) / 100, 20);
  const g = priceFrom(1000, 20, "margin")!;
  assert.equal(g.price, 1250);
  assert.equal(priceFrom(1000, 100, "margin"), null);
  assert.equal(marginFromMarkup(25), 20);
  assert.equal(markupFromMargin(20), 25);
});

test("labourRate", () => {
  const r = labourRate({ salary: 70000, overhead: 25000, hoursPerWeek: 30, weeks: 46, marginPct: 15 })!;
  assert.equal(r.billableHours, 1380);
  assert.equal(r.breakEven, 68.84);
  assert.equal(r.rate, 80.99);
  assert.equal(labourRate({ salary: 1, overhead: 1, hoursPerWeek: 0, weeks: 46, marginPct: 0 }), null);
});
