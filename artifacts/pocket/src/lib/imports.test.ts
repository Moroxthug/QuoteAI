import assert from "node:assert/strict";
import { test } from "node:test";
import { clientRows, nextField, planPrices, priceOf, priceRows, ringOffset, suggest } from "./imports.ts";

test("columns are matched to client fields once each", () => {
  assert.deepEqual(suggest(["Name", "Phone #", "E-mail", "Street", "Comments", "Balance"], "clients"), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(suggest(["Nom", "Tel", "Courriel", "Rue", "Commentaires"], "clients"), [0, 1, 2, 3, 4]);
  assert.deepEqual(suggest(["Client", "Customer"], "clients"), [0, 5]);
});

test("price columns", () => {
  assert.deepEqual(suggest(["Item", "UOM", "Price", "Category"], "prices"), [0, 1, 2, 3]);
});

test("the pick button skips a field another column has, ending at skip", () => {
  assert.equal(nextField([0, 1, 5], 2, "clients"), 2);
  assert.equal(nextField([0, 1, 2], 2, "clients"), 3);
  assert.equal(nextField([0, 1, 4], 2, "clients"), 5);
  assert.equal(nextField([0, 5, 5], 1, "clients"), 1);
});

test("rows keep their sheet number and drop empty cells", () => {
  const rows = clientRows([["Dana", "416-555-0187", "", "17 Castle Frank", "", "$0"]], [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(rows, [{ row: 2, name: "Dana", phone: "416-555-0187", email: undefined, address: "17 Castle Frank", notes: undefined }]);
});

test("prices read dollars and commas", () => {
  assert.equal(priceOf("$1,234.50"), 1234.5);
  assert.equal(priceOf("12,50"), 12.5);
  assert.equal(priceOf("abc"), null);
  assert.equal(priceOf(""), null);
  assert.equal(priceOf("-3"), null);
});

test("a price plan skips what the book has and reports the mistakes", () => {
  const rows = priceRows([["2x4 stud", "ea", "4.25"], ["2x4 STUD", "EA", "4.25"], ["Drywall", "sheet", "x"], ["", "ea", "1"], ["Mud", "", "18"]], [0, 1, 2, 5, 5]);
  const p = planPrices(rows, [{ nome: "Mud", um: "ea" }]);
  assert.deepEqual(p.clean.map((r) => r.name), ["2x4 stud"]);
  assert.equal(p.skipped, 2);
  assert.deepEqual(p.errors, [{ row: 4, name: "Drywall", why: "bad_price" }, { row: 5, name: "", why: "no_name" }]);
});

test("the ring offset", () => {
  assert.equal(ringOffset(0), 389.6);
  assert.equal(ringOffset(100), 0);
});
