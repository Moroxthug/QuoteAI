import test from "node:test";
import assert from "node:assert/strict";
import { codeCount, companyBody, detailsBody, initialsOf, isEmail, nameOf, nextRole, setupBody, togglePick } from "./onboarding.ts";

test("roles cycle admin, foreman, crew", () => {
  assert.equal(nextRole("admin"), "foreman");
  assert.equal(nextRole("foreman"), "crew");
  assert.equal(nextRole("crew"), "admin");
});

test("emails", () => {
  assert.ok(isEmail(" luca@rossireno.ca "));
  assert.ok(!isEmail("luca@"));
  assert.ok(!isEmail("416 555 0133"));
  assert.equal(nameOf("luca.bianchi@x.ca"), "Luca Bianchi");
  assert.equal(initialsOf("luca.bianchi@x.ca"), "LB");
  assert.equal(initialsOf("amara@x.ca"), "AM");
});

test("company body drops empty optionals", () => {
  assert.deepEqual(companyBody({ companyName: " Rossi ", phone: "", email: "a@b.ca", vatNumber: " ", address: "" }), {
    companyName: "Rossi", vatNumber: undefined, address: undefined, phone: undefined, email: "a@b.ca",
  });
});

test("details and setup bodies", () => {
  assert.equal(detailsBody({ province: null, licenceNumber: " ", etransferEmail: "" }), null);
  assert.deepEqual(detailsBody({ province: "QC", licenceNumber: "", etransferEmail: "e@x.ca" }), { province: "QC", licenceNumber: null, etransferEmail: "e@x.ca" });
  assert.equal(setupBody({ trades: [], sizeIndex: null, fieldCrew: null }), null);
  assert.deepEqual(setupBody({ trades: ["painting"], sizeIndex: null, fieldCrew: null }), { trades: ["painting"] });
  assert.deepEqual(setupBody({ trades: [], sizeIndex: 1, fieldCrew: true }), { teamSize: 4, fieldCrew: true });
  assert.deepEqual(setupBody({ trades: [], sizeIndex: 0, fieldCrew: true }), null);
});

test("toggle and codes", () => {
  assert.deepEqual(togglePick(["a"], "b"), ["a", "b"]);
  assert.deepEqual(togglePick(["a", "b"], "a"), ["b"]);
  assert.equal(codeCount([]), 1);
  assert.equal(codeCount([{ email: "a@b.ca", role: "crew" }, { email: "c@b.ca", role: "crew" }, { email: "d@b.ca", role: "admin" }]), 2);
});
