import assert from "node:assert/strict";
import { test } from "node:test";
import { activeTabOf, barHiddenOn } from "./barRoutes.ts";

test("the bar is hidden on sign-in, setup, the assistant and the gallery, shown elsewhere", () => {
  for (const p of ["/", "/sign-in", "/onboarding", "/assistant", "/whats-new", "/sandbox", "/sandbox/motion", "/crew-now"]) assert.ok(barHiddenOn(p), p);
  for (const p of ["/home", "/quotes", "/settings", "/set-roles", "/job", "/menu", "/home/"]) assert.ok(!barHiddenOn(p), p);
});

test("the active tab is the one whose screen is open", () => {
  const routes = { home: "/home", quotes: "/quotes", jobs: "/jobs" };
  assert.equal(activeTabOf("/quotes", routes), "quotes");
  assert.equal(activeTabOf("/home/", routes), "home");
  assert.equal(activeTabOf("/settings", routes), null);
});
