import test from "node:test";
import assert from "node:assert/strict";
import { actionOf, groupNotifications, look, targetOf, whenLabel, type NotificationDto } from "./notifications.ts";

const n = (id: string, at: string, over: Partial<NotificationDto> = {}): NotificationDto => ({ id, type: "quote_viewed", title: "t", body: "", link: null, entityType: null, entityId: null, readAt: null, createdAt: at, ...over });

test("notifications are grouped Today then Earlier, newest first", () => {
  const now = new Date(2026, 8, 29, 11, 0);
  const g = groupNotifications([n("old", new Date(2026, 8, 27, 9, 0).toISOString()), n("a", new Date(2026, 8, 29, 6, 30).toISOString()), n("b", new Date(2026, 8, 29, 9, 12).toISOString())], "all", now);
  assert.deepEqual(g.map((x) => x.key), ["today", "earlier"]);
  assert.deepEqual(g[0]!.rows.map((r) => r.id), ["b", "a"]);
});

test("the Unread filter keeps only what was not read, and drops an empty group", () => {
  const now = new Date(2026, 8, 29, 11, 0);
  const g = groupNotifications([n("a", new Date(2026, 8, 29, 6, 30).toISOString(), { readAt: "2026-09-29T07:00:00Z" }), n("old", new Date(2026, 8, 27, 9, 0).toISOString())], "unread", now);
  assert.deepEqual(g.map((x) => [x.key, x.rows.length]), [["earlier", 1]]);
});

test("a tap goes where the thing is, by what it is about", () => {
  assert.deepEqual(targetOf({ type: "invoice_overdue", entityType: "invoice", entityId: "i1" }), { screen: "Invoice", params: { id: "i1" } });
  assert.deepEqual(targetOf({ type: "quote_viewed", entityType: "quote", entityId: "q1" }), { screen: "Quote", params: { id: "q1" } });
  assert.deepEqual(targetOf({ type: "x", entityType: "project", entityId: "p1" }), { screen: "Job", params: { id: "p1" } });
  assert.deepEqual(targetOf({ type: "time_entry_submitted", entityType: "time_entry", entityId: "t1" }), { screen: "CrewHours" });
  assert.deepEqual(targetOf({ type: "time_entry_submitted", entityType: "pay_allowance", entityId: "a1" }), { screen: "Pay" });
  assert.deepEqual(targetOf({ type: "compliance_due", entityType: null, entityId: null }), { screen: "Compliance" });
  assert.equal(targetOf({ type: "sms_opt_out", entityType: null, entityId: null }), null);
  assert.equal(targetOf({ type: "x", entityType: "invoice", entityId: null }), null);
});

test("only three kinds carry a button", () => {
  assert.equal(actionOf("invoice_payment_reported"), "confirm");
  assert.equal(actionOf("time_entry_submitted"), "review");
  assert.equal(actionOf("invoice_overdue"), "remind");
  assert.equal(actionOf("quote_viewed"), null);
});

test("each kind has a glyph, and an unknown one the bell", () => {
  assert.deepEqual(look("quote_viewed"), { icon: "eye", tone: "violet" });
  assert.equal(look("never_heard_of_it").icon, "bell");
});

test("the time reads as a clock today, a weekday this week and a date before", () => {
  const now = new Date(2026, 8, 29, 11, 0);
  const f = (d: Date) => whenLabel(d, now, () => "clock", () => "weekday", () => "date");
  assert.equal(f(new Date(2026, 8, 29, 6, 30)), "clock");
  assert.equal(f(new Date(2026, 8, 27, 9, 0)), "weekday");
  assert.equal(f(new Date(2026, 8, 20, 9, 0)), "date");
});
