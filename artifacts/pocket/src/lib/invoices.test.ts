import assert from "node:assert/strict";
import { test } from "node:test";
import { canRemind, daysLate, daysUntilDue, openByUrgency, type InvoiceDto } from "./invoices.ts";

const now = new Date("2026-09-29T15:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
const inv = (o: Partial<InvoiceDto>): InvoiceDto => ({
  id: "i", number: "INV-1", type: "manual", status: "sent", title: null, projectName: null, clientName: "Hart", issueDate: day(-10), dueDate: day(5),
  customer: { name: "Hart", email: "h@x.ca" }, totalCents: 100_00, paidCents: 0, balanceCents: 100_00, sentAt: day(-9), viewedAt: null, paidAt: null, reminderCount: 0, lastReminderAt: null, archivedAt: null, ...o,
});

test("days late and until due", () => {
  assert.equal(daysLate(day(-9), now), 9);
  assert.equal(daysLate(day(3), now), 0);
  assert.equal(daysUntilDue(day(3), now), 3);
  assert.equal(daysUntilDue(day(-3), now), 0);
});

test("open invoices come most overdue first, then soonest due", () => {
  const list = openByUrgency([
    inv({ id: "later", dueDate: day(20) }),
    inv({ id: "soon", dueDate: day(2) }),
    inv({ id: "late3", status: "overdue", dueDate: day(-3) }),
    inv({ id: "late9", status: "overdue", dueDate: day(-9) }),
    inv({ id: "paid", status: "paid" }),
    inv({ id: "draft", status: "draft" }),
  ], now);
  assert.deepEqual(list.map((i) => i.id), ["late9", "late3", "soon", "later"]);
});

test("a reminder needs an email and a quiet three days", () => {
  assert.equal(canRemind(inv({}), now), true);
  assert.equal(canRemind(inv({ customer: { name: "x" } }), now), false);
  assert.equal(canRemind(inv({ lastReminderAt: day(-1) }), now), false);
  assert.equal(canRemind(inv({ lastReminderAt: day(-4) }), now), true);
});
