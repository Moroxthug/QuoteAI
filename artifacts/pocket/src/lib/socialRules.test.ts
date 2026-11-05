import assert from "node:assert/strict";
import { test } from "node:test";
import { shownMethods } from "./socialRules.ts";

const both = { google: "id", apple: true };

test("shows only what the server has turned on", () => {
  assert.deepEqual(shownMethods({ google: null, apple: false }, "android"), []);
  assert.deepEqual(shownMethods({ google: "id", apple: false }, "ios"), ["google"]);
});

test("offers Apple on iOS only", () => {
  assert.deepEqual(shownMethods(both, "ios"), ["apple", "google"]);
  assert.deepEqual(shownMethods(both, "android"), ["google"]);
});

test("shows neither on the web build", () => {
  assert.deepEqual(shownMethods(both, "web"), []);
});
