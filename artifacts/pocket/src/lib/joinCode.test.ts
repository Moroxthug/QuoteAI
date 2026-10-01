import test from "node:test";
import assert from "node:assert/strict";
import { cleanCode, codeProblem, formatCode, isCodeComplete, kindForRole } from "./joinCode.ts";

test("cleanCode keeps ten upper-case letters and digits", () => {
  assert.equal(cleanCode(" k7q2m-xf4r8tn9 "), "K7Q2MXF4R8");
  assert.equal(cleanCode(null), "");
  assert.equal(cleanCode("ab-c"), "ABC");
});
test("isCodeComplete needs all ten", () => {
  assert.equal(isCodeComplete("K7Q2M-XF4R8"), true);
  assert.equal(isCodeComplete("K7Q2M"), false);
});
test("formatCode adds the dash after five", () => {
  assert.equal(formatCode("K7Q2"), "K7Q2");
  assert.equal(formatCode("K7Q2M"), "K7Q2M");
  assert.equal(formatCode("k7q2mxf"), "K7Q2M-XF");
});
test("kindForRole", () => {
  assert.equal(kindForRole("foreman"), "foreman");
  assert.equal(kindForRole("admin"), "foreman");
  assert.equal(kindForRole("office"), "crew");
  assert.equal(kindForRole("viewer"), "crew");
});
test("codeProblem", () => {
  assert.equal(codeProblem({ status: 404, code: "NOT_FOUND" }), "invalid");
  assert.equal(codeProblem({ status: 409, code: "ALREADY_USED" }), "used");
  assert.equal(codeProblem({ status: 410, code: "EXPIRED" }), "expired");
  assert.equal(codeProblem({ status: 409, code: "OWN_COMPANY" }), "own");
  assert.equal(codeProblem({ status: 409, code: "ALREADY_MEMBER" }), "member");
  assert.equal(codeProblem({ status: 0 }), "offline");
  assert.equal(codeProblem({ status: 500 }), "failed");
  assert.equal(codeProblem({ status: 429, code: undefined }), "failed");
});
