import assert from "node:assert/strict";
import { test } from "node:test";
import { barSlide, closedGeom, dragGeom, lerpGeom, openGeom, shouldClose } from "./cardOpen.ts";

const screen = { w: 390, h: 844 };

test("the page starts exactly over the card: its corner, its width, its height, its radius", () => {
  const g = closedGeom({ x: 16, y: 300, w: 342, h: 182 }, screen);
  assert.equal(g.x, 16);
  assert.equal(g.y, 300);
  assert.ok(Math.abs(g.scale - 342 / 390) < 1e-9);
  assert.ok(Math.abs(g.height * g.scale - 182) < 1e-9, "the clip is the card's height once scaled");
  assert.ok(Math.abs(g.radius * g.scale - 22) < 1e-9, "the corner is the card's 22 once scaled");
});

test("it ends full screen with no clip and square corners", () => {
  const o = openGeom(screen);
  assert.deepEqual(o, { x: 0, y: 0, scale: 1, height: 844, radius: 0 });
  assert.deepEqual(lerpGeom(closedGeom({ x: 16, y: 300, w: 342, h: 182 }, screen), o, 1), o);
});

test("a drag follows at .85x, shrinks to .86 and rounds the corners, and stops changing past 400", () => {
  const a = dragGeom(200, screen);
  assert.equal(a.y, 170);
  assert.ok(Math.abs(a.scale - 0.93) < 1e-9);
  assert.equal(a.radius, 72);
  assert.ok(Math.abs(a.scrim - 0.6) < 1e-9);
  assert.ok(Math.abs(a.homeScale - 0.96) < 1e-9);
  const z = dragGeom(900, screen);
  assert.ok(Math.abs(z.scale - 0.86) < 1e-9);
  assert.ok(Math.abs(z.scrim - 0.2) < 1e-9);
  assert.ok(Math.abs(z.homeScale - 0.98) < 1e-9);
});

test("110 points is the line: past it closes, under it springs back", () => {
  assert.equal(shouldClose(111), true);
  assert.equal(shouldClose(110), false);
  assert.equal(shouldClose(40), false);
});

test("the tab bar is gone by 70 % of the way", () => {
  assert.deepEqual(barSlide(0), { opacity: 1, translateY: 0 });
  assert.deepEqual(barSlide(0.7), { opacity: 0, translateY: 30 });
  assert.deepEqual(barSlide(1), { opacity: 0, translateY: 30 });
});
