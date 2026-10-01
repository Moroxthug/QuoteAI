import test from "node:test";
import assert from "node:assert/strict";
import { accepted, initialsOf, joinedOrgs, sameAddress, tokenProblem, viewFor } from "./invites.ts";

test("viewFor", () => {
  assert.equal(viewFor(0), null);
  assert.equal(viewFor(1), "single");
  assert.equal(viewFor(3), "multiple");
});
test("tokenProblem", () => {
  assert.equal(tokenProblem({ status: 410, code: "EXPIRED" }), "expired");
  assert.equal(tokenProblem({ status: 403, code: "EMAIL_MISMATCH" }), "wrongAccount");
  assert.equal(tokenProblem({ status: 409, code: "ALREADY_ACCEPTED" }), "accepted");
  assert.equal(tokenProblem({ status: 404, code: "NOT_FOUND" }), "invalid");
  assert.equal(tokenProblem({ status: 0 }), "offline");
  assert.equal(tokenProblem({ status: 500 }), "failed");
});
test("sameAddress ignores case and spaces", () => {
  assert.equal(sameAddress("Luca@RossiReno.ca ", "luca@rossireno.ca"), true);
  assert.equal(sameAddress("a@b.ca", "c@b.ca"), false);
  assert.equal(sameAddress(null, "c@b.ca"), false);
});
test("accepted keeps list order", () => {
  const list = [{ id: "a", companyName: "A", role: "foreman" as const, logoUrl: null }, { id: "b", companyName: "B", role: "office" as const, logoUrl: null }];
  assert.deepEqual(accepted(list, { a: "yes", b: "no" }).map((i) => i.id), ["a"]);
  assert.deepEqual(accepted(list, { a: "yes", b: "yes" }).map((i) => i.id), ["a", "b"]);
});
test("joinedOrgs", () => {
  assert.deepEqual(joinedOrgs([{ orgId: "x" }], [{ orgId: "x" }, { orgId: "y" }]), [{ orgId: "y" }]);
});
test("initialsOf", () => {
  assert.equal(initialsOf("Rossi Renovations"), "RR");
  assert.equal(initialsOf("Harbourfront"), "HA");
  assert.equal(initialsOf(""), "");
});

import { boldSplit } from "./invites.ts";
test("boldSplit", () => {
  assert.deepEqual(boldSplit("You’re invited to Rossi (Toronto) as Foreman.", ["Rossi (Toronto)", "Foreman"]), [
    { text: "You’re invited to ", bold: false }, { text: "Rossi (Toronto)", bold: true }, { text: " as ", bold: false }, { text: "Foreman", bold: true }, { text: ".", bold: false },
  ]);
  assert.deepEqual(boldSplit("Hello", []), [{ text: "Hello", bold: false }]);
});
