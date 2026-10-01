import assert from "node:assert/strict";
import { test } from "node:test";
import { clashDays, clashOf, freeWindows, hhmm, hoursOf, instants, lanes, piecesOn, trackPct, weekDays, weekStart } from "./schedule.ts";
import type { SchedBlock } from "./jobsApi.ts";

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const blk = (id: string, who: string | null, job: string | null, d: number, from: number, to: number, o: Partial<SchedBlock> = {}): SchedBlock => ({
  id, projectId: job, projectName: job, projectAddress: null, milestoneId: null, milestoneTitle: null, collaboratorId: who, collaboratorName: who, title: "", label: null,
  startsAt: at(d, Math.floor(from), (from % 1) * 60), endsAt: at(d, Math.floor(to), (to % 1) * 60), allDay: false, notes: "", conflicts: [], updatedAt: "", ...o,
});
const day = (d: number) => new Date(2026, 9, d, 12);

test("a week starts on Monday and has seven days", () => {
  assert.equal(weekStart(day(1)).getDate(), 28); // Thu Oct 1 -> Mon Sep 28
  assert.equal(weekStart(day(4)).getDate(), 28); // Sun
  assert.equal(weekStart(day(5)).getDate(), 5);
  assert.deepEqual(weekDays(weekStart(day(1))).map((d) => d.getDate()), [28, 29, 30, 1, 2, 3, 4]);
});

test("the pieces of blocks on a day, in local hours; an all-day block is the working window", () => {
  const ps = piecesOn([blk("a", "x", "j", 1, 7.5, 15.5), blk("b", "y", "j", 2, 8, 16), blk("c", "z", "j", 1, 0, 0, { allDay: true, startsAt: at(1, 0), endsAt: at(2, 0) })], day(1));
  assert.deepEqual(ps.map((p) => [p.block.id, p.from, p.to]), [["a", 7.5, 15.5], ["c", 7.5, 16]]);
});

test("a block that crosses midnight shows on both days", () => {
  const b = blk("n", "x", "j", 1, 22, 23, { endsAt: at(2, 3) });
  assert.deepEqual(piecesOn([b], day(1)).map((p) => [p.from, p.to]), [[22, 24]]);
  assert.deepEqual(piecesOn([b], day(2)).map((p) => [p.from, p.to]), [[0, 3]]);
});

test("a clash is the same person on two blocks at the same time", () => {
  const ps = piecesOn([blk("a", "lb", "harb", 1, 8, 12), blk("b", "lb", "gill", 1, 11, 15), blk("c", "dp", "gill", 1, 8, 12)], day(1));
  assert.equal(clashOf(ps[0]!, ps)?.block.id, "b");
  assert.equal(clashOf(ps.find((p) => p.block.id === "c")!, ps), null);
  assert.deepEqual(clashDays([blk("a", "lb", "h", 1, 8, 12), blk("b", "lb", "g", 1, 11, 15)], weekDays(weekStart(day(1)))), [false, false, false, true, false, false, false]);
});

test("free windows are two hours or more between 7:30 and 16:00", () => {
  const ps = piecesOn([blk("a", "x", "j", 1, 8, 10), blk("b", "x", "j", 1, 11, 13)], day(1));
  assert.deepEqual(freeWindows(ps), [[13, 16]]);
  assert.deepEqual(freeWindows([]), [[7.5, 16]]);
  assert.deepEqual(freeWindows(piecesOn([blk("a", "x", "j", 1, 7.5, 15.5)], day(1))), []);
});

test("lanes by person list everyone; by job only the jobs with blocks", () => {
  const blocks = [blk("a", "ao", "hart", 1, 8, 12), blk("b", "lb", "gill", 1, 8, 12)];
  const people = [{ id: "ao", name: "Amara" }, { id: "sm", name: "Sofia" }, { id: "lb", name: "Luca" }];
  const jobs = [{ id: "hart", name: "Hart" }, { id: "gill", name: "Gill" }, { id: "harb", name: "Harbourfront" }];
  const byPerson = lanes(blocks, day(1), "person", people, jobs, true);
  assert.deepEqual(byPerson.map((l) => [l.title, l.pieces.length]), [["Amara", 1], ["Sofia", 0], ["Luca", 1]]);
  assert.deepEqual(byPerson[1]!.free, [[7.5, 16]]);
  assert.deepEqual(lanes(blocks, day(1), "job", people, jobs, true).map((l) => l.title), ["Hart", "Gill"]);
  assert.deepEqual(lanes(blocks, day(1), "person", people, jobs, false)[1]!.free, []); // a weekend has no free gaps
});

test("track positions, clock text, hours, and the instants a block is saved with", () => {
  assert.equal(trackPct(7), 0);
  assert.equal(trackPct(12.5), 50);
  assert.equal(trackPct(20), 100);
  assert.equal(hhmm(7.5), "7:30");
  assert.equal(hhmm(16), "16:00");
  assert.equal(hhmm(10.99999), "11:00");
  assert.equal(hoursOf(piecesOn([blk("a", "x", "j", 1, 8, 12), blk("b", "x", "j", 1, 13, 14.5)], day(1))), 5.5);
  const i = instants(day(1), 8, 12.5);
  assert.equal(new Date(i.startsAt).getHours(), 8);
  assert.equal(new Date(i.endsAt).getMinutes(), 30);
});
