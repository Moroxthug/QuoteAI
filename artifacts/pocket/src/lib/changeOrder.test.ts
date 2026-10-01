import assert from "node:assert/strict";
import { test } from "node:test";
import { canWrite, contractNow, itemsOf, lineTotal, linesOf, proposalLines, stepOf, subtotal, type Line } from "./changeOrder.ts";

const line = (o: Partial<Line> = {}): Line => ({ key: "a", description: "LED pot lights", qty: 4, unit: "ea", unitPrice: 42, ...o });

test("a line is quantity times price, rounded to the cent", () => {
  assert.equal(lineTotal(line()), 168);
  assert.equal(lineTotal(line({ qty: 5.5, unitPrice: 95 })), 522.5);
  assert.equal(lineTotal(line({ qty: 3, unitPrice: 0.335 })), 1.01);
  assert.equal(subtotal([line(), line({ qty: 1, unitPrice: 46 })]), 214);
});

test("the step follows where the change order stands", () => {
  assert.equal(stepOf(null), "describe");
  assert.equal(stepOf({ status: "draft" }), "review");
  assert.equal(stepOf({ status: "sent" }), "sent");
  assert.equal(stepOf({ status: "declined" }), "sent");
  assert.equal(stepOf({ status: "voided" }), "sent");
  assert.equal(stepOf({ status: "signed" }), "signed");
});

test("items sent to the server drop blank lines and carry the line total", () => {
  const items = itemsOf([line(), line({ key: "b", description: "  " })]);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], { descrizione: "LED pot lights", um: "ea", quantita: 4, prezzoUnitario: 42, totale: 168 });
});

test("lines come back from a saved change order", () => {
  const back = linesOf({ items: [{ descrizione: "Dimmer", um: "", quantita: 1, prezzoUnitario: 46, totale: 46 }] });
  assert.deepEqual(back.map((l) => [l.description, l.qty, l.unitPrice]), [["Dimmer", 1, 46]]);
});

test("an assistant proposal becomes a title, days and lines; unusable ones are ignored", () => {
  const p = proposalLines({ title: "Pot lights", description: "Four lights", scheduleDeltaDays: 1, items: [{ descrizione: "Lights", um: "ea", quantita: 4, prezzoUnitario: 42, totale: 168 }, { descrizione: "Bad", prezzoUnitario: "x" }] });
  assert.equal(p?.title, "Pot lights");
  assert.equal(p?.days, 1);
  assert.equal(p?.lines.length, 1);
  assert.equal(proposalLines({ items: [] }), null);
  assert.equal(proposalLines(null), null);
});

test("the contract before and after, whether or not it is signed yet", () => {
  assert.deepEqual(contractNow(4_235_500, { status: "draft", totalCents: 112_000 }), { now: 4_235_500, after: 4_347_500 });
  assert.deepEqual(contractNow(4_347_500, { status: "signed", totalCents: 112_000 }), { now: 4_235_500, after: 4_347_500 });
});

test("it can be written with a title and one priced line", () => {
  assert.equal(canWrite("Pot lights", [line()]), true);
  assert.equal(canWrite("", [line()]), false);
  assert.equal(canWrite("x", []), false);
  assert.equal(canWrite("x", [line({ description: "" })]), false);
});
