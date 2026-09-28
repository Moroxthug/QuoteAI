// Phase 120: the decisions behind the app's motion (decide.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { edgeGoesBack, navKind, rowCommits, rubberBand, sheetCloses, velocityTracker } from "./decide";

test("a new screen in the app slides; a query change, a tab tap and leaving the app don't", () => {
  assert.equal(navKind("/dashboard/quotes", "/dashboard/quotes/abc", null), "push");
  assert.equal(navKind("/dashboard", "/dashboard/jobs/1?tab=costs", null), "push");
  assert.equal(navKind("/dashboard/jobs/1", "/dashboard/jobs/1?tab=costs", null), "none");
  assert.equal(navKind("/dashboard/jobs/", "/dashboard/jobs#top", null), "none");
  assert.equal(navKind("/dashboard/quotes", "/dashboard/jobs", "tab"), "tab");
  assert.equal(navKind("/dashboard", "/sign-in", null), "none");
  assert.equal(navKind("/sign-in", "/dashboard", null), "none");
  assert.equal(navKind("/t/abc", "/t/abc/report", null), "push");
});

test("a sheet closes past 30 % of its height or on a flick, never upward", () => {
  assert.equal(sheetCloses(100, 400, 0.1), false);
  assert.equal(sheetCloses(121, 400, 0.1), true);
  assert.equal(sheetCloses(40, 400, 0.8), true);
  assert.equal(sheetCloses(-50, 400, 2), false);
});

test("the iOS edge swipe goes back past 40 % or on a flick of more than a nudge", () => {
  assert.equal(edgeGoesBack(150, 390, 0.2), false);
  assert.equal(edgeGoesBack(157, 390, 0.2), true);
  assert.equal(edgeGoesBack(60, 390, 0.9), true);
  assert.equal(edgeGoesBack(10, 390, 3), false);
});

test("a swiped row commits past 40 % (at most 140 px) or on a flick", () => {
  assert.equal(rowCommits(120, 280, 0), true); // 40 % of 280 = 112
  assert.equal(rowCommits(130, 390, 0), false);
  assert.equal(rowCommits(141, 390, 0), true); // capped at 140
  assert.equal(rowCommits(60, 390, 0.7), true);
  assert.equal(rowCommits(30, 390, 2), false);
});

test("past its limit a drag keeps following, slowly", () => {
  assert.equal(rubberBand(50, 100), 50);
  assert.equal(rubberBand(200, 100), 135);
});

test("velocity is measured over the last 80 ms only", () => {
  const v = velocityTracker();
  v.add(0, 0);
  v.add(10, 100); // the first sample falls out of the window
  v.add(40, 150);
  assert.equal(v.speed(), 0.6);
  v.reset();
  assert.equal(v.speed(), 0);
});
