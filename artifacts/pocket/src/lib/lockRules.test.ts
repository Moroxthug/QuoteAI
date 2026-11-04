import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCK_AFTER_MS, lockAtStart, lockOnReturn, methodOf, offerLock, shouldAskFirst } from "./lockRules.ts";

test("locks after five minutes away, not before", () => {
  const base = { enabled: true, signedIn: true, now: 1_000_000 };
  assert.ok(!lockOnReturn({ ...base, awaySince: base.now - LOCK_AFTER_MS + 1 }));
  assert.ok(lockOnReturn({ ...base, awaySince: base.now - LOCK_AFTER_MS }));
  assert.ok(!lockOnReturn({ ...base, awaySince: null }));
  assert.ok(!lockOnReturn({ ...base, enabled: false, awaySince: 0 }));
  assert.ok(!lockOnReturn({ ...base, signedIn: false, awaySince: 0 }));
});

test("locked at a cold start only when it is on and someone is signed in", () => {
  assert.ok(lockAtStart({ enabled: true, signedIn: true }));
  assert.ok(!lockAtStart({ enabled: true, signedIn: false }));
  assert.ok(!lockAtStart({ enabled: false, signedIn: true }));
});

test("the offer comes once, when the phone can do it", () => {
  assert.ok(offerLock({ signedIn: true, available: true, enabled: false, offered: false }));
  assert.ok(!offerLock({ signedIn: true, available: true, enabled: false, offered: true }));
  assert.ok(!offerLock({ signedIn: true, available: false, enabled: false, offered: false }));
  assert.ok(!offerLock({ signedIn: true, available: true, enabled: true, offered: false }));
});

test("the method's name", () => {
  assert.equal(methodOf("ios", { face: true, fingerprint: false }), "faceId");
  assert.equal(methodOf("ios", { face: false, fingerprint: true }), "touchId");
  assert.equal(methodOf("android", { face: true, fingerprint: true }), "fingerprint");
  assert.equal(methodOf("android", { face: true, fingerprint: false }), "face");
  assert.equal(methodOf("android", { face: false, fingerprint: false }), "device");
});

test("the sheet comes before the phone's own prompt only", () => {
  assert.ok(shouldAskFirst({ status: "undetermined", granted: false, canAskAgain: true }));
  assert.ok(!shouldAskFirst({ status: "granted", granted: true }));
  assert.ok(!shouldAskFirst({ status: "denied", granted: false, canAskAgain: false }));
  assert.ok(!shouldAskFirst({ status: "denied", granted: false, canAskAgain: true }), "asked before: the phone answers itself");
});
