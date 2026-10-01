import test from "node:test";
import assert from "node:assert/strict";
import {
  canSaveSupplier, categoriesOf, contactOf, deltaText, dialable, EMPTY_FORM, formOf, groupsOf, matchesSearch, orderCents, priceLook, shareText, supplierBody, type OrderDto, type SupplierRow,
} from "./suppliers.ts";

const sup = (o: Partial<SupplierRow> = {}): SupplierRow => ({
  id: "s1", name: "Home Depot Pro", category: "building", repName: "Rachel Kim", repRole: "Pro desk", kind: "account", accountNo: "4410-2291", terms: "Net 30", proDiscountPct: 5,
  phone: "(416) 555-0142", email: "", address: "", delivers: "", hours: "", notes: "", spendMonthCents: 0, lastOrderAt: null, ...o,
});

test("search finds a supplier by name, rep, account or category, accents aside", () => {
  assert.ok(matchesSearch(sup(), "rachel"));
  assert.ok(matchesSearch(sup(), "4410"));
  assert.ok(matchesSearch(sup(), "BUILDING"));
  assert.ok(matchesSearch(sup({ name: "Café Matériaux" }), "materiaux"));
  assert.ok(!matchesSearch(sup(), "greg"));
  assert.ok(matchesSearch(sup(), "  "));
});

test("the chips offer each category once", () => {
  const cats = categoriesOf([sup(), sup({ id: "2", category: "Building" }), sup({ id: "3", category: "paint" }), sup({ id: "4", category: "" })]);
  assert.deepEqual(cats.map((c) => [c.key, c.count]), [["building", 2], ["paint", 1]]);
});

test("accounts and counter suppliers are two groups; empty ones drop out; the filter and search narrow them", () => {
  const items = [sup(), sup({ id: "2", name: "Canadian Tire", kind: "counter", category: "tools", repName: "Danforth" })];
  assert.deepEqual(groupsOf(items, "all", "").map((g) => g.kind), ["account", "counter"]);
  assert.deepEqual(groupsOf(items, "tools", "").map((g) => g.kind), ["counter"]);
  assert.deepEqual(groupsOf(items, "all", "danforth").map((g) => g.items.length), [1]);
  assert.deepEqual(groupsOf(items, "paint", ""), []);
});

test("the rep line and the number to dial", () => {
  assert.equal(contactOf(sup()), "Rachel Kim, Pro desk");
  assert.equal(contactOf(sup({ repRole: "" })), "Rachel Kim");
  assert.equal(contactOf(sup({ repName: "", repRole: "" })), "");
  assert.equal(dialable("(416) 555-0142"), "4165550142");
  assert.equal(dialable("+1 416 555 0142"), "+14165550142");
});

test("an order costs its quantity times the price, or nothing is said when the price is unknown", () => {
  const o = (qty: number, unitPriceCents: number | null) => ({ qty, unitPriceCents }) as OrderDto;
  assert.equal(orderCents(o(40, 1995)), 79800);
  assert.equal(orderCents(o(2.5, 1000)), 2500);
  assert.equal(orderCents(o(3, null)), null);
});

test("the order list shares as plain lines", () => {
  const orders = [
    { itemName: "Drywall 1/2\" 4×8", unit: "sheets", qty: 40, destination: "shop" },
    { itemName: "Tape", unit: "rolls", qty: 2.5, destination: "" },
  ] as OrderDto[];
  const text = shareText("Order for Home Depot Pro", orders, (d) => (d === "shop" ? "Shop" : d));
  assert.equal(text, "Order for Home Depot Pro\n- 40 sheets Drywall 1/2\" 4×8 (Shop)\n- 2.5 rolls Tape");
});

test("a price's change is amber up, green down and faint when steady; the text follows the locale", () => {
  const p = (changePct: number) => ({ name: "x", from: 1, to: 1, changePct, when: null, points: [1, 1] });
  assert.equal(priceLook(p(8)).color, "warn");
  assert.equal(priceLook(p(-3)).color, "ok");
  assert.equal(priceLook(p(0)).color, "faint");
  assert.equal(deltaText(8.43, "en-CA"), "+8.4%");
  assert.equal(deltaText(-3.2, "en-CA"), "−3.2%");
  assert.equal(deltaText(0, "en-CA"), "0%");
  assert.match(deltaText(8.43, "fr-CA"), /^\+8,4\s%$/);
});

test("the supplier form needs a name and a plausible email; the body trims everything", () => {
  assert.ok(!canSaveSupplier(EMPTY_FORM));
  assert.ok(canSaveSupplier({ ...EMPTY_FORM, name: "Lumber Plus" }));
  assert.ok(!canSaveSupplier({ ...EMPTY_FORM, name: "Lumber Plus", email: "nope" }));
  assert.ok(canSaveSupplier({ ...EMPTY_FORM, name: "Lumber Plus", email: "greg@lumber.example" }));
  const f = formOf(sup());
  assert.equal(f.proDiscount, "5");
  assert.deepEqual(supplierBody({ ...f, name: " Home Depot Pro ", repName: "  " }, 5).repName, "");
  assert.equal(supplierBody(f, null).proDiscountPct, null);
});
