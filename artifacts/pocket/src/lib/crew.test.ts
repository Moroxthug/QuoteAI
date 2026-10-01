import assert from "node:assert/strict";
import { test } from "node:test";
import { entryLook, handHours, handNote, hm, hoursLabel, hoursOn, lastDays, linkProblem, timer, travelTotals, workedToday, type CrewEntry } from "./crew.ts";

const entry = (o: Partial<CrewEntry> = {}): CrewEntry => ({
  id: "e", projectId: "j", projectName: "Hart", milestoneId: null, milestoneTitle: null, date: "2026-09-29", hours: 8, note: "", status: "submitted", rejectedReason: null,
  clockInAt: null, clockOutAt: null, geofenceFlagged: false, createdAt: "", ...o,
});

test("why a link doesn't open", () => {
  assert.equal(linkProblem({ status: 0 }), "offline");
  assert.equal(linkProblem({ status: 410, code: "EXPIRED" }), "expired");
  assert.equal(linkProblem({ status: 410, code: "REPLACED" }), "replaced");
  assert.equal(linkProblem({ status: 404, code: "INVALID" }), "invalid");
  assert.equal(linkProblem({ status: 500 }), null);
});

test("the timer and the hours and minutes it holds", () => {
  assert.equal(timer((2 * 3600 + 41 * 60 + 8) * 1000), "2:41:08");
  assert.equal(timer(-5), "0:00:00");
  assert.deepEqual(hm((2 * 3600 + 41 * 60 + 8) * 1000), { h: 2, m: 41 });
  assert.deepEqual(hoursLabel(8.0333), { h: 8, m: 2 });
  assert.deepEqual(hoursLabel(7.5), { h: 7, m: 30 });
});

test("worked today counts closed sessions today and the open one", () => {
  const now = new Date("2026-09-29T15:00:00Z");
  const closed = entry({ id: "a", clockInAt: "2026-09-29T11:00:00Z", clockOutAt: "2026-09-29T12:00:00Z" });
  const open = entry({ id: "b", clockInAt: "2026-09-29T13:00:00Z" });
  const old = entry({ id: "c", date: "2026-09-28", clockInAt: "2026-09-28T11:00:00Z", clockOutAt: "2026-09-28T19:00:00Z" });
  assert.equal(workedToday([closed, open, old], open, "2026-09-29", now), 3 * 3_600_000);
  assert.equal(workedToday([], null, "2026-09-29", now), 0);
});

test("hours on a set of days", () => {
  const es = [entry({ date: "2026-09-28", hours: 8 }), entry({ date: "2026-09-29", hours: 2.5 }), entry({ date: "2026-09-20", hours: 9 })];
  assert.equal(hoursOn(es, ["2026-09-28", "2026-09-29"]), 10.5);
});

test("an hours row: off site flags until approved, rejected is red, the rest wait", () => {
  assert.equal(entryLook({ status: "approved", geofenceFlagged: false }).key, "approved");
  assert.equal(entryLook({ status: "submitted", geofenceFlagged: false }).key, "toApprove");
  assert.equal(entryLook({ status: "submitted", geofenceFlagged: true }).key, "offSite");
  assert.equal(entryLook({ status: "approved", geofenceFlagged: true }).key, "approved");
  assert.equal(entryLook({ status: "rejected", geofenceFlagged: false }).tone, "bad");
});

test("a day by hand: finish minus start minus the break, never negative", () => {
  assert.equal(handHours(420, 930, 30), 8);
  assert.equal(handHours(420, 690, 0), 4.5);
  assert.equal(handHours(600, 610, 30), 0);
  assert.equal(handNote("Phone died", 420, 930, 30, " back wall "), "Phone died · 7:00–15:30, break 30 min · back wall");
  assert.equal(handNote("Forgot to clock", 420, 690, 0, ""), "Forgot to clock · 7:00–11:30");
});

test("the last days, newest first, across a month end", () => {
  assert.deepEqual(lastDays("2026-10-02", 4), ["2026-10-02", "2026-10-01", "2026-09-30", "2026-09-29"]);
});

test("travel totals: distance, days away and what still waits on the office", () => {
  const a = (kind: "mileage" | "per_diem", quantity: number, status: string) => ({ id: "x", date: "2026-09-25", kind, quantity, note: "", projectName: null, status, rejectedReason: null });
  assert.deepEqual(travelTotals([a("mileage", 22, "approved"), a("mileage", 48, "submitted"), a("per_diem", 2, "approved"), a("per_diem", 1, "submitted")]), { km: 70, days: 3, waiting: 2 });
});
