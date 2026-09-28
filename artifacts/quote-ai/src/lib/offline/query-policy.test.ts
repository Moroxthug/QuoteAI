// Phase 116: what the device keeps, how fresh it must be, and what fits.
// Run: pnpm --filter @workspace/quote-ai test (node:test through tsx).
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, shouldPersist, prune, MAX_AGE_MS, STALE_MS } from "./query-policy";
import { jobsThisWeek } from "./week";

test("the generated client's keys are classified by path", () => {
  assert.equal(classify(["/api/quotes"]), "list");
  assert.equal(classify(["/api/quotes/stats"]), "list");
  assert.equal(classify(["/api/quotes/3f2a"]), "detail");
  assert.equal(classify(["/api/quotes/3f2a/variants"]), "detail");
  assert.equal(classify(["/api/clients/c1/quotes"]), "detail");
  assert.equal(classify(["/api/catalog"]), "reference");
  assert.equal(classify(["/api/business-profile"]), "reference");
});

test("the app's own keys are classified by their first element", () => {
  assert.equal(classify(["jobs"]), "list");
  assert.equal(classify(["job", "j1"]), "detail");
  assert.equal(classify(["schedule", "2026-09-21T04:00:00.000Z", "2026-09-28T04:00:00.000Z"]), "list");
  assert.equal(classify(["me"]), "reference");
});

test("nothing outside the list is saved on the device", () => {
  for (const key of [["assistant"], ["flinks-transactions"], ["security-audit-log"], ["/api/quickbooks/connect"], ["portal", "tok"], ["/api/payments/verify/q1"], [42]]) {
    assert.equal(shouldPersist(key), false, JSON.stringify(key));
  }
});

test("freshness: reference a day, lists 30 s, details on every open", () => {
  assert.equal(STALE_MS.reference, 86_400_000);
  assert.equal(STALE_MS.list, 30_000);
  assert.equal(STALE_MS.detail, 0);
});

const q = (hash: string, at: number, size = 10) => ({ queryKey: [hash], queryHash: hash, state: { dataUpdatedAt: at, data: "x".repeat(size) } });

test("prune drops answers older than the max age", () => {
  const now = Date.now();
  const { kept } = prune([q("new", now - 1000), q("old", now - MAX_AGE_MS - 1)], now);
  assert.deepEqual(kept.map((k) => k.queryHash), ["new"]);
});

test("prune keeps the newest answers within the byte budget", () => {
  const now = Date.now();
  const all = [q("a", now - 3000, 400), q("b", now - 1000, 400), q("c", now - 2000, 400)];
  const one = JSON.stringify(all[0]).length;
  const { kept, bytes } = prune(all, now, one * 2 + 5);
  assert.deepEqual(kept.map((k) => k.queryHash), ["b", "c"]);
  assert.ok(bytes <= one * 2 + 5);
});

test("jobs kept for the week: running, or planned to overlap it; never archived", () => {
  const now = new Date("2026-09-23T12:00:00"); // a Wednesday
  const base = { archivedAt: null, updatedAt: "2026-09-20T00:00:00Z" };
  const jobs = [
    { ...base, id: "running", status: "active", plannedStart: null, plannedEnd: null },
    { ...base, id: "starts-friday", status: "planning", plannedStart: "2026-09-25T08:00:00", plannedEnd: "2026-10-10T08:00:00" },
    { ...base, id: "next-month", status: "planning", plannedStart: "2026-10-20T08:00:00", plannedEnd: null },
    { ...base, id: "no-dates", status: "planning", plannedStart: null, plannedEnd: null },
    { ...base, id: "done", status: "completed", plannedStart: "2026-09-22T08:00:00", plannedEnd: null },
    { ...base, id: "archived", status: "active", plannedStart: null, plannedEnd: null, archivedAt: "2026-09-01T00:00:00Z" },
  ];
  assert.deepEqual(jobsThisWeek(jobs, now).map((j) => j.id).sort(), ["running", "starts-friday"]);
});

test("at most 15 job pages are fetched ahead, most recently changed first", () => {
  const jobs = Array.from({ length: 20 }, (_, i) => ({ id: `j${i}`, status: "active", archivedAt: null, plannedStart: null, plannedEnd: null, updatedAt: `2026-09-${String(i + 1).padStart(2, "0")}T00:00:00Z` }));
  const kept = jobsThisWeek(jobs, new Date("2026-09-23T12:00:00"));
  assert.equal(kept.length, 15);
  assert.equal(kept[0]!.id, "j19");
});
