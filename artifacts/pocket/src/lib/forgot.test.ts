import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeEmail, mismatch, passwordRules, rulesMet, startStep } from "./forgot.ts";

test("startStep", () => {
  assert.deepEqual(startStep({}), { step: "request", expired: false });
  assert.deepEqual(startStep({ token: "abc" }), { step: "newPassword", expired: false });
  assert.deepEqual(startStep({ error: "INVALID_TOKEN" }), { step: "newPassword", expired: true });
  assert.deepEqual(startStep({ token: "abc", error: "x" }), { step: "newPassword", expired: false });
});

test("looksLikeEmail", () => {
  assert.equal(looksLikeEmail(" marco@rossireno.ca "), true);
  assert.equal(looksLikeEmail("marco"), false);
  assert.equal(looksLikeEmail("@x"), false);
});

test("passwordRules and mismatch follow the board", () => {
  assert.deepEqual(passwordRules("galloway-48", "galloway-4"), { length: true, mix: true, match: false });
  assert.equal(rulesMet(passwordRules("galloway-48", "galloway-48")), true);
  assert.equal(rulesMet(passwordRules("gallowayyy", "gallowayyy")), false);
  assert.equal(rulesMet(passwordRules("g-4", "g-4")), false);
  assert.equal(mismatch("galloway-48", "galloway-4"), false);
  assert.equal(mismatch("galloway-48", "galloway-49"), true);
  assert.equal(mismatch("abc", ""), false);
});
