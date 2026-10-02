import assert from "node:assert/strict";
import { test } from "node:test";
import { APPS, counts, stateOf, tileOrder, unlocked, unresolvedFailures, visible, type AppId, type State } from "./integrations.ts";

test("a status becomes a state", () => {
  assert.equal(stateOf(null), "none");
  assert.equal(stateOf({ connected: false }), "none");
  assert.equal(stateOf({ connected: false, available: false }), "soon");
  assert.equal(stateOf({ connected: true }), "connected");
  assert.equal(stateOf({ connected: true, isEnabled: false }), "paused");
  assert.equal(stateOf({ connected: true }, true), "attention");
});

test("a failure counts until a later row for the same thing succeeds", () => {
  const rows = [
    { status: "success", entityType: "invoice", entityId: "a" },
    { status: "failed", entityType: "invoice", entityId: "a" },
    { status: "failed", entityType: "invoice", entityId: "b" },
    { status: "failed", entityType: "payment_pull", entityId: "c" },
  ];
  assert.deepEqual(unresolvedFailures(rows).map((r) => r.entityId), ["b"]);
});

test("a plan unlocks an app by feature or by its own minimum", () => {
  const qbo = APPS.find((a) => a.id === "qbo")!;
  const wa = APPS.find((a) => a.id === "wa")!;
  assert.equal(unlocked(qbo, "monthly_business", ["quickbooks_sync"]), true);
  assert.equal(unlocked(qbo, "monthly_pro", ["quotes"]), false);
  assert.equal(unlocked(wa, "monthly_pro", []), true);
  assert.equal(unlocked(wa, "monthly_starter", []), false);
  assert.equal(unlocked(APPS.find((a) => a.id === "xero")!, "free", []), true);
});

const states = (o: Partial<Record<AppId, State>>): Record<AppId, State> => Object.fromEntries(APPS.map((a) => [a.id, o[a.id] ?? "none"])) as Record<AppId, State>;

test("tiles put what can be connected first, coming soon next, then plan-locked", () => {
  const s = states({ xero: "soon", qbo: "locked", wave: "none" });
  const order = tileOrder(APPS, s).map((a) => a.id);
  assert.equal(order.at(-1), "qbo");
  assert.ok(order.indexOf("xero") > order.indexOf("wave"));
  assert.ok(order.indexOf("xero") < order.indexOf("qbo"));
});

test("counts and the search", () => {
  assert.deepEqual(counts(states({ qbo: "attention", stripe: "connected", drive: "paused", xero: "soon" })), { on: 3, attention: 1 });
  const words = (id: AppId) => (id === "gcal" ? "Google Calendar jobs on the calendar" : id);
  assert.deepEqual(visible(APPS, "all", "calendar", words).map((a) => a.id), ["gcal"]);
  assert.equal(visible(APPS, "acct", "", words).length, 3);
});
