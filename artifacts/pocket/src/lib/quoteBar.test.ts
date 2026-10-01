import assert from "node:assert/strict";
import { test } from "node:test";
import { taxName, budgetFit, canAddClient, canBuild, clientDataOf, firstName, initialsFor, parseBudget, presetLabel, previewLines } from "./quoteBar.ts";

test("budget input", () => {
  assert.equal(parseBudget("12,500"), 12500);
  assert.equal(parseBudget("$5 000"), 5000);
  assert.equal(parseBudget(""), null);
  assert.equal(parseBudget("0"), null);
  assert.equal(parseBudget("123456789012"), 12345678);
});

test("preset labels", () => {
  assert.equal(presetLabel(2500, "en-CA"), "2.5k");
  assert.equal(presetLabel(10000, "en-CA"), "10k");
  assert.equal(presetLabel(2500, "fr-CA"), "2,5k");
});

test("fit against the budget", () => {
  assert.deepEqual(budgetFit(4926, 5000), { ratio: 4926 / 5000, over: false, diff: 74 });
  const over = budgetFit(5300, 5000);
  assert.equal(over.over, true);
  assert.equal(over.ratio, 1);
  assert.equal(over.diff, 300);
});

test("names", () => {
  assert.equal(initialsFor("Dana Whitfield"), "DW");
  assert.equal(initialsFor("Tom & Lena Hart"), "TL");
  assert.equal(initialsFor("Harbourfront"), "H");
  assert.equal(firstName("Dana Whitfield"), "Dana");
});

test("a job needs words", () => {
  assert.equal(canBuild("   "), false);
  assert.equal(canBuild("repaint two bedrooms"), true);
});

test("a new client", () => {
  const c = { name: " Jordan Leblanc ", phone: "", email: "j@x.ca", address: " 4 Main St " };
  assert.deepEqual(clientDataOf(c), { nome: "Jordan Leblanc", indirizzo: "4 Main St", email: "j@x.ca" });
  assert.equal(canAddClient(c), true);
  assert.equal(canAddClient({ ...c, name: " " }), false);
});

test("preview lines come from chapters, else items", () => {
  assert.deepEqual(previewLines({ capitoli: [{ titolo: "Paint", subtotale: 100 }], items: [{ descrizione: "x", totale: 1 }] }), [{ name: "Paint", amount: 100 }]);
  assert.deepEqual(previewLines({ capitoli: [], items: [{ descrizione: "x", totale: 1 }] }), [{ name: "x", amount: 1 }]);
});

test("tax names", () => {
  assert.equal(taxName("ON"), "HST");
  assert.equal(taxName("qc"), "GST + QST");
  assert.equal(taxName("BC"), "GST + PST");
  assert.equal(taxName("AB"), "GST");
  assert.equal(taxName(null), null);
});
