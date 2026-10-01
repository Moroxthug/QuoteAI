import test from "node:test";
import assert from "node:assert/strict";
import { entryFlags, hourBars, linkState, seatShare, seatsFull, teamKpis, validEmail, type TimeRow } from "./team.ts";
import type { Worker } from "./teamApi.ts";

const w = (o: Partial<Worker>): Worker => ({ id: "w", name: "Amara Okafor", role: "", email: "", phone: "", hourlyRateCents: 3100, workerType: "employee", payrollId: "", burdenPercent: 18, active: true, canAddTasks: false, hasInvite: false, inviteExpiresAt: null, lastTimeEntryAt: null, hoursThisMonth: 0, pendingCount: 0, createdAt: "", ...o });
const e = (o: Partial<TimeRow>): TimeRow => ({ id: "e", workerId: "w", workerName: "A", projectId: "p", projectName: "P", date: "2026-09-28", hours: 8, overtimeHours: 0, holidayHours: 0, note: null, status: "submitted", enteredBy: "worker", clockInAt: null, clockOutAt: null, geofenceFlagged: false, costCents: 0, ...o });

test("link: none, sent, then active once they have clocked", () => {
  assert.equal(linkState({ hasInvite: false, lastTimeEntryAt: null }), "none");
  assert.equal(linkState({ hasInvite: true, lastTimeEntryAt: null }), "sent");
  assert.equal(linkState({ hasInvite: true, lastTimeEntryAt: "2026-09-28T10:00:00Z" }), "active");
});
test("figures: staff and subs, month hours, what waits", () => {
  const k = teamKpis([w({ hoursThisMonth: 100.4 }), w({ id: "2", workerType: "subcontractor", hoursThisMonth: 44 }), w({ id: "3", active: false, hoursThisMonth: 9 })], [e({ hours: 8.3 }), e({ hours: 6.5 })]);
  assert.deepEqual(k, { crew: 2, staff: 1, subs: 1, monthHours: 144, pending: 2, pendingHours: 14.8 });
});
test("bars scale to the longest and never divide by zero", () => {
  const b = hourBars([w({ id: "1", hoursThisMonth: 50 }), w({ id: "2", name: "Dev Patel", hoursThisMonth: 25 })]);
  assert.deepEqual(b.map((x) => [x.name, x.width]), [["Amara", 100], ["Dev", 50]]);
  assert.equal(hourBars([w({ hoursThisMonth: 0 })])[0]!.width, 0);
});
test("entry flags: overtime, off site, the weekend; else who logged it", () => {
  assert.deepEqual(entryFlags(e({ overtimeHours: 2.4 })), ["overtime"]);
  assert.deepEqual(entryFlags(e({ geofenceFlagged: true, date: "2026-09-26" })), ["offsite", "weekend"]);
  assert.deepEqual(entryFlags(e({ enteredBy: "owner" })), ["byHand"]);
  assert.deepEqual(entryFlags(e({})), ["worker"]);
});
test("seats and email", () => {
  assert.equal(seatsFull({ used: 5, limit: 5 }), true);
  assert.equal(seatShare({ used: 3, limit: 5 }), 60);
  assert.equal(validEmail("office@rossireno.ca"), true);
  assert.equal(validEmail("nope"), false);
});
import { hoursByJob, periodTotals, realHourlyCents } from "./team.ts";
test("real cost adds the burden", () => assert.equal(realHourlyCents(3100, 18), 3658));
test("period totals: overtime split out, rejected left out", () => {
  const t = periodTotals([e({ hours: 10.4, overtimeHours: 2.4, status: "approved", costCents: 100 }), e({ hours: 8, status: "submitted", costCents: 50 }), e({ hours: 5, status: "rejected" })]);
  assert.equal(t.hours, 18.4);
  assert.equal(t.overtime, 2.4);
  assert.equal(t.regular, 16);
  assert.equal(t.toApprove, 8);
  assert.equal(t.costCents, 150);
});
test("hours by job, biggest first", () => {
  const l = hoursByJob([e({ projectId: "a", projectName: "A", hours: 3 }), e({ projectId: "b", projectName: "B", hours: 5 }), e({ projectId: "a", projectName: "A", hours: 4 })]);
  assert.deepEqual(l.map((x) => [x.name, x.hours]), [["A", 7], ["B", 5]]);
});
