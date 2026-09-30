import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLinearGradient } from "./gradient.ts";

test("dusk: bottom-up fade, px stops along the screen height", () => {
  const g = parseLinearGradient("linear-gradient(0deg,#ece6f8 0,#f0edf9 220px,#f3f5f8 560px)", 390, 844);
  assert.deepEqual(g.colors, ["#ece6f8", "#f0edf9", "#f3f5f8"]);
  assert.equal(g.locations[0], 0);
  assert.ok(Math.abs(g.locations[1] - 220 / 844) < 1e-9);
  assert.ok(Math.abs(g.locations[2] - 560 / 844) < 1e-9);
  assert.ok(Math.abs(g.start.y - 1) < 1e-9 && Math.abs(g.end.y) < 1e-9);
});

test("iris: rgba() colours keep their commas", () => {
  const g = parseLinearGradient("linear-gradient(180deg,rgba(106,47,191,.085) 0,rgba(106,47,191,.03) 220px,rgba(106,47,191,0) 420px)", 390, 844);
  assert.deepEqual(g.colors, ["rgba(106,47,191,.085)", "rgba(106,47,191,.03)", "rgba(106,47,191,0)"]);
  assert.ok(Math.abs(g.start.y) < 1e-9 && Math.abs(g.end.y - 1) < 1e-9);
});

test("veil: percentage stops and a diagonal", () => {
  const g = parseLinearGradient("linear-gradient(160deg,#f3f5f8 0%,#f2f1f9 55%,#eee9f8 100%)", 390, 844);
  assert.deepEqual(g.locations, [0, 0.55, 1]);
  assert.ok(g.start.x < 0.5 && g.end.x > 0.5);
});
