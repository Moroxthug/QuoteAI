import test from "node:test";
import assert from "node:assert/strict";
import { initialSelection, isRemoval, parseKnown, pickerRows, remember } from "./companyPicker.ts";

const cur = [
  { orgId: "a", companyName: "Rossi Renovations", role: "owner" as const, isOwn: true },
  { orgId: "b", companyName: "Rossi Commercial", role: "foreman" as const, isOwn: false },
];
test("pickerRows adds a remembered company that is gone", () => {
  const rows = pickerRows(cur, [{ orgId: "c", companyName: "Harbourfront", role: "foreman" }, { orgId: "b", companyName: "Rossi Commercial", role: "foreman", lastOpened: "2026-09-21T10:00:00Z" }]);
  assert.deepEqual(rows.map((r) => [r.org.orgId, r.gone]), [["a", false], ["b", false], ["c", true]]);
  assert.equal(rows[1]!.org.lastOpened, "2026-09-21T10:00:00Z");
});
test("initialSelection prefers the stored company, then the latest opened", () => {
  const rows = pickerRows(cur, [{ orgId: "b", companyName: "x", role: "foreman", lastOpened: "2026-09-21T10:00:00Z" }]);
  assert.equal(initialSelection(rows, "a"), "a");
  assert.equal(initialSelection(rows, "zzz"), "b");
  assert.equal(initialSelection(pickerRows([], []), null), null);
});
test("gone rows are never selected", () => {
  const rows = pickerRows([], [{ orgId: "c", companyName: "H", role: "foreman" }]);
  assert.equal(initialSelection(rows, "c"), null);
});
test("parseKnown survives junk", () => {
  assert.deepEqual(parseKnown("nope"), []);
  assert.deepEqual(parseKnown(null), []);
  assert.equal(parseKnown(JSON.stringify([{ orgId: "a", companyName: "A", role: "owner" }, { bad: 1 }])).length, 1);
});
test("remember drops the removed and stamps the opened one", () => {
  const rows = pickerRows(cur, [{ orgId: "c", companyName: "H", role: "foreman" }]);
  const k = remember(rows, "b", new Date("2026-10-01T12:00:00Z"));
  assert.deepEqual(k.map((o) => o.orgId), ["a", "b"]);
  assert.equal(k[1]!.lastOpened, "2026-10-01T12:00:00.000Z");
  assert.equal(k[0]!.lastOpened, undefined);
});
test("isRemoval", () => {
  assert.equal(isRemoval({ status: 403 }), true);
  assert.equal(isRemoval({ status: 404 }), true);
  assert.equal(isRemoval({ status: 500 }), false);
});
