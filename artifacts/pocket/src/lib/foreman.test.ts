import test from "node:test";
import assert from "node:assert/strict";
import { crewLines, hoursTotal, nextUp, onSiteCount, type ForemanJob } from "./foreman.ts";

const blk = (o: Partial<ForemanJob["crew"][number]>) => ({ blockId: "b", workerId: "w1", workerName: "Amara", startsAt: "2026-09-29T11:00:00Z", endsAt: "2026-09-29T19:00:00Z", allDay: false, title: "", clockedInAt: null, clockedInElsewhere: false, ...o });
const jobs: ForemanJob[] = [
  { jobId: "j1", jobName: "Galloway Rd", address: null, crew: [blk({ clockedInAt: "2026-09-29T11:05:00Z" }), blk({ blockId: "c", workerId: "w2", workerName: "Sofia" })] },
  { jobId: "j2", jobName: "Okoye", address: null, crew: [blk({ blockId: "d", clockedInElsewhere: true })] },
];

test("a person booked twice shows on site first", () => {
  const l = crewLines(jobs);
  assert.equal(l.length, 2);
  assert.equal(l[0]!.name, "Amara");
  assert.equal(l[0]!.state, "on");
  assert.equal(l[1]!.state, "later");
  assert.equal(onSiteCount(l), 1);
});
test("hours add to one decimal", () => assert.equal(hoursTotal([{ hours: 2.8 }, { hours: 2.5 }, { hours: 0.05 }]), 5.4));
test("next up skips what is over", () => {
  const n = nextUp(jobs, new Date("2026-09-29T20:00:00Z"));
  assert.equal(n.length, 0);
  assert.equal(nextUp(jobs, new Date("2026-09-29T12:00:00Z")).length, 3);
});
