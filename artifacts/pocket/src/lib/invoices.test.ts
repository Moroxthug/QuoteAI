import assert from "node:assert/strict";
import { test } from "node:test";
import { invoiceLook, canRemind, daysLate, daysUntilDue, openByUrgency, type InvoiceDto } from "./invoices.ts";

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

test("the look of an invoice", () => {
  assert.deepEqual(invoiceLook("paid", 0), { word: "paid", look: { tone: "ok", shape: "check" } });
  assert.equal(invoiceLook("sent", 9).word, "late");
  assert.equal(invoiceLook("overdue", 0).word, "late");
  assert.equal(invoiceLook("draft", 30).word, "draft");
  assert.equal(invoiceLook("partially_paid", 0).look.tone, "warn");
  assert.equal(invoiceLook("viewed", 0).look.shape, "q2");
});

// ── The Invoices list and the Invoice screen ──

test("kinds, filters and groups", async () => {
  const m = await import("./invoices.ts");
  const late = inv({ id: "a", status: "overdue", dueDate: day(-9) });
  const lateByDate = inv({ id: "b", status: "sent", dueDate: day(-2) });
  const open = inv({ id: "c", status: "partially_paid", dueDate: day(4), paidCents: 50_00, balanceCents: 50_00 });
  const draft = inv({ id: "d", status: "draft" });
  const sched = inv({ id: "e", status: "draft", scheduledFor: day(40) });
  const sentDraft = inv({ id: "e2", status: "draft", scheduledFor: day(-3) });
  const paidNow = inv({ id: "f", status: "paid", paidAt: now.toISOString(), balanceCents: 0 });
  const paidOld = inv({ id: "g", status: "paid", paidAt: day(-60), balanceCents: 0 });
  const voided = inv({ id: "h", status: "void" });
  assert.deepEqual([late, lateByDate, open, draft, sched, sentDraft, paidNow, paidOld, voided].map((i) => m.kindOf(i, now)), ["late", "late", "open", "draft", "scheduled", "draft", "paid", "paid", "void"]);
  assert.deepEqual([late, lateByDate, open, draft, sched, paidNow, paidOld, voided].map((i) => m.groupOf(i, now)), ["overdue", "overdue", "open", "draft", "draft", "paid", "paidEarlier", "void"]);
  assert.equal(m.matchesFilter("late", "unpaid"), true);
  assert.equal(m.matchesFilter("draft", "unpaid"), false);
  assert.equal(m.matchesFilter("scheduled", "draft"), false);
  assert.equal(m.matchesFilter("void", "all"), true);
  assert.equal(m.matchesSearch(late, "hart"), true);
  assert.equal(m.matchesSearch(late, "INV-1"), true);
  assert.equal(m.matchesSearch(late, "zzz"), false);
});

test("the figures at the top", async () => {
  const m = await import("./invoices.ts");
  const items = [
    inv({ id: "a", status: "overdue", dueDate: day(-9), balanceCents: 234_000 }),
    inv({ id: "b", status: "sent", dueDate: day(-47), balanceCents: 64_000 }),
    inv({ id: "c", status: "partially_paid", dueDate: day(4), balanceCents: 223_458 }),
    inv({ id: "d", status: "pending_confirmation", dueDate: day(9), balanceCents: 10_000 }),
    inv({ id: "e", status: "draft", totalCents: 433_920, balanceCents: 0 }),
    inv({ id: "f", status: "draft", scheduledFor: day(30), totalCents: 384_000, balanceCents: 0 }),
    inv({ id: "g", status: "paid", totalCents: 249_730, balanceCents: 0, issueDate: day(-20), dueDate: day(-1), paidAt: day(-2) }),
    inv({ id: "h", status: "paid", totalCents: 100_000, balanceCents: 0, issueDate: day(-30), dueDate: day(-20), paidAt: day(-8) }),
  ];
  assert.equal(m.outstandingCents(items), 234_000 + 64_000 + 223_458 + 10_000);
  assert.equal(m.overdueCents(items, now), 234_000 + 64_000);
  assert.deepEqual(m.aging(items, now), { current: 223_458 + 10_000, d1_30: 234_000, d31_60: 64_000, d61_90: 0, d90_plus: 0 });
  assert.deepEqual(m.draftsTotal(items, now), { cents: 433_920, count: 1 });
  assert.equal(m.paidThisMonth(items, now).count, 2);
  const s = m.payStats(items, now);
  assert.equal(s.late, 2);
  assert.equal(s.avgDays, 20);
  assert.equal(s.onTime, 0.5);
  assert.equal(m.groupTotal("overdue", items.filter((i) => m.groupOf(i, now) === "overdue")), 298_000);
  assert.equal(m.groupTotal("draft", items.filter((i) => m.groupOf(i, now) === "draft")), 433_920 + 384_000);
});

test("aging buckets follow the server", async () => {
  const m = await import("./invoices.ts");
  assert.deepEqual([0, 1, 30, 31, 60, 61, 90, 91].map(m.bucketOf), ["current", "d1_30", "d1_30", "d31_60", "d31_60", "d61_90", "d61_90", "d90_plus"]);
});

