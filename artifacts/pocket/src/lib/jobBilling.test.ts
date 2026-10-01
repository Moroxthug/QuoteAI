import assert from "node:assert/strict";
import { test } from "node:test";
import { billingFigures, daysLate, planRows } from "./jobBilling.ts";
import type { JobDetail, JobInvoice, JobMilestone } from "./jobDetail.ts";

const inv = (o: Partial<JobInvoice>): JobInvoice => ({ id: "i", number: "INV-1", type: "progress", status: "paid", title: "", paymentTermId: null, paymentTermLabel: null, milestoneId: null, issueDate: "2026-09-01", dueDate: "2026-09-10", totalCents: 100_000, paidCents: 0, balanceCents: 0, ...o });
const ms = (id: string, termId: string, status: JobMilestone["status"], cents: number): JobMilestone => ({
  id, key: id, title: id, description: "", sortOrder: 0, plannedStart: null, plannedEnd: null, actualStart: null, actualEnd: null, status, paymentTermId: termId, paymentTermLabel: null, paymentAmountCents: cents, sourceChapter: null, valueCents: 0, updatedAt: "", tasks: [],
});
const detail = (o: Partial<JobDetail> = {}): JobDetail => ({
  job: { id: "j", name: "B", description: "", status: "active", setupStatus: "confirmed", quoteId: null, clientId: null, contractId: "c", address: "", province: null, latitude: null, longitude: null, geofenceRadiusMeters: null,
    contractValueCents: 4_000_000, changeOrdersCents: 0, totalValueCents: 4_000_000, plannedStart: null, plannedEnd: null, progressPercent: 0, completedAt: null, createdAt: "", updatedAt: "", archivedAt: null, client: null,
    contract: { id: "c", contractNumber: "C-1", status: "signed", signedAt: null, hasSignedPdf: false, language: "en", total: 40_000, subtotal: 0, customerName: "", paymentSchedule: { terms: [
      { id: "t1", label: "Deposit", amountType: "percent", value: 20 }, { id: "t2", label: "Rough-in", amountType: "percent", value: 25 }, { id: "t3", label: "Drywall", amountType: "percent", value: 20 }, { id: "t4", label: "Paint", amountType: "percent", value: 35 },
    ] } }, quote: null },
  milestones: [ms("m2", "t2", "completed", 1_000_000), ms("m3", "t3", "completed", 800_000), ms("m4", "t4", "planned", 1_400_000)], unassignedTasks: [], budget: [], budgetTotalCents: 0, changeOrders: [],
  costs: { totalCents: 0, pendingCents: 0, pendingCount: 0, byCategory: { materials: 0, labour: 0, subcontractor: 0, permits_fees: 0, equipment: 0, misc: 0 }, entries: [] }, timeEntries: [], equipmentUsage: [], assignments: [],
  invoices: [inv({ id: "a", type: "deposit", paymentTermId: "t1", totalCents: 800_000 }), inv({ id: "b", paymentTermId: "t2", totalCents: 1_000_000 }), inv({ id: "c", number: "INV-412", type: "change_order", status: "overdue", title: "Change order CO-01", totalCents: 234_000, dueDate: "2026-09-20" })],
  invoiceTotals: { invoicedCents: 2_034_000, collectedCents: 1_800_000, outstandingCents: 234_000, overdueCents: 234_000, draftCount: 0 }, ...o,
});

test("one row per term, with the invoice that came from it and its state", () => {
  const rows = planRows(detail());
  assert.deepEqual(rows.map((r) => [r.n, r.state]), [[1, "paid"], [2, "paid"], [3, "ready"], [4, "open"], [null, "late"]]);
  assert.equal(rows[2]!.cents, 800_000); // the milestone's snapshot
  assert.equal(rows[3]!.cents, 1_400_000);
  assert.equal(rows[0]!.pct, 20);
  assert.equal(rows[4]!.label, "Change order CO-01");
});

test("a void invoice or a credit note doesn't count as invoiced", () => {
  const rows = planRows(detail({ invoices: [inv({ id: "a", paymentTermId: "t1", status: "void" })] }));
  assert.equal(rows[0]!.state, "open");
});

test("figures: counts, the worst late invoice, what is still to invoice and the terms left", () => {
  const f = billingFigures(detail(), new Date(2026, 8, 29, 12));
  assert.equal(f.invoiceCount, 3);
  assert.equal(f.paidCount, 2);
  assert.equal(f.worstLate?.number, "INV-412");
  assert.equal(f.worstLate?.days, 9);
  assert.equal(f.stillCents, 4_000_000 - 2_034_000);
  assert.equal(f.termsLeft, 2); // term 3 ready, term 4 open
});

test("days late counts whole days past the due date", () => {
  assert.equal(daysLate("2026-09-20T00:00:00Z", new Date(2026, 8, 29, 9)), 9);
  assert.equal(daysLate("2026-10-05T12:00:00Z", new Date(2026, 8, 29, 9)), 0);
});
