import assert from "node:assert/strict";
import { test } from "node:test";
import { crewOnJob, hoursOnJob, hoursText, hoursToApprove } from "./jobTeam.ts";
import type { JobDetail, TimeEntryRow } from "./jobDetail.ts";

const te = (o: Partial<TimeEntryRow>): TimeEntryRow => ({ id: "t", workerId: "a", workerName: "Amara", projectId: "j", milestoneId: null, date: "2026-09-28", hours: 8, status: "approved", ...o });
const d = (entries: TimeEntryRow[]) => ({
  timeEntries: entries,
  assignments: [{ id: "as1", collaboratorId: "a", roleInProject: "", collaboratorName: "Amara", collaboratorRole: "Drywall", collaboratorHourlyRate: 3500, workerType: "employee", active: true }],
}) as unknown as JobDetail;

test("only submitted hours wait for approval", () => {
  const x = d([te({ id: "1", status: "submitted" }), te({ id: "2" }), te({ id: "3", status: "rejected" })]);
  assert.deepEqual(hoursToApprove(x).map((e) => e.id), ["1"]);
});

test("a person's hours on the job count once approved", () => {
  const x = d([te({ hours: 8 }), te({ hours: 4.5 }), te({ hours: 3, status: "submitted" }), te({ workerId: "b", hours: 2 })]);
  assert.equal(hoursOnJob(x, "a"), 12.5);
  assert.equal(hoursOnJob(x, "b"), 2);
});

test("the crew is the assigned people plus anyone with hours but no assignment", () => {
  const x = d([te({ hours: 8 }), te({ workerId: "b", workerName: "Jonah", hours: 2 })]);
  const c = crewOnJob(x);
  assert.deepEqual(c.map((r) => [r.name, r.role, r.hours, r.assignmentId]), [["Amara", "Drywall", 8, "as1"], ["Jonah", "", 2, null]]);
});

test("hours show one decimal at most", () => {
  assert.equal(hoursText(7.5), 7.5);
  assert.equal(hoursText(8), 8);
  assert.equal(hoursText(7.4999), 7.5);
});
