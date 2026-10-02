import assert from "node:assert/strict";
import { test } from "node:test";
import { barHas, barOf, TAB_SCREEN } from "./roleTabs.ts";

test("the bar is Home and the three tabs, or the original four", () => {
  assert.deepEqual(barOf(null), ["home", "quotes", "jobs", "clients"]);
  assert.deepEqual(barOf(["jobs", "schedule", "team"]), ["home", "jobs", "schedule", "team"]);
});

test("unknown tabs and a fourth are dropped, Home is never repeated", () => {
  assert.deepEqual(barOf(["home", "nope", "jobs", "books", "pay", "map"]), ["home", "jobs", "books", "pay"]);
  assert.deepEqual(barOf(["nope"]), ["home", "quotes", "jobs", "clients"]);
});

test("every tab opens a screen, and the bar shows only on its own tabs", () => {
  for (const k of barOf(["jobs", "schedule", "team"])) assert.ok(TAB_SCREEN[k]);
  assert.ok(barHas(["home", "jobs"], "jobs"));
  assert.ok(!barHas(["home", "jobs"], "books"));
});
