import test from "node:test";
import assert from "node:assert/strict";
import {
  canSaveMaterial, changedCount, countOf, destinations, fillOf, kpis, lineTotalCents, listedCount, lowItems, materialBody, orderFor, planName, qtyAt, qtyStep, reviewSupplier, statusKey, stepQty, tagOf, unitFor,
  whereOf, type OpenOrder, type StockItem, type StockOption,
} from "./inventory.ts";

const item = (o: Partial<StockItem> = {}): StockItem => ({
  id: "i1", name: "Drywall", unit: "sheets", par: 30, shopQty: 8, truckQty: 0, sites: [], reserved: [], unitCostCents: 1995, total: 8, level: "low", suggested: 52, options: [], ...o,
});
const order = (o: Partial<OpenOrder> = {}): OpenOrder => ({ id: "o1", supplierId: "s1", supplierName: "Home Depot Pro", inventoryItemId: "i1", itemName: "Drywall", unit: "sheets", qty: 40, unitPriceCents: 1995, destination: "shop", status: "listed", ...o });
const opt = (o: Partial<StockOption> = {}): StockOption => ({ supplierId: "s1", name: "Home Depot Pro", terms: "Net 30", delivers: "", kind: "account", priceCents: 1995, beforeCents: null, ...o });

test("the quantity at a place and where it is", () => {
  const i = item({ shopQty: 5, truckQty: 2, sites: [{ name: "Hart", qty: 3 }, { name: "Whitfield", qty: 0 }], total: 10 });
  assert.deepEqual(["all", "shop", "truck", "sites"].map((l) => qtyAt(i, l as never)), [10, 5, 2, 3]);
  assert.deepEqual(whereOf(i).map((w) => [w.kind, w.name, w.n]), [["shop", undefined, 5], ["truck", undefined, 2], ["site", "Hart", 3]]);
  assert.deepEqual(whereOf(item({ shopQty: 0, total: 0 })), [{ kind: "nowhere", n: 0 }]);
});

test("one of something drops the plural", () => {
  assert.equal(unitFor("sheets", 1), "sheet");
  assert.equal(unitFor("sheets", 8), "sheets");
  assert.equal(unitFor("each", 1), "each");
});

test("the bar fills to twice the reorder level", () => {
  assert.equal(fillOf(item({ par: 30, total: 15 })), 0.25);
  assert.equal(fillOf(item({ par: 10, total: 100 })), 1);
  assert.equal(fillOf(item({ par: 0, total: 3 })), 1);
  assert.equal(fillOf(item({ par: 0, total: 0 })), 0);
});

test("running low puts the ones short for a job first", () => {
  const items = [item({ id: "a", name: "A", total: 5, par: 10 }), item({ id: "b", name: "B", level: "short", total: 9, par: 10 }), item({ id: "c", name: "C", level: "ok" }), item({ id: "d", name: "D", total: 1, par: 10 })];
  assert.deepEqual(lowItems(items).map((i) => i.id), ["b", "d", "a"]);
});

test("an item with an order on the way is On order, else Short or Low", () => {
  const i = item();
  assert.equal(statusKey(i, undefined), "low");
  assert.equal(statusKey(item({ level: "short" }), undefined), "short");
  assert.equal(statusKey(i, order()), "ordered");
  assert.equal(orderFor(i, [order({ inventoryItemId: "x" })]), undefined);
});

test("the three numbers: tracked and where, low (not yet ordered), what is set aside", () => {
  const items = [
    item({ id: "a", shopQty: 8, level: "short", reserved: [{ qty: 24, job: "Hart basement" }], unitCostCents: 1995 }),
    item({ id: "b", shopQty: 2, truckQty: 0, level: "low", unitCostCents: null }),
    item({ id: "c", level: "ok", shopQty: 46, sites: [{ name: "Hart", qty: 20 }], reserved: [{ qty: 20, job: "hart basement" }, { qty: 2, job: "Whitfield" }], unitCostCents: 549 }),
  ];
  const k = kpis(items, []);
  assert.deepEqual([k.tracked, k.places, k.low, k.short, k.onOrder, k.reservedJobs], [3, 2, 2, 1, 0, 2]);
  assert.equal(k.reservedCents, 24 * 1995 + 22 * 549);
  const k2 = kpis(items, [order({ inventoryItemId: "a" })]);
  assert.deepEqual([k2.low, k2.short, k2.onOrder], [1, 0, 1]);
});

test("a supplier's tag: best price, up since the last receipt, or last price", () => {
  const a = opt({ supplierId: "a", priceCents: 1940 });
  const b = opt({ supplierId: "b", priceCents: 1995, beforeCents: 1840 });
  const c = opt({ supplierId: "c", priceCents: 2025 });
  const d = opt({ supplierId: "d", priceCents: null });
  const all = [a, b, c, d];
  assert.deepEqual(tagOf(a, all), { key: "best" });
  assert.deepEqual(tagOf(b, all), { key: "up", pct: 8 });
  assert.deepEqual(tagOf(c, all), { key: "last" });
  assert.equal(tagOf(d, all), null);
  assert.deepEqual(tagOf(a, [a]), { key: "last" });
});

test("the reorder quantity steps by 5 from 20 up, and the line total follows the price", () => {
  assert.equal(qtyStep(40), 5);
  assert.equal(qtyStep(8), 1);
  assert.equal(lineTotalCents(40, opt()), 79800);
  assert.equal(lineTotalCents(40, opt({ priceCents: null })), null);
  assert.equal(lineTotalCents(2, undefined), null);
});

test("destinations and the supplier to review the order list at", () => {
  assert.deepEqual(destinations(["Hart site"]), ["shop", "Hart site", "pickup"]);
  const orders = [order({ id: "1" }), order({ id: "2", supplierId: "s2", supplierName: "CanWel" }), order({ id: "3", supplierId: "s2", supplierName: "CanWel" }), order({ id: "4", status: "ordered" })];
  assert.deepEqual(reviewSupplier(orders), { id: "s2", name: "CanWel" });
  assert.equal(reviewSupplier([order({ status: "ordered" })]), null);
  assert.equal(listedCount(orders), 3);
});

test("the plan's name", () => {
  assert.equal(planName("monthly_business"), "Business");
  assert.equal(planName("monthly_elite"), "Elite");
});

test("counts: change detection, steps and the add form", () => {
  const i = item({ shopQty: 8, truckQty: 1, sites: [{ name: "Hart", qty: 2 }] });
  const c = countOf(i);
  assert.ok(!changedCount(i, c));
  assert.ok(changedCount(i, { ...c, shopQty: 9 }));
  assert.ok(changedCount(i, { ...c, sites: [{ name: "Hart", qty: 3 }] }));
  assert.equal(stepQty(1, -5), 0);
  assert.equal(stepQty(2.5, 0.5), 3);
  assert.ok(!canSaveMaterial({ name: " ", unit: "", par: "", shop: "" }));
  assert.deepEqual(materialBody({ name: " Tape ", unit: "", par: "12", shop: "3" }, Number), { name: "Tape", unit: "each", par: 12, shopQty: 3 });
});
