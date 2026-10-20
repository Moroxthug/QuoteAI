import assert from "node:assert/strict";
import { test } from "node:test";
import { bannerKey, freeState, isBlocked, isFreeQuotesUsed, usedInfo, type Allowance } from "./allowance.ts";

const A = (f: Partial<Allowance["freeQuotes"]>): Allowance => ({ freeQuotes: { paid: false, used: 1, limit: 3, left: 2, enforced: false, ...f } });

test("counting while more than one is left", () => {
  const s = freeState(A({}));
  assert.deepEqual(s, { kind: "counting", left: 2, limit: 3, used: 1 });
  assert.equal(bannerKey(s), "count");
});

test("low at one left", () => {
  const s = freeState(A({ used: 2, left: 1 }));
  assert.equal(s.kind, "low");
  assert.equal(bannerKey(s), "one");
});

test("none left but not blocking yet: low wording, no lock", () => {
  const a = A({ used: 3, left: 0, enforced: false });
  assert.equal(freeState(a).kind, "low");
  assert.equal(bannerKey(freeState(a)), "zero");
  assert.equal(isBlocked(a), false);
});

test("used only when none are left and the server blocks", () => {
  const a = A({ used: 3, left: 0, enforced: true });
  assert.equal(freeState(a).kind, "used");
  assert.equal(bannerKey(freeState(a)), "used");
  assert.equal(isBlocked(a), true);
  assert.equal(isBlocked(A({ left: 1, enforced: true })), false);
});

test("paid, unlimited or missing shows nothing", () => {
  assert.equal(freeState(A({ paid: true })).kind, "none");
  assert.equal(freeState(A({ limit: null, left: null })).kind, "none");
  assert.equal(freeState(null).kind, "none");
  assert.equal(freeState(undefined).kind, "none");
  assert.equal(bannerKey({ kind: "none" }), null);
  assert.equal(isBlocked(A({ paid: true, left: 0, enforced: true })), false);
});

test("the 402 answer", () => {
  assert.equal(isFreeQuotesUsed(402, "FREE_QUOTES_USED"), true);
  assert.equal(isFreeQuotesUsed(402, "PLAN_REQUIRED"), false);
  assert.equal(isFreeQuotesUsed(403, "FREE_QUOTES_USED"), false);
  assert.deepEqual(usedInfo({ limit: 3, used: 3 }), { limit: 3, used: 3 });
  assert.deepEqual(usedInfo(null), { limit: null, used: null });
});
