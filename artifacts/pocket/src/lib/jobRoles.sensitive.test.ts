import assert from "node:assert/strict";
import { test } from "node:test";
import { changedCount, defaultSensitive, firstName } from "./jobRoles.ts";

test("a role starts with its switches and a change is counted against it", () => {
  assert.deepEqual(defaultSensitive("estimator"), { payRates: false, margins: true, approveTime: false, sendInvoices: false });
  assert.equal(changedCount("estimator", { payRates: false, margins: true, approveTime: false, sendInvoices: false }), 0);
  assert.equal(changedCount("estimator", { payRates: false, margins: false, approveTime: false, sendInvoices: true }), 2);
  assert.equal(firstName("Ben  Walsh"), "Ben");
});
