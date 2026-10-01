import test from "node:test";
import assert from "node:assert/strict";
import { decideRoute, type GateInput } from "./gate.ts";

const own = { orgId: "u1", companyName: "Rossi Renovations", role: "owner" as const, isOwn: true };
const other = { orgId: "u2", companyName: "Hart Builders", role: "foreman" as const, isOwn: false };
const base: GateInput = { orgs: [own], invites: [], companyName: "Rossi Renovations", setupSkipped: false, hasActiveOrg: true };

test("an owner with a named company goes Home", () => assert.equal(decideRoute(base), "/home"));
test("a new owner with no company name goes to setup", () => assert.equal(decideRoute({ ...base, companyName: "" }), "/onboarding"));
test("skipping setup is remembered", () => assert.equal(decideRoute({ ...base, companyName: "", setupSkipped: true }), "/home"));
test("someone who only joined a company goes Home, never to setup", () => assert.equal(decideRoute({ ...base, orgs: [{ ...other, role: "office" as const }], companyName: "" }), "/home"));
test("a foreman who only joined a company goes to the foreman Home", () => assert.equal(decideRoute({ ...base, orgs: [other], companyName: "" }), "/foreman-home"));
test("two companies and none chosen: choose", () => assert.equal(decideRoute({ ...base, orgs: [own, other], hasActiveOrg: false }), "/company-picker"));
test("two companies and one chosen: Home", () => assert.equal(decideRoute({ ...base, orgs: [own, other] }), "/home"));
test("a waiting invitation is offered before setup", () => {
  const invites = [{ id: "i1", companyName: "Hart Builders", role: "foreman" as const, logoUrl: null }];
  assert.equal(decideRoute({ ...base, orgs: [], invites, companyName: "" }), "/invites");
});
test("an owner's waiting invitation doesn't cut in", () => {
  const invites = [{ id: "i1", companyName: "Hart Builders", role: "foreman" as const, logoUrl: null }];
  assert.equal(decideRoute({ ...base, invites }), "/home");
});
