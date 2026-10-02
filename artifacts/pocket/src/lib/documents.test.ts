import test from "node:test";
import assert from "node:assert/strict";
import { cheapest, chartPoints, clip, directionOf, foldersOf, isEmpty, isUploadable, keepValue, keptThisMonth, monthLabels, movePercent, sinceMonth, type DocumentsOverview } from "./documents.ts";

const base: DocumentsOverview = { canUpload: true, files: 0, readThisMonth: 0, trend: null, almost: null, materials: [], docs: [], folders: [], company: 0, fileUnder: [] };

test("nothing read yet is the empty state", () => {
  assert.equal(isEmpty(base), true);
  assert.equal(isEmpty({ ...base, docs: [{ id: "1", name: "Kent", fileName: "k.jpg", at: "2026-09-24", state: "read", prices: 3, unread: 0, changed: 0, projectId: null, projectName: null, kind: "receipt" }] }), false);
});

test("a move is said without its sign, by the locale", () => {
  assert.match(movePercent(8.4, "en-CA"), /^8\s?%$/);
  assert.match(movePercent(-3.1, "fr-CA"), /^3\s%$/);
  assert.equal(directionOf(8), "up");
  assert.equal(directionOf(-3), "down");
  assert.equal(directionOf(0.01), "flat");
});

test("the chart puts the latest point last and keeps a flat line level", () => {
  const c = chartPoints([18.4, 18.4, 18.75, 19.95]);
  assert.equal(c.line.length, 4);
  assert.equal(c.last[0], 316);
  assert.equal(c.last[1], 4);
  assert.equal(c.line[0]![1], 60);
  assert.deepEqual(chartPoints([5, 5, 5]).line.map((p) => p[1]), [32, 32, 32]);
  assert.equal(chartPoints([7]).line.length, 2);
});

test("the chart's months end with this one", () => {
  const labels = monthLabels(new Date(2026, 8, 30), "en-CA");
  assert.equal(labels.length, 6);
  assert.equal(labels[0], "Apr");
  assert.equal(labels[5], "Sep");
  assert.equal(sinceMonth(new Date(2026, 8, 30), "en-CA"), "April");
});

test("the cheapest store is marked only when it stands alone", () => {
  const s = (name: string, price: number) => ({ name, at: "2026-09-01", price });
  assert.equal(cheapest([s("A", 19.95), s("B", 19.1), s("C", 20.4)]), "B");
  assert.equal(cheapest([s("A", 19.95)]), null);
  assert.equal(cheapest([s("A", 19), s("B", 19)]), null);
});

test("a kept price waits until next month", () => {
  const now = new Date(2026, 8, 30);
  assert.equal(keptThisMonth(keepValue(now), now), true);
  assert.equal(keptThisMonth(keepValue(now), new Date(2026, 9, 1)), false);
  assert.equal(keptThisMonth(null, now), false);
});

test("Company is a folder only when something is not filed under a job", () => {
  assert.equal(foldersOf({ folders: [{ id: "j", name: "Basement", clientName: "Hart", count: 3 }], company: 0 }).length, 1);
  const f = foldersOf({ folders: [], company: 4 });
  assert.equal(f[0]!.key, "company");
  assert.equal(f[0]!.count, 4);
});

test("only what the receipt reader takes can be uploaded", () => {
  assert.equal(isUploadable("application/pdf"), true);
  assert.equal(isUploadable("image/png"), true);
  assert.equal(isUploadable("application/vnd.ms-excel"), false);
});

test("a long job name is cut for its chip", () => {
  assert.equal(clip("Powder room"), "Powder room");
  const c = clip("Two bedrooms and the bath ceiling, 2 coats – 212 Dovercourt Rd");
  assert.equal(c.length, 26);
  assert.ok(c.endsWith("…"));
});
