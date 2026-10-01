import assert from "node:assert/strict";
import { test } from "node:test";
import { crewGrid, jobClashes, mondayOf, relevantPeople, weekStarts, type Block } from "./jobSchedule.ts";

const at = (day: number, h: number) => new Date(2026, 9, day, h).toISOString(); // October 2026
const blk = (id: string, who: string, project: string, d: number, from: number, to: number, conflicts: string[] = []): Block => ({
  id, projectId: project, collaboratorId: who, collaboratorName: who.toUpperCase(), startsAt: at(d, from), endsAt: at(d, to), allDay: false, conflicts,
});

test("the Monday of a week; a weekend belongs to the week before", () => {
  assert.equal(mondayOf(new Date(2026, 9, 1, 9)).getDate(), 28); // Thu Oct 1 -> Mon Sep 28
  assert.equal(mondayOf(new Date(2026, 9, 1, 9)).getMonth(), 8);
  assert.equal(mondayOf(new Date(2026, 9, 4, 9)).getDate(), 28); // Sun Oct 4 -> Mon Sep 28
  assert.equal(mondayOf(new Date(2026, 9, 5, 9)).getDate(), 5);
  assert.deepEqual(weekStarts(new Date(2026, 9, 1), 4).map((d) => d.getDate()), [28, 5, 12, 19]);
});

test("a person's day is this job, another job, a clash, or free", () => {
  const rows = crewGrid([
    blk("1", "a", "job", 1, 8, 16), blk("2", "a", "other", 2, 8, 16), blk("3", "a", "job", 5, 8, 12),
    blk("4", "a", "other", 6, 9, 11, ["5"]), blk("5", "a", "job", 6, 8, 10, ["4"]),
  ], "job", [{ id: "a", name: "Amara" }, { id: "z", name: "Zed" }], new Date(2026, 9, 1), 4);
  const a = rows.find((r) => r.workerId === "a")!;
  // week of Sep 28: Mon, Tue free, Wed free, Thu Oct 1 = job, Fri Oct 2 = other
  assert.deepEqual(a.weeks[0], ["", "", "", "j", "o"]);
  // week of Oct 5: Mon job, Tue clash
  assert.deepEqual(a.weeks[1], ["j", "x", "", "", ""]);
  assert.deepEqual(rows.find((r) => r.workerId === "z")!.weeks[0], ["", "", "", "", ""]);
});

test("people booked on the job appear even when they are not assigned; people only on other jobs do not", () => {
  const rows = crewGrid([blk("1", "a", "job", 1, 8, 16), blk("2", "b", "other", 1, 8, 16)], "job", [{ id: "c", name: "Cy" }], new Date(2026, 9, 1), 4);
  const keep = relevantPeople(rows, new Set(["c"])).map((r) => r.workerId).sort();
  assert.deepEqual(keep, ["a", "c"]);
});

test("clashes touching the job, one per person and day", () => {
  const blocks = [blk("4", "a", "other", 6, 9, 11, ["5"]), blk("5", "a", "job", 6, 8, 10, ["4"]), blk("6", "b", "x", 7, 8, 9, ["7"]), blk("7", "b", "y", 7, 8, 9, ["6"])];
  const c = jobClashes(blocks, "job");
  assert.equal(c.length, 1);
  assert.equal(c[0]!.workerName, "A");
  assert.equal(c[0]!.day.getDate(), 6);
});
