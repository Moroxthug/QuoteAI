import { test } from "node:test";
import assert from "node:assert/strict";
import { backupComplete, cleanCode, formatBackup, outcomeOf, triesAfterWrong } from "./twoStep.ts";

test("cleanCode keeps six digits", () => {
  assert.equal(cleanCode("12 34-56 789"), "123456");
  assert.equal(cleanCode("abc"), "");
});

test("formatBackup puts the dash after the fifth and keeps the case", () => {
  assert.equal(formatBackup("aB3d"), "aB3d");
  assert.equal(formatBackup("aB3dEfG7hJxx"), "aB3dE-fG7hJ");
  assert.equal(formatBackup("aB3dE-fG7"), "aB3dE-fG7");
  assert.equal(backupComplete("aB3dE-fG7hJ"), true);
  assert.equal(backupComplete("aB3dE-fG7"), false);
});

test("outcomeOf reads the server's answer", () => {
  assert.equal(outcomeOf({ ok: true }), "ok");
  assert.equal(outcomeOf({ ok: false, problem: "offline" }), "offline");
  assert.equal(outcomeOf({ ok: false, problem: "locked" }), "locked");
  assert.equal(outcomeOf({ ok: false, problem: "wrong", message: "Invalid two factor cookie" }), "ended");
  assert.equal(outcomeOf({ ok: false, problem: "wrong", message: "Invalid code" }), "wrong");
  assert.equal(outcomeOf({ ok: false, problem: "failed" }), "failed");
});

test("triesAfterWrong stops at 0", () => {
  assert.equal(triesAfterWrong(5), 4);
  assert.equal(triesAfterWrong(0), 0);
});
