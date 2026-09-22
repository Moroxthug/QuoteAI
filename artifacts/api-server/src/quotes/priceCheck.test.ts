// Phase 79 — the quote price check: name/unit matching against catalog and
// learned receipt prices, the ≥ 5 % threshold, and the reprice recompute.
import assert from "node:assert/strict";
import { test } from "vitest";
import { nameTokens, matchScore, normalizeUnit, learnedReferences, priceCheckChapters, repriceChapters, type PriceReference } from "./priceCheck.js";

test("priceCheck — tokens, units", () => {
  assert.deepEqual([...nameTokens("Supply and install 2x4 SPF lumber, 8 ft")], ["2x4", "spf", "lumber"]);
  assert.deepEqual([...nameTokens("Pose de bardeaux d'asphalte")], ["bardeau", "asphalte"]);
  assert.equal(matchScore(nameTokens("Lumber 2x4"), nameTokens("lumber")), 1);
  assert.equal(matchScore(nameTokens("Drywall installation"), nameTokens("Drywall taping")), 1); // "installation" is a stopword → {drywall}
  assert.equal(matchScore(nameTokens("Kitchen cabinets"), nameTokens("Bathroom vanity")), 0);
  assert.equal(normalizeUnit("pi²"), "sqft");
  assert.equal(normalizeUnit("Sq. Ft."), "sqft");
  assert.equal(normalizeUnit("heures"), "hr");
  assert.equal(normalizeUnit("Forfait"), "lot");
  assert.equal(normalizeUnit("cad"), "ea");
  assert.equal(normalizeUnit(null), "");
});

test("priceCheck — learned references need 3 samples, average the latest 5, keep the top vendor", () => {
  const rows = [
    { workType: "Lumber 2x4", unitPrice: "6.00", unit: "ea", vendor: "Home Depot" },
    { workType: "lumber 2x4", unitPrice: "5.80", unit: "ea", vendor: "Rona" },
    { workType: "Lumber 2x4 ", unitPrice: "6.20", unit: "ea", vendor: "Home Depot" },
    { workType: "Lumber 2x4", unitPrice: "5.00", unit: "ea", vendor: null },
    { workType: "Lumber 2x4", unitPrice: "5.00", unit: "ea", vendor: null },
    { workType: "Lumber 2x4", unitPrice: "1.00", unit: "ea", vendor: null }, // 6th, oldest → ignored
    { workType: "Drywall", unitPrice: "12", unit: "sheet", vendor: null },
    { workType: "Drywall", unitPrice: "13", unit: "sheet", vendor: null }, // only two → skipped
  ];
  const refs = learnedReferences(rows);
  assert.equal(refs.length, 1);
  assert.deepEqual(refs[0], { key: "receipts:lumber 2x4", name: "Lumber 2x4", unit: "ea", unitPrice: 5.6, source: "receipts", sampleCount: 5, vendor: "Home Depot" });
});

test("priceCheck — findings and reprice", () => {
  const refs: PriceReference[] = [
    { key: "catalog:1", name: "Lumber 2x4", unit: "ea", unitPrice: 5.0, source: "catalog", sampleCount: 1, vendor: null },
    { key: "receipts:lumber 2x4", name: "Lumber 2x4", unit: "ea", unitPrice: 5.4, source: "receipts", sampleCount: 4, vendor: "Rona" },
    { key: "catalog:2", name: 'Drywall 1/2" sheet', unit: "sheet", unitPrice: 14.0, source: "catalog", sampleCount: 1, vendor: null },
    { key: "catalog:3", name: "Painting", unit: "sqft", unitPrice: 2.5, source: "catalog", sampleCount: 1, vendor: null },
  ];
  const capitoli = [
    { lettera: "A", titolo: "Framing", subtotale: 0, voci: [
      { descrizione: "2x4 lumber, 8 ft", um: "ea", quantita: 100, prezzoUnitario: 5.0, totale: 500 }, // receipts avg 5.40 → +8 %
      { descrizione: 'Drywall sheets 1/2"', um: "sheet", quantita: 40, prezzoUnitario: 13.8, totale: 552 }, // catalog 14 → +1.4 %, under threshold
      { descrizione: "Painting walls", um: "hr", quantita: 10, prezzoUnitario: 60, totale: 600 }, // unit mismatch (hr vs sqft) → no match
      { descrizione: "Site cleanup", um: "lot", quantita: 1, prezzoUnitario: 300, totale: 300 }, // lump sum → skipped
      { descrizione: "Painting", um: "sqft", quantita: 200, prezzoUnitario: 3.0, totale: 600 }, // catalog 2.50 → −16.7 %
    ] },
  ];
  const check = priceCheckChapters(capitoli, refs, new Date("2026-09-21T12:00:00Z"));
  assert.equal(check.linesChecked, 5);
  assert.deepEqual(check.findings.map((f) => [f.chapter, f.index, f.source, f.referenceUnitPrice, f.changePct, f.deltaTotal, f.vendor]), [
    ["A", 0, "receipts", 5.4, 8, 40, "Rona"],
    ["A", 4, "catalog", 2.5, -16.7, -100, null],
  ]);
  assert.equal(check.deltaTotal, -60);

  // Reprice line 0 only; discount 10 %, tax 13 %. Totals recomputed from the lines.
  const r = repriceChapters(capitoli, [{ chapter: "A", index: 0, unitPrice: 5.4 }], 13, 10);
  assert.equal(r.applied, 1);
  assert.equal(r.capitoli[0]!.voci[0]!.totale, 540);
  assert.equal(r.capitoli[0]!.subtotale, 540 + 552 + 600 + 300 + 600);
  assert.equal(r.subtotale, 2592);
  assert.deepEqual(r.sconto, { percentuale: 10, importoScontato: 2332.8 });
  assert.equal(r.ivaValore, 303.26);
  assert.equal(r.totale, 2636.06);
  // No discount → sconto null, same price → nothing applied.
  const same = repriceChapters(capitoli, [{ chapter: "A", index: 0, unitPrice: 5.0 }], 0, 0);
  assert.equal(same.applied, 0);
  assert.equal(same.sconto, null);
  assert.equal(same.totale, 2552);
});
