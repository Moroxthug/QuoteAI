import test from "node:test";
import assert from "node:assert/strict";
import { firstOpenWindow, windowOpen, visitDays, visitRange, warrantyState, warrantyTone, openCalls, doneCalls, type ServiceCall } from "./serviceCalls.ts";

test("visit days skip the weekend and start tomorrow after 13:00", () => {
  const thu = new Date(2026, 9, 1, 9, 0);
  assert.deepEqual(visitDays(thu).map((d) => d.getDate()), [1, 2, 5, 6]);
  const late = new Date(2026, 9, 1, 14, 0);
  assert.deepEqual(visitDays(late).map((d) => d.getDate()), [2, 5, 6, 7]);
  assert.equal(visitDays(new Date(2026, 9, 3, 9, 0))[0]!.getDate(), 5);
});
test("a visit is the day at the window's local hours", () => {
  const r = visitRange(new Date(2026, 9, 2), 2);
  assert.equal(new Date(r.startsAt).getHours(), 13);
  assert.equal(new Date(r.endsAt).getHours(), 15);
});
test("warranty: covered, ended, or the job isn't finished", () => {
  assert.equal(warrantyState({ underWarranty: true, warrantyEndsAt: "2027-09-01" }), "covered");
  assert.equal(warrantyState({ underWarranty: false, warrantyEndsAt: "2025-09-01" }), "ended");
  assert.equal(warrantyState({ underWarranty: false, warrantyEndsAt: null }), "unfinished");
  assert.equal(warrantyTone({ covered: true, elapsedPercent: 90 }), "soon");
  assert.equal(warrantyTone({ covered: true, elapsedPercent: 10 }), "covered");
  assert.equal(warrantyTone({ covered: false, elapsedPercent: 100 }), "ended");
});
test("open means not done", () => {
  const c = (status: ServiceCall["status"]) => ({ status }) as ServiceCall;
  assert.equal(openCalls([c("open"), c("booked"), c("done")]).length, 2);
  assert.equal(doneCalls([c("open"), c("done")]).length, 1);
});
test("a window that has started is closed; the first open one is picked", () => {
  const day = new Date(2026, 9, 1);
  const at = new Date(2026, 9, 1, 9, 0);
  assert.equal(windowOpen(day, 0, at), false);
  assert.equal(windowOpen(day, 1, at), true);
  assert.equal(firstOpenWindow(day, at), 1);
  assert.equal(firstOpenWindow(new Date(2026, 9, 2), at), 0);
});
