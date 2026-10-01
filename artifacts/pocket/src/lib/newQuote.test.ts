import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addManualLine, bodyChapters, canAddNewClient, canSaveManual, canWrite, categoriesOf, clientDataFor, defaultQty, EXAMPLES, filterCatalog, manualBody, manualTotals, newManualChapter,
  newClientBody, newClientData, nextProgress, parseTarget, postalCode, provinceCode, qtyStep, removeManualLine, renameManualChapter, selectionChapter, selectionOf, startProvince, stepChosen,
  stepStates, summaryOf, taxKey, taxRate, templateIdOf, termLines, toggleChosen, editManualLine, EMPTY_CLIENT, type CatalogRow, type ManualChapter,
} from "./newQuote.ts";

const rows: CatalogRow[] = [
  { id: "a", nome: "Interior walls, two coats", categoria: "Painting", um: "sq ft", prezzoUnitario: 2.1 },
  { id: "b", nome: "Floor protection and cleanup", categoria: "Site", um: "lump sum", prezzoUnitario: 180 },
  { id: "c", nome: "Ceilings, two coats", categoria: "painting", um: "sq ft", prezzoUnitario: 1.65 },
  { id: "d", nome: "Skim coat", categoria: null, um: "sq ft", prezzoUnitario: 1.4 },
];

test("seven examples, three layouts mapped to the server's templates", () => {
  assert.equal(EXAMPLES.length, 7);
  assert.equal(templateIdOf("standard"), "standard");
  assert.equal(templateIdOf("professional"), "arosio");
  assert.equal(templateIdOf("elegant"), "mariagrazia");
});

test("a description needs something other than spaces; the target is whole dollars", () => {
  assert.equal(canWrite("  \n "), false);
  assert.equal(canWrite("Repaint 3 bedrooms"), true);
  assert.equal(parseTarget("$4,500"), 4500);
  assert.equal(parseTarget(""), null);
});

test("the writing steps tick forward while pending, wait on the last, and finish when settled", () => {
  assert.equal(nextProgress(0, false), 1);
  assert.equal(nextProgress(1, false), 2);
  assert.equal(nextProgress(5, false), 5);
  assert.equal(nextProgress(3, true), 6);
  assert.deepEqual(stepStates(0), ["todo", "todo", "todo", "todo", "todo"]);
  assert.deepEqual(stepStates(3), ["done", "done", "cur", "todo", "todo"]);
  assert.deepEqual(stepStates(6), ["done", "done", "done", "done", "done"]);
});

test("the summary names the quote, counts lines and chapters", () => {
  const s = summaryOf({ titoloPreventivoRiga1: "Project Quote & Itemized Estimate", titoloPreventivoRiga2: "Bedrooms and bath ceiling", numeroPreventivoData: "Q-2026-119", totale: 4131.05, capitoli: [{ voci: [{}, {}, {}] }, { voci: [{}, {}] }] });
  assert.deepEqual(s, { title: "Bedrooms and bath ceiling", lines: 5, chapters: 2, number: "Q-2026-119", total: 4131.05 });
  assert.equal(summaryOf({ titoloPreventivoRiga1: "Deck", items: [{}, {}] }).title, "Deck");
  assert.equal(summaryOf({ titoloPreventivoRiga1: "Deck", items: [{}, {}] }).lines, 2);
  assert.equal(summaryOf({ descrizioneGenerale: "Paint the hall. Two coats." }).title, "Paint the hall.");
});

test("provinces: codes, the starting one, the tax words and the rate", () => {
  assert.equal(provinceCode("qc"), "QC");
  assert.equal(provinceCode("Ontario"), null);
  assert.equal(startProvince("Ontario", "BC"), "BC");
  assert.equal(startProvince("AB", "BC"), "AB");
  assert.equal(startProvince(null, undefined), "ON");
  assert.equal(taxKey("ON"), "hst");
  assert.equal(taxKey("QC"), "gstQst");
  assert.equal(taxKey("BC"), "gstPst");
  assert.equal(taxKey("MB"), "gstRst");
  assert.equal(taxKey("AB"), "gst");
  assert.equal(taxRate("ON", false), 13);
  assert.equal(taxRate("ON", true), 0);
});

const chapters = (): ManualChapter[] => {
  let c = [newManualChapter("c1", "l1", "Preparation")];
  c = editManualLine(c, 0, 0, "description", "Floor protection");
  c = editManualLine(c, 0, 0, "um", "lump sum");
  c = editManualLine(c, 0, 0, "prezzoUnitario", "180");
  c = addManualLine(c, 0, "l2");
  c = editManualLine(c, 0, 1, "description", "Primer");
  c = editManualLine(c, 0, 1, "quantita", "48");
  c = editManualLine(c, 0, 1, "prezzoUnitario", "1,85");
  return c;
};

test("manual lines: edits parse numbers, totals are to the cent and tax follows the rate", () => {
  const c = chapters();
  assert.equal(c[0]!.lines[1]!.prezzoUnitario, 1.85);
  const t = manualTotals(c, 13);
  assert.deepEqual(t.lineTotals, [[180, 88.8]]);
  assert.equal(t.subtotale, 268.8);
  assert.equal(t.ivaValore, 34.94);
  assert.equal(t.totale, 303.74);
  assert.equal(manualTotals(c, 0).totale, 268.8);
});

