import assert from "node:assert/strict";
import { test } from "node:test";
import { effectiveScale, stacksAt } from "./textScale.ts";

test("the app's text size and the phone's font size multiply", () => {
  assert.equal(effectiveScale(1, 1), 1);
  assert.ok(Math.abs(effectiveScale(1.15, 1.3) - 1.495) < 1e-9);
  assert.equal(effectiveScale(1, 0), 1, "a missing font scale counts as 1");
});

test("columns of figures stack from 1.4 times the design's size", () => {
  assert.equal(stacksAt(1), false);
  assert.equal(stacksAt(1.3), false);
  assert.equal(stacksAt(1.4), true);
  assert.equal(stacksAt(2), true);
});
