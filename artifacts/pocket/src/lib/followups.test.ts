import test from "node:test";
import assert from "node:assert/strict";
import { fill, gapsOf, stepsOf } from "./followups.ts";

test("the steps are what the page remembers, else the server's touches counted from sending", () => {
  assert.deepEqual(stepsOf([2, 3, 5], {}), [{ day: 2, on: true }, { day: 5, on: true }, { day: 10, on: true }]);
  assert.deepEqual(stepsOf([], {}), [{ day: 2, on: false }, { day: 5, on: false }, { day: 10, on: false }]);
  assert.deepEqual(stepsOf([9], { followupDays: [2, 5], followupOn: [true, false] }), [{ day: 2, on: true }, { day: 5, on: false }]);
});

test("the server gets the days between the steps that send", () => {
  assert.deepEqual(gapsOf([{ day: 2, on: true }, { day: 5, on: true }, { day: 10, on: true }]), [2, 3, 5]);
  assert.deepEqual(gapsOf([{ day: 2, on: true }, { day: 5, on: false }, { day: 10, on: true }]), [2, 8]);
  assert.deepEqual(gapsOf([{ day: 2, on: false }]), []);
});

test("names and links fill in, and anything unknown stays as written", () => {
  assert.equal(fill("Hi {name}, {link} {nope}", { name: "Dana", link: "https://x" }), "Hi Dana, https://x {nope}");
});
