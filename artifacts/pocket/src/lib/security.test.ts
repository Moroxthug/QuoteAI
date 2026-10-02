import assert from "node:assert/strict";
import { test } from "node:test";
import { activityOf, agentParts, deleteReady, deleteTyped, othersFirst } from "./security.ts";

test("a device is named from its user agent", () => {
  assert.deepEqual(agentParts("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"), { browser: "Chrome", system: "Windows" });
  assert.deepEqual(agentParts("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605 Version/17 Safari/604"), { browser: "Safari", system: "iPad" });
  assert.deepEqual(agentParts("Mozilla/5.0 (Windows NT 10.0) Edg/120"), { browser: "Edge", system: "Windows" });
  assert.equal(agentParts(""), null);
  assert.equal(agentParts("okhttp/4.12"), null);
});

test("other devices come most recent first, this one left out", () => {
  const d = (token: string, at: string, here = false) => ({ token, agent: "", ip: "", at, here });
  assert.deepEqual(othersFirst([d("a", "2026-09-01"), d("me", "2026-10-01", true), d("b", "2026-09-20")]).map((x) => x.token), ["b", "a"]);
});

test("recent activity keeps only this person's security events, newest first", () => {
  const e = (id: string, action: string, actorId: string | null, createdAt: string) => ({ id, action, actorId, userAgent: null, createdAt });
  const rows = activityOf([e("1", "login", "me", "2026-09-01"), e("2", "login", "you", "2026-09-30"), e("3", "two_factor.enabled", "me", "2026-09-10"), e("4", "page.viewed", "me", "2026-10-01")], "me");
  assert.deepEqual(rows.map((r) => [r.id, r.kind]), [["3", "twoOn"], ["1", "login"]]);
  assert.equal(activityOf(Array.from({ length: 9 }, (_, i) => e(String(i), "login", "me", `2026-09-0${i + 1}`)), "me").length, 5);
});

test("deleting needs the word, the password and, with two-step, a code", () => {
  assert.equal(deleteTyped(" delete "), true);
  assert.equal(deleteTyped("delet"), false);
  assert.equal(deleteTyped("supprimer", "SUPPRIMER"), true);
  assert.equal(deleteReady("DELETE", "", false, ""), false);
  assert.equal(deleteReady("DELETE", "pw", false, ""), true);
  assert.equal(deleteReady("DELETE", "pw", true, "12 34"), false);
  assert.equal(deleteReady("DELETE", "pw", true, "123 456"), true);
});
