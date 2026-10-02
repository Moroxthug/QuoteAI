import assert from "node:assert/strict";
import { test } from "node:test";
import { ROLES, ROLE_KEYS, SECTIONS, TABS, homeOf, lockedTabs, move, tabsOf, toggleTab } from "./jobRoles.ts";

test("every role has four sections and the tabs it needs, each one drawn", () => {
  for (const r of ROLE_KEYS) {
    assert.equal(ROLES[r].sections.length, 4, r);
    for (const s of ROLES[r].sections) assert.ok(SECTIONS[s], `${r} ${s}`);
    for (const t of ROLES[r].tabs) assert.ok(TABS[t], `${r} ${t}`);
    assert.ok(ROLES[r].tabs.length <= 3, r);
  }
});

test("a home starts with the role's four on and the extras off", () => {
  const h = homeOf("estimator", null);
  assert.deepEqual(h.map((x) => x.key), ["quotes", "visits", "win", "waiting", "needs", "weather", "leads"]);
  assert.deepEqual(h.map((x) => x.on), [true, true, true, true, false, false, false]);
});

test("the person's order and switches apply, and what they never saw is added at the end", () => {
  const h = homeOf("estimator", { order: ["win", "quotes", "gone"], on: { needs: true, visits: false } });
  assert.deepEqual(h.map((x) => x.key).slice(0, 3), ["win", "quotes", "visits"]);
  assert.equal(h.find((x) => x.key === "needs")!.on, true);
  assert.equal(h.find((x) => x.key === "visits")!.on, false);
  assert.ok(!h.some((x) => x.key === "gone"));
});

test("tabs are the person's pick when allowed, else the role's", () => {
  assert.deepEqual(tabsOf("estimator", null), ["quotes", "leads", "clients"]);
  assert.deepEqual(tabsOf("estimator", { tabs: ["jobs", "books", "schedule"] }), ["jobs", "schedule"]);
  assert.deepEqual(tabsOf("estimator", { tabs: ["books"] }), ["quotes", "leads", "clients"]);
  assert.deepEqual(tabsOf("bookkeeper", { tabs: ["books", "invoices"] }), ["books", "invoices"]);
});

test("toggling a tab: remove, add while there is room, refuse a fourth or a locked one", () => {
  const locked = lockedTabs("estimator");
  assert.deepEqual(toggleTab(["quotes", "leads"], "quotes", locked), { tabs: ["leads"], full: false });
  assert.deepEqual(toggleTab(["quotes"], "jobs", locked), { tabs: ["quotes", "jobs"], full: false });
  assert.deepEqual(toggleTab(["quotes", "leads", "clients"], "jobs", locked), { tabs: ["quotes", "leads", "clients"], full: true });
  assert.deepEqual(toggleTab(["quotes"], "books", locked), { tabs: ["quotes"], full: false });
});

test("move swaps neighbours and stops at the ends", () => {
  assert.deepEqual(move(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
  assert.deepEqual(move(["a", "b", "c"], 0, -1), ["a", "b", "c"]);
  assert.deepEqual(move(["a", "b", "c"], 2, 1), ["a", "b", "c"]);
});