test("manual lines: add, remove, rename; blank lines do not make a quote", () => {
  assert.equal(canSaveManual([newManualChapter("c", "l")]), false);
  const c = chapters();
  assert.equal(canSaveManual(c), true);
  assert.equal(removeManualLine(c, 0, 0)[0]!.lines.length, 1);
  assert.equal(renameManualChapter(c, 0, "Work")[0]!.title, "Work");
  const withBlank = addManualLine(c, 0, "l3");
  assert.equal(bodyChapters(withBlank)[0]!.voci.length, 2);
  assert.equal(bodyChapters([newManualChapter("x", "y")]).length, 0);
  assert.equal(bodyChapters(c)[0]!.lettera, "A");
  assert.equal(bodyChapters(c)[0]!.subtotale, 268.8);
});

test("manual body: the chapters, the client, the title, the exempt rate, the terms", () => {
  const b = manualBody({ title: " Bedrooms ", chapters: chapters(), clientData: { nome: "Dana", indirizzo: "17 Castle Frank" }, province: "ON", exempt: false, terms: "deposit30", notes: "", templateId: "standard" });
  assert.equal(b.titoloPreventivoRiga1, "Bedrooms");
  assert.equal(b.province, "ON");
  assert.equal("ivaPercentuale" in b, false);
  assert.deepEqual(b.condizioniPagamento, ["30% deposit on signing", "70% on completion"]);
  assert.equal("note" in b, false);
  assert.equal(b.capitoli[0]!.voci[0]!.totale, 180);
  const x = manualBody({ title: "", chapters: chapters(), province: "QC", exempt: true, terms: "net15", notes: " Park in the back " });
  assert.equal(x.ivaPercentuale, 0);
  assert.equal("titoloPreventivoRiga1" in x, false);
  assert.equal("clientData" in x, false);
  assert.equal(x.note, "Park in the back");
  assert.deepEqual(termLines("half"), ["50% on signing", "50% on completion"]);
});

test("client: the form needs a name; postal codes are tidied; clientData and the client body", () => {
  assert.equal(canAddNewClient(EMPTY_CLIENT), false);
  assert.equal(postalCode("m4w2z9"), "M4W 2Z9");
  assert.equal(postalCode("abc"), "ABC");
  const f = { ...EMPTY_CLIENT, name: " Priya Nair ", address: "212 Dovercourt Rd", city: "Toronto", province: "ON" as const, postalCode: "m6h3k2", phone: "(416) 555-0100" };
  assert.deepEqual(newClientData(f), { nome: "Priya Nair", indirizzo: "212 Dovercourt Rd", city: "Toronto", province: "ON", postalCode: "M6H 3K2", phone: "(416) 555-0100" });
  assert.deepEqual(newClientBody(f), { name: "Priya Nair", address: "212 Dovercourt Rd", city: "Toronto", province: "ON", postalCode: "M6H 3K2", phone: "(416) 555-0100" });
  assert.deepEqual(clientDataFor(null, f), newClientData(f));
  assert.deepEqual(clientDataFor({ id: "1", name: "Dana", data: { nome: "Dana Whitfield", email: "d@x.ca" } }, null), { indirizzo: "", nome: "Dana Whitfield", email: "d@x.ca" });
  assert.equal(clientDataFor(null, null), undefined);
  assert.equal(clientDataFor(null, EMPTY_CLIENT), undefined);
});

test("price list: categories once each, search and category filter", () => {
  assert.deepEqual(categoriesOf(rows), ["Painting", "Site"]);
  assert.deepEqual(filterCatalog(rows, "", null).map((r) => r.id), ["a", "b", "c", "d"]);
  assert.deepEqual(filterCatalog(rows, "", "painting").map((r) => r.id), ["a", "c"]);
  assert.deepEqual(filterCatalog(rows, "coat", null).map((r) => r.id), ["a", "c", "d"]);
  assert.deepEqual(filterCatalog(rows, "painting ceil", null).map((r) => r.id), []);
  assert.deepEqual(filterCatalog(rows, "walls", "Site").map((r) => r.id), []);
});

test("price list: area starts at 100 by 20, a lump sum at 1 by 1", () => {
  assert.equal(defaultQty("sq ft"), 100);
  assert.equal(qtyStep("sq ft"), 20);
  assert.equal(defaultQty("lump sum"), 1);
  assert.equal(defaultQty("each"), 1);
  assert.equal(defaultQty("hr"), 1);
  assert.equal(qtyStep("ln ft"), 20);
  assert.equal(qtyStep("ea"), 1);
});

test("price list: add toggles, the stepper never goes below one step, the total is before tax", () => {
  let sel = toggleChosen([], rows[0]!);
  sel = toggleChosen(sel, rows[1]!);
  assert.deepEqual(sel, [{ id: "a", qty: 100 }, { id: "b", qty: 1 }]);
  sel = stepChosen(sel, rows[0]!, 1);
  assert.equal(sel[0]!.qty, 120);
  sel = stepChosen(stepChosen(sel, rows[0]!, -1), rows[0]!, -1);
  assert.equal(sel[0]!.qty, 80);
  for (let i = 0; i < 10; i++) sel = stepChosen(sel, rows[0]!, -1);
  assert.equal(sel[0]!.qty, 20);
  const s = selectionOf(sel, rows);
  assert.equal(s.subtotal, 222);
  assert.deepEqual(s.rows.map((r) => r.total), [42, 180]);
  assert.equal(toggleChosen(sel, rows[0]!).length, 1);
  assert.equal(selectionOf([{ id: "gone", qty: 1 }], rows).rows.length, 0);
  const ch = selectionChapter(s.rows, "Scope", "c");
  assert.equal(ch.lines.length, 2);
  assert.equal(ch.lines[0]!.description, "Interior walls, two coats");
  assert.equal(manualTotals([ch], 0).subtotale, 222);
});
