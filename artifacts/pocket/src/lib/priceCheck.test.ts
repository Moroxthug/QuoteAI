import assert from "node:assert/strict";
import { test } from "node:test";
import { applyReferences, deltaTone, headlineOf, lineDelta, lineKey, marks, suggestions, totalWith, type CheckLine } from "./priceCheck.ts";
import type { Chapter } from "./quoteMath.ts";

const L = (o: Partial<CheckLine>): CheckLine => ({ chapter: "A", index: 0, description: "x", um: "sq ft", quantita: 10, quotedUnitPrice: 18, referenceUnitPrice: 20, referenceName: "x", source: "catalog", sampleCount: 0, changePct: 11.1, verdict: "low", ...o });
const caps = (): Chapter[] => [{ lettera: "A", titolo: "Work", subtotale: 0, voci: [{ descrizione: "a", um: "sq ft", quantita: 10, prezzoUnitario: 18, totale: 180 }, { descrizione: "b", um: "sq ft", quantita: 10, prezzoUnitario: 14, totale: 140 }] }];

test("suggestions are the low and high lines", () => {
  assert.deepEqual(suggestions([L({}), L({ index: 1, verdict: "high" }), L({ index: 2, verdict: "in_range" }), L({ index: 3, verdict: "no_data", referenceUnitPrice: null })]).map((l) => l.index), [0, 1]);
});

test("the change a line would make", () => {
  assert.equal(lineDelta(L({})), 20);
  assert.equal(lineDelta(L({ quotedUnitPrice: 14, referenceUnitPrice: 10, verdict: "high" })), -40);
  assert.equal(lineDelta(L({ referenceUnitPrice: null })), 0);
});

test("marks sit inside the bar and the band surrounds the reference", () => {
  const m = marks(18, 20, 5);
  for (const v of Object.values(m)) assert.ok(v >= 0 && v <= 100, `${v}`);
  assert.ok(m.bandLo < m.reference && m.reference < m.bandHi);
  assert.ok(m.you < m.bandLo); // 18 is below the 19 to 21 band
  const inside = marks(20.2, 20, 5);
  assert.ok(inside.you > inside.bandLo && inside.you < inside.bandHi);
});

test("applying references reprices only the chosen lines, never mutates", () => {
  const lines = [L({}), L({ index: 1, quotedUnitPrice: 14, referenceUnitPrice: 10, verdict: "high" })];
  const next = applyReferences(caps(), lines, new Set([lineKey(lines[0]!)]));
  assert.equal(next[0]!.voci[0]!.prezzoUnitario, 20);
  assert.equal(next[0]!.voci[1]!.prezzoUnitario, 14);
  assert.equal(caps()[0]!.voci[0]!.prezzoUnitario, 18);
});

test("the total with everything applied includes tax", () => {
  const lines = [L({}), L({ index: 1, quotedUnitPrice: 14, referenceUnitPrice: 10, verdict: "high" })];
  assert.equal(totalWith(caps(), lines, new Set(), 13, 0), 361.6);
  assert.equal(totalWith(caps(), lines, new Set(lines.map(lineKey)), 13, 0), 339); // (200 + 100) * 1.13
});

test("headline", () => {
  assert.equal(headlineOf({ loading: true, suggested: 3, applied: 0 }), "checking");
  assert.equal(headlineOf({ loading: false, suggested: 0, applied: 0 }), "allInRange");
  assert.equal(headlineOf({ loading: false, suggested: 3, applied: 3 }), "allApplied");
  assert.equal(headlineOf({ loading: false, suggested: 3, applied: 1 }), "toLook");
  assert.equal(deltaTone(5), "ok");
  assert.equal(deltaTone(-5), "bad");
  assert.equal(deltaTone(0), "muted");
});