test("remind rules and the actions of each kind", async () => {
  const m = await import("./invoices.ts");
  assert.equal(m.remindBlock(inv({ customer: { name: "x" } }), now), "noEmail");
  assert.equal(m.remindBlock(inv({ lastReminderAt: day(-1) }), now), "recent");
  assert.equal(m.remindBlock(inv({}), now), null);
  const list = m.remindable([inv({ id: "a", status: "overdue", dueDate: day(-9) }), inv({ id: "b", status: "overdue", dueDate: day(-3), customer: { name: "y" } }), inv({ id: "c", status: "overdue", dueDate: day(-30) }), inv({ id: "d", dueDate: day(5) })], now);
  assert.deepEqual(list.map((i) => i.id), ["c", "a"]);
  assert.deepEqual(m.swipeActions("late"), ["remind", "gotPaid"]);
  assert.deepEqual(m.swipeActions("paid"), ["sendReceipt", "archive"]);
  assert.equal(m.mainAction("open"), "gotPaid");
  assert.equal(m.mainAction("void"), null);
  assert.equal(m.stateOf(inv({ status: "draft", scheduledFor: day(10) }), now).word, "scheduled");
  assert.equal(m.stateOf(inv({ status: "partially_paid", dueDate: day(3) }), now).look.shape, "q3");
});

test("an amount typed in either language", async () => {
  const m = await import("./invoices.ts");
  assert.equal(m.parseCents("2,340.00"), 234_000);
  assert.equal(m.parseCents("2 340,50"), 234_050);
  assert.equal(m.parseCents("2 340,50 $"), 234_050);
  assert.equal(m.parseCents("$1.200"), 120_000);
  assert.equal(m.parseCents("1,200"), 120_000);
  assert.equal(m.parseCents("12,5"), 1_250);
  assert.equal(m.parseCents("12.5"), 1_250);
  assert.equal(m.parseCents("2340"), 234_000);
  assert.equal(m.parseCents(""), 0);
  assert.equal(m.parseCents("abc"), 0);
  assert.equal(m.parseCents("."), 0);
  assert.equal(m.overpaidBy(100_00, 120_00), 20_00);
  assert.equal(m.overpaidBy(100_00, 80_00), 0);
});

test("the reminder schedule and its label", async () => {
  const m = await import("./invoices.ts");
  const i = { dueDate: day(-8), reminderCount: 1, status: "overdue" as const };
  const rows = m.reminderRows(i, [3, 7, 14], true);
  assert.deepEqual(rows.map((r) => r.state), ["sent", "scheduled", "scheduled"]);
  assert.equal(rows[1]!.at.toISOString(), new Date(new Date(day(-8)).getTime() + 7 * 86_400_000).toISOString());
  assert.equal(m.reminderSummary(rows, "overdue").kind, "next");
  const off = m.reminderRows(i, [3, 7, 14], false);
  assert.deepEqual(off.map((r) => r.state), ["sent", "off", "off"]);
  assert.equal(m.reminderSummary(off, "overdue").kind, "paused");
  assert.deepEqual(m.reminderRows({ ...i, status: "paid" }, [3, 7, 14], true).map((r) => r.state), ["sent", "cancelled", "cancelled"]);
  assert.equal(m.reminderSummary(m.reminderRows({ ...i, status: "paid" }, [3, 7, 14], true), "paid").kind, "stopped");
  assert.equal(m.reminderSummary(m.reminderRows({ ...i, reminderCount: 3 }, [3, 7, 14], true), "overdue").kind, "done");
});

test("activity lines", async () => {
  const m = await import("./invoices.ts");
  const e = (type: string, detail: Record<string, unknown> | null, at: string) => ({ id: type + at, type, actor: "contractor", detail, createdAt: at });
  assert.deepEqual(m.eventLine(e("payment_recorded", { amountCents: 100, method: "cash" }, "2026-09-01")), { key: "payment_recorded", amountCents: 100, method: "cash", to: undefined, number: undefined, manual: false });
  assert.equal(m.eventLine(e("something_new", null, "2026-09-01")).key, "other");
  assert.equal(m.eventLine(e("reminder_sent", { manual: true }, "2026-09-01")).manual, true);
  const list = [e("sent", null, "2026-09-02T10:00:00Z"), e("etransfer_reported", null, "2026-09-05T08:14:00Z"), e("created", null, "2026-09-01T10:00:00Z")];
  assert.deepEqual(m.newestFirst(list).map((x) => x.type), ["etransfer_reported", "sent", "created"]);
  assert.equal(m.claimedAt(list)?.toISOString(), "2026-09-05T08:14:00.000Z");
  assert.equal(m.claimedAt([]), null);
  assert.equal(m.typeKey("holdback_release"), "holdback");
  assert.equal(m.typeKey("whatever"), "manual");
  assert.equal(m.hasLink({ status: "draft" }), false);
  assert.equal(m.hasLink({ status: "sent" }), true);
});
