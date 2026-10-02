import assert from "node:assert/strict";
import { test } from "node:test";
import { chapterAt, clampPos, clock, knobX, segmentFill, VIDEOS, type Chapter } from "./videos.ts";

const ch: Chapter[] = [{ at: 0, title: "a", caption: "" }, { at: 14, title: "b", caption: "" }, { at: 38, title: "c", caption: "" }, { at: 58, title: "d", caption: "" }];

test("seconds as a clock", () => {
  assert.equal(clock(72), "1:12");
  assert.equal(clock(60), "1:00");
  assert.equal(clock(58), "0:58");
  assert.equal(clock(-3), "0:00");
});

test("the chapter at a position", () => {
  assert.equal(chapterAt(ch, 0), 0);
  assert.equal(chapterAt(ch, 34), 1);
  assert.equal(chapterAt(ch, 58), 3);
  assert.equal(chapterAt(ch, 72), 3);
});

test("each segment fills as the position passes it", () => {
  assert.deepEqual(segmentFill(ch, 72, 34).map((n) => Math.round(n * 100) / 100), [1, 0.83, 0, 0]);
  assert.deepEqual(segmentFill(ch, 72, 72), [1, 1, 1, 1]);
});

test("the knob is at the start, and at the end of the bar", () => {
  assert.equal(knobX(ch, 72, 0, 350), 0);
  assert.ok(knobX(ch, 72, 72, 350) > 340);
});

test("positions stay inside the video; two have players", () => {
  assert.equal(clampPos(-5, 72), 0);
  assert.equal(clampPos(99, 72), 72);
  assert.equal(VIDEOS.filter((v) => v.playable).length, 2);
});
