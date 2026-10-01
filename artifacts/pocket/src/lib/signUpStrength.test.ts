import assert from "node:assert/strict";
import { test } from "node:test";
import { strength } from "./signUpStrength.ts";

test("password strength levels", () => {
  assert.equal(strength(""), 0);
  assert.equal(strength("reno24"), 1);
  assert.equal(strength("renovation"), 2);
  assert.equal(strength("renovation1"), 3);
  assert.equal(strength("rossi-reno-24-ab"), 4);
});
