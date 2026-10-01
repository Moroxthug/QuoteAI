import assert from "node:assert/strict";
import { test } from "node:test";
import { greetingFor, needsCard, telHref, type NeedsYouItem } from "./home.ts";

const item = (o: Partial<NeedsYouItem>): NeedsYouItem => ({ id: "x:1", kind: "overdue", title: "", subtitle: "", at: null, href: "/dashboard/invoices/1", ...o });

test("greeting by the hour", () => {
  assert.equal(greetingFor(new Date(2026, 8, 29, 6)), "morning");
  assert.equal(greetingFor(new Date(2026, 8, 29, 11, 59)), "morning");
  assert.equal(greetingFor(new Date(2026, 8, 29, 12)), "afternoon");
  assert.equal(greetingFor(new Date(2026, 8, 29, 17)), "evening");
});

test("an overdue invoice that can be reminded is reminded in place", () => {
  const c = needsCard(item({ id: "overdue:inv-9", kind: "overdue", canRemind: true }));
  assert.deepEqual(c.action, { type: "remind", invoiceId: "inv-9" });
  assert.equal(c.doneInPlace, true);
  assert.equal(c.kind, "remind");
});

test("an overdue invoice that cannot be reminded opens the invoice", () => {
  const c = needsCard(item({ id: "overdue:inv-9", kind: "overdue", canRemind: false }));
  assert.deepEqual(c.action, { type: "open", screen: "Invoice", id: "inv-9" });
  assert.equal(c.doneInPlace, false);
});

test("a lead with a number is called, without one it opens Leads", () => {
  assert.deepEqual(needsCard(item({ id: "followup:l1", kind: "followup", phone: "(416) 555-0100" })).action, { type: "call", phone: "(416) 555-0100" });
  assert.deepEqual(needsCard(item({ id: "followup:l1", kind: "followup", phone: null })).action, { type: "open", screen: "Leads" });
});

test("a waiting quote opens the quote or calls", () => {
  assert.deepEqual(needsCard(item({ id: "waiting:q1", kind: "waiting" })).action, { type: "open", screen: "Quote", id: "q1" });
  assert.equal(needsCard(item({ id: "waiting:q1", kind: "waiting", phone: "6475550121" })).action.type, "call");
});

test("hours, e-Transfers and blockers open their screens", () => {
  assert.deepEqual(needsCard(item({ id: "hours", kind: "hours" })).action, { type: "open", screen: "Timesheets" });
  assert.deepEqual(needsCard(item({ id: "etransfer:i2", kind: "etransfer" })).action, { type: "open", screen: "Invoice", id: "i2" });
  assert.deepEqual(needsCard(item({ id: "blocker:b1", kind: "blocker", href: "/dashboard/jobs/job-7" })).action, { type: "open", screen: "Job", id: "job-7" });
});

test("tel keeps digits and a leading plus", () => {
  assert.equal(telHref("+1 (416) 555-0100"), "tel:+14165550100");
});
