import assert from "node:assert/strict";
import { test } from "node:test";
import { budgetBars, currentMilestone, figures, jobWindow, milestoneCounts, segments, tasksDoneShare, upNext } from "./jobPage.ts";
import type { JobDetail, JobMilestone, JobTask } from "./jobDetail.ts";

const task = (status: string): JobTask => ({ id: status + Math.random(), milestoneId: "m", title: "t", description: "", status, dueDate: null, sortOrder: 0, addedFromFieldBy: null, updatedAt: "" });
const ms = (id: string, status: JobMilestone["status"], tasks: JobTask[] = [], o: Partial<JobMilestone> = {}): JobMilestone => ({
  id, key: id, title: id, description: "", sortOrder: 0, plannedStart: null, plannedEnd: null, actualStart: null, actualEnd: null, status, paymentTermId: null, paymentTermLabel: null, paymentAmountCents: null,
  sourceChapter: null, valueCents: 0, updatedAt: "", tasks, ...o,
});
const detail = (o: Partial<JobDetail> = {}): JobDetail => ({
  job: { id: "j", name: "Basement", description: "", status: "active", setupStatus: "confirmed", quoteId: null, clientId: null, contractId: null, address: "", province: null, latitude: null, longitude: null, geofenceRadiusMeters: null,
    contractValueCents: 3_840_000, changeOrdersCents: 395_500, totalValueCents: 4_235_500, plannedStart: null, plannedEnd: null, progressPercent: 64, completedAt: null, createdAt: "", updatedAt: "", archivedAt: null, client: null,
    contract: { id: "c", contractNumber: "C-1", status: "signed", signedAt: null, hasSignedPdf: false, language: "en", paymentSchedule: { terms: [{ id: "t3", label: "Term 3", amountType: "percent", value: 20 }] }, total: 38400, subtotal: 0, customerName: "" }, quote: null },
  milestones: [], unassignedTasks: [], budget: [], budgetTotalCents: 2_850_000, changeOrders: [], costs: { totalCents: 1_838_000, pendingCents: 61_240, pendingCount: 3, byCategory: { materials: 684_000, labour: 742_000, subcontractor: 270_000, permits_fees: 85_000, equipment: 41_000, misc: 16_000 }, entries: [] },
  timeEntries: [], equipmentUsage: [], assignments: [], invoices: [], invoiceTotals: { invoicedCents: 1_962_000, collectedCents: 1_728_000, outstandingCents: 234_000, overdueCents: 234_000, draftCount: 0 }, ...o,
});

test("milestones done and the current one", () => {
  const list = [ms("a", "completed"), ms("b", "in_progress"), ms("c", "planned")];
  assert.deepEqual(milestoneCounts(list), { done: 1, total: 3 });
  assert.equal(currentMilestone(list)?.id, "b");
  assert.equal(currentMilestone([ms("a", "completed"), ms("c", "planned")])?.id, "c");
  assert.equal(currentMilestone([ms("a", "completed")]), null);
});

test("segments: done, the current one by its tasks (half without any), the rest empty", () => {
  const list = [ms("a", "completed"), ms("b", "in_progress", [task("done"), task("done"), task("todo"), task("todo")]), ms("c", "planned")];
  assert.deepEqual(segments(list), [{ state: "done", fill: 1 }, { state: "current", fill: 0.5 }, { state: "todo", fill: 0 }]);
  assert.equal(tasksDoneShare(ms("x", "planned")), null);
  assert.deepEqual(segments([ms("b", "in_progress")])[0], { state: "current", fill: 0.5 });
});

test("figures: costs of the budget, projected margin on the larger of budget and spent", () => {
  const f = figures(detail());
  assert.equal(f.costPct, 64);
  assert.equal(f.pendingReceipts, 3);
  assert.equal(f.marginCents, 4_235_500 - 2_850_000);
  assert.equal(f.marginPct, 33);
  assert.equal(f.onTarget, true);
  const over = figures(detail({ costs: { ...detail().costs, totalCents: 3_900_000 } }));
  assert.equal(over.marginPct, 8);
  assert.equal(over.onTarget, false);
  assert.equal(figures(detail({ budgetTotalCents: 0 })).costPct, null);
});

test("budget bars: warn past 85 %, bad over budget, permits never warn", () => {
  const d = detail({ budget: [
    { id: "1", category: "materials", chapterRef: null, label: "", plannedCents: 920_000, sortOrder: 0 },
    { id: "2", category: "labour", chapterRef: null, label: "", plannedCents: 700_000, sortOrder: 1 },
    { id: "3", category: "permits_fees", chapterRef: null, label: "", plannedCents: 85_000, sortOrder: 2 },
    { id: "4", category: "equipment", chapterRef: null, label: "", plannedCents: 50_000, sortOrder: 3 },
  ] });
  const by = Object.fromEntries(budgetBars(d).map((b) => [b.category, b.tone]));
  assert.equal(by.materials, "ok"); // 684 of 920 = 74 %
  assert.equal(by.labour, "bad"); // 742 of 700
  assert.equal(by.permits_fees, "ok"); // 100 % but a fixed fee
  assert.equal(by.equipment, "ok"); // 41 of 50 = 82 %
  assert.equal(budgetBars(d).some((b) => b.category === "misc" && b.plannedCents === 0 && b.spentCents === 0), false);
  assert.equal(budgetBars(d).find((b) => b.category === "subcontractor")?.tone, "bad"); // spent with no budget
});

test("up next names the milestone, its tasks left and the payment it releases", () => {
  const d = detail({
    milestones: [ms("a", "completed"), ms("b", "in_progress", [task("done"), task("todo"), task("todo")], { paymentTermId: "t3", paymentTermLabel: "Term 3", paymentAmountCents: 768_000 })],
    invoices: [],
  });
  const n = upNext(d)!;
  assert.equal(n.milestone.id, "b");
  assert.equal(n.tasksLeft, 2);
  assert.equal(n.tasksTotal, 3);
  assert.deepEqual(n.payment, { label: "Term 3", cents: 768_000, pct: 20 });
  assert.equal(n.invoiced, false);
  assert.equal(upNext(detail()), null);
});

test("the job window falls back to the milestones", () => {
  assert.equal(jobWindow(detail()), null);
  const d = detail({ milestones: [ms("a", "planned", [], { plannedStart: "2026-09-08", plannedEnd: "2026-09-12" }), ms("b", "planned", [], { plannedStart: "2026-09-14", plannedEnd: "2026-10-30" })] });
  assert.deepEqual(jobWindow(d), { from: "2026-09-08", to: "2026-10-30" });
});
