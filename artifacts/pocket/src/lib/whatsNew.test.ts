import assert from "node:assert/strict";
import { test } from "node:test";
import { shortVersion, shouldShow } from "./whatsNew.ts";

test("a first install only records the version", () => {
  assert.deepEqual(shouldShow(null, "2.4.0"), { show: false, record: true });
});
test("a new version shows once", () => {
  assert.deepEqual(shouldShow("2.3.0", "2.4.0"), { show: true, record: false });
  assert.deepEqual(shouldShow("2.4.0", "2.4.0"), { show: false, record: false });
});
test("the short version", () => {
  assert.equal(shortVersion("2.4.1"), "2.4");
  assert.equal(shortVersion("3"), "3");
});
