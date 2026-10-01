import test from "node:test";
import assert from "node:assert/strict";
import { canSaveItem, costOf, countOf, FILTERS, groupsOf, marginPct, markOf, matchesSearch, metaOf, newItemBody, type BookItem } from "./priceBook.ts";

const item = (o: Partial<BookItem> = {}): BookItem => ({
  id: "i", nome: "Paint walls, 2 coats", categoria: "Painting", um: "sq ft", prezzoUnitario: 2.1, note: null, kind: "labour", unitCost: null, previousPrice: null, priceChangedAt: null,
  parts: null, createdAt: "2026-09-01T10:00:00Z", lastUsedAt: null, ...o,
});
const now = new Date("2026-10-01T12:00:00Z");

test("search ignores accents and case and looks at the category too", () => {
  assert.ok(matchesSearch(item({ nome: "Cloison sèche" }), "seche"));
  assert.ok(matchesSearch(item(), "PAINTING"));
  assert.ok(matchesSearch(item(), "  "));
  assert.ok(!matchesSearch(item(), "baseboard"));
});

test("groups come in the board's order, used lately first, and drop the empty ones", () => {
  const items = [
    item({ id: "a", nome: "Trim carpentry", lastUsedAt: "2026-09-19T00:00:00Z" }),
    item({ id: "b", nome: "Paint walls", lastUsedAt: "2026-10-01T00:00:00Z" }),
    item({ id: "c", nome: "Stud", kind: "material" }),
  ];
  const g = groupsOf(items, "all", "");
  assert.deepEqual(g.map((x) => x.kind), ["labour", "material"]);
  assert.deepEqual(g[0]!.items.map((x) => x.id), ["b", "a"]);
  assert.deepEqual(groupsOf(items, "material", "").map((x) => x.kind), ["material"]);
  assert.deepEqual(groupsOf(items, "all", "", "a")[0]!.items.map((x) => x.id), ["a", "b"]);
  assert.deepEqual(groupsOf(items, "all", "zzz"), []);
});

test("the chips count each kind", () => {
  const items = [item(), item({ id: "2", kind: "material" }), item({ id: "3", kind: "assembly" }), item({ id: "4", kind: "material" })];
  assert.deepEqual(FILTERS.map((f) => countOf(items, f)), [4, 1, 2, 1]);
});

test("a changed price is marked for 60 days; materials say how far", () => {
  const changed = (o: Partial<BookItem>) => item({ previousPrice: 18.4, prezzoUnitario: 19.95, priceChangedAt: "2026-09-24T00:00:00Z", ...o });
  assert.deepEqual(markOf(changed({ kind: "material" }), now), { key: "up", tone: "warn", pct: 8 });
  assert.deepEqual(markOf(changed({ kind: "material", previousPrice: 5.65, prezzoUnitario: 5.48 }), now), { key: "down", tone: "ok", pct: 3 });
  assert.deepEqual(markOf(changed({ kind: "labour" }), now), { key: "changed", tone: "warn" });
  assert.equal(markOf(changed({ priceChangedAt: "2026-06-01T00:00:00Z" }), now), null);
  assert.equal(markOf(item(), now), null);
  assert.deepEqual(markOf(item(), now, true), { key: "new", tone: "acc" });
});

test("the line under the name: parts, used or added, and what it was", () => {
  assert.deepEqual(metaOf(item({ lastUsedAt: "2026-09-24T00:00:00Z" }), now), [{ key: "used", date: "2026-09-24T00:00:00Z" }]);
  assert.deepEqual(metaOf(item(), now), [{ key: "added", date: "2026-09-01T10:00:00Z" }]);
  const a = item({ kind: "assembly", parts: [{ name: "A", amount: 1 }, { name: "B", amount: 2 }], previousPrice: 3.1, priceChangedAt: "2026-09-30T00:00:00Z", lastUsedAt: "2026-08-28T00:00:00Z" });
  assert.deepEqual(metaOf(a, now).map((p) => p.key), ["parts", "used", "was"]);
});

test("margin and cost", () => {
  assert.equal(marginPct(38.6, 26.1), 32);
  assert.equal(marginPct(10, null), null);
  assert.equal(marginPct(0, 5), null);
  assert.equal(costOf(item({ unitCost: 0 })), null);
  assert.equal(costOf(item({ unitCost: 4 })), 4);
});

test("an item needs a name and a price; the body leaves out a cost of nothing", () => {
  assert.ok(!canSaveItem("  ", 5));
  assert.ok(!canSaveItem("Baseboard", 0));
  assert.ok(canSaveItem("Baseboard", 3.2));
  assert.deepEqual(newItemBody({ name: " Baseboard install ", kind: "labour", unit: "lin ft", price: 3.2, cost: 0 }), { nome: "Baseboard install", um: "lin ft", prezzoUnitario: 3.2, kind: "labour" });
  assert.deepEqual(newItemBody({ name: "X", kind: "material", unit: "each", price: 5, cost: 3 }), { nome: "X", um: "each", prezzoUnitario: 5, kind: "material", unitCost: 3 });
});
