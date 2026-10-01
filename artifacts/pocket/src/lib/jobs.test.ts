import assert from "node:assert/strict";
import { test } from "node:test";
import { clashes, costPct, daysUntil, glance, invoicedPct, jobState, marginPct, matchesFilter, receiptsToReview, toInvoiceCents, type Job } from "./jobs.ts";

const job = (o: Partial<Job> = {}): Job => ({
  id: "j", name: "Basement finish", status: "active", setupStatus: "confirmed", clientId: "c", clientName: "Tom & Lena Hart", address: "", totalValueCents: 4_235_500,
  plannedStart: null, plannedEnd: null, progressPercent: 64, completedAt: null, createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-02T12:00:00Z", milestoneCount: 4, milestonesDone: 2, nextMilestone: null,
  crewCount: 0, crew: [], invoicedCents: 1_948_400, costCents: 2_710_700, pendingReceiptCount: 0, pendingReceiptCents: 0, ...o,
});

test("a job's state: setup review wins, completed wins over everything", () => {
  assert.equal(jobState(job({ setupStatus: "pending_review", status: "planning" })), "setup");
  assert.equal(jobState(job({ status: "suspended" })), "hold");
  assert.equal(jobState(job({ status: "planning" })), "planning");
  assert.equal(jobState(job({ status: "completed", setupStatus: "pending_review" })), "done");
});

test("All means open: everything but Completed", () => {
  assert.equal(matchesFilter("done", "all"), false);
  assert.equal(matchesFilter("hold", "all"), true);
  assert.equal(matchesFilter("hold", "active"), false);
  assert.equal(matchesFilter("done", "done"), true);
});

test("to invoice is what is earned and not yet invoiced, never negative", () => {
  assert.equal(toInvoiceCents(job()), Math.round(4_235_500 * 0.64) - 1_948_400);
  assert.equal(toInvoiceCents(job({ invoicedCents: 9_999_999 })), 0);
});

test("percentages round and stay null without a value", () => {
  assert.equal(invoicedPct(job()), 46);
  assert.equal(costPct(job()), 64);
  assert.equal(invoicedPct(job({ totalValueCents: 0 })), null);
  assert.equal(marginPct(job()), Math.round(((1_948_400 - 2_710_700) / 1_948_400) * 100));
  assert.equal(marginPct(job({ invoicedCents: 0 })), null);
});

test("the glance counts active jobs only and names the job with the most to invoice", () => {
  const a = job({ id: "a", totalValueCents: 1_000_000, progressPercent: 50, invoicedCents: 100_000, clientName: "A" });
  const b = job({ id: "b", totalValueCents: 1_000_000, progressPercent: 90, invoicedCents: 100_000, clientName: "B" });
  const p = job({ id: "p", status: "planning", totalValueCents: 5_000_000 });
  const g = glance([a, b, p]);
  assert.equal(g.inProgressCount, 2);
  assert.equal(g.inProgressCents, 2_000_000);
  assert.equal(g.toInvoiceCents, 400_000 + 800_000);
  assert.equal(g.toInvoiceTop?.id, "b");
});

test("receipts to review sum across jobs and name the busiest one", () => {
  assert.equal(receiptsToReview([job()]), null);
  const r = receiptsToReview([job({ id: "a", pendingReceiptCount: 1, pendingReceiptCents: 1000 }), job({ id: "b", pendingReceiptCount: 3, pendingReceiptCents: 61_240 })]);
  assert.equal(r?.count, 4);
  assert.equal(r?.cents, 62_240);
  assert.equal(r?.top.id, "b");
});

test("days until counts calendar days from local midnight", () => {
  const now = new Date(2026, 8, 30, 23, 30);
  assert.equal(daysUntil("2026-10-02", now), 2);
  assert.equal(daysUntil("2026-09-30", now), 0);
  assert.equal(daysUntil("2026-09-28", now), -2);
});

test("a worker booked on two jobs at once is a clash; back to back is not", () => {
  const blk = (workerId: string, from: string, to: string) => ({ workerId, workerName: "Luca", startsAt: `2026-10-01T${from}:00Z`, endsAt: `2026-10-01T${to}:00Z`, allDay: false });
  const day = [
    { jobId: "1", jobName: "Hart", crew: [blk("w", "13:00", "17:00"), blk("x", "13:00", "17:00")] },
    { jobId: "2", jobName: "Clinic", crew: [blk("w", "14:00", "16:00"), blk("x", "17:00", "19:00")] },
  ];
  const c = clashes(day);
  assert.equal(c.length, 1);
  assert.equal(c[0]!.workerId, "w");
  assert.equal(c[0]!.from.toISOString(), "2026-10-01T14:00:00.000Z");
  assert.equal(c[0]!.to.toISOString(), "2026-10-01T16:00:00.000Z");
});
