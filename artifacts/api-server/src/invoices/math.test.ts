// Ad-hoc unit run: `npx tsx src/invoices/math.test.ts` from artifacts/api-server.
import assert from "node:assert/strict";
import { computeInvoiceAmounts, termSubtotalCents, finalInvoiceSubtotalCents, lienPeriodDays, statusAfterPayment, arAging, lineFrom, taxLinesFor } from "./math.js";

// ON progress invoice with 10% holdback: tax on the net of holdback.
const on = computeInvoiceAmounts({ lines: [lineFrom("Framing", 1_000_000)], province: "ON", holdbackPercent: 10, registration: { gstHstNumber: "123456789RT0001" } });
assert.equal(on.subtotalCents, 1_000_000);
assert.equal(on.holdbackCents, 100_000);
assert.equal(on.taxableCents, 900_000);
assert.deepEqual(on.taxLines.map((t) => [t.code, t.amountCents, t.registrationNumber]), [["HST", 117_000, "123456789RT0001"]]);
assert.equal(on.totalCents, 1_017_000);

// QC: GST + QST split with the QST registration number on the QST line only.
const qc = computeInvoiceAmounts({ lines: [lineFrom("Plomberie", 250_000)], province: "QC", registration: { gstHstNumber: "1234", qstNumber: "5678" } });
assert.deepEqual(qc.taxLines.map((t) => [t.code, t.amountCents, t.registrationNumber]), [["GST", 12_500, "1234"], ["QST", 24_938, "5678"]]);
assert.equal(qc.totalCents, 287_438);

// Deposit: no holdback even if requested percent is 0; BC has GST + PST.
const bc = computeInvoiceAmounts({ lines: [lineFrom("Deposit", 100_000)], province: "BC", holdbackPercent: 0 });
assert.equal(bc.holdbackCents, 0);
assert.equal(bc.taxCents, 12_000);

// Credit note: negative lines, never a holdback, negative taxes.
const cn = computeInvoiceAmounts({ lines: [lineFrom("Correction", -50_000)], province: "ON", holdbackPercent: 10 });
assert.equal(cn.holdbackCents, 0);
assert.equal(cn.taxCents, -6_500);
assert.equal(cn.totalCents, -56_500);

// Term amounts: percent of pre-tax subtotal; fixed incl.-tax backed out.
const contract = { subtotalCents: 2_000_000, totalCents: 2_260_000 }; // ON 13%
assert.equal(termSubtotalCents({ amountType: "percent", value: 15 }, contract), 300_000);
assert.equal(termSubtotalCents({ amountType: "fixed", value: 2260 }, contract), 200_000);

// Final invoice = remaining unbilled, incl. change orders, never negative.
assert.equal(finalInvoiceSubtotalCents({ jobSubtotalCents: 2_150_000, invoicedSubtotalCents: 1_700_000 }), 450_000);
assert.equal(finalInvoiceSubtotalCents({ jobSubtotalCents: 2_000_000, invoicedSubtotalCents: 2_000_100 }), 0);

// Lien periods.
assert.equal(lienPeriodDays("ON"), 60);
assert.equal(lienPeriodDays("BC"), 55);
assert.equal(lienPeriodDays("AB"), 60);
assert.equal(lienPeriodDays("QC"), 60);

// Status transitions.
const due = new Date("2026-09-01T00:00:00Z");
const before = new Date("2026-08-20T00:00:00Z");
const after = new Date("2026-09-10T00:00:00Z");
assert.equal(statusAfterPayment({ status: "sent", totalCents: 1000, paidCents: 0, dueDate: due, now: before }), "sent");
assert.equal(statusAfterPayment({ status: "viewed", totalCents: 1000, paidCents: 0, dueDate: due, now: after }), "overdue");
assert.equal(statusAfterPayment({ status: "overdue", totalCents: 1000, paidCents: 400, dueDate: due, now: after }), "partially_paid");
assert.equal(statusAfterPayment({ status: "overdue", totalCents: 1000, paidCents: 1000, dueDate: due, now: after }), "paid");
assert.equal(statusAfterPayment({ status: "partially_paid", totalCents: 1000, paidCents: 0, dueDate: due, now: before }), "sent");
assert.equal(statusAfterPayment({ status: "draft", totalCents: 1000, paidCents: 1000, dueDate: due }), "draft");
assert.equal(statusAfterPayment({ status: "sent", totalCents: -500, paidCents: 0, dueDate: due }), "paid");

// AR aging.
const now = new Date("2026-09-13T00:00:00Z");
const aging = arAging(
  [
    { status: "sent", totalCents: 1000, paidCents: 0, dueDate: new Date("2026-09-20T00:00:00Z") },
    { status: "overdue", totalCents: 1000, paidCents: 250, dueDate: new Date("2026-09-01T00:00:00Z") },
    { status: "overdue", totalCents: 500, paidCents: 0, dueDate: new Date("2026-07-01T00:00:00Z") },
    { status: "paid", totalCents: 999, paidCents: 999, dueDate: new Date("2026-01-01T00:00:00Z") },
    { status: "draft", totalCents: 999, paidCents: 0, dueDate: new Date("2026-01-01T00:00:00Z") },
  ],
  now,
);
assert.deepEqual(aging, { current: 1000, d1_30: 750, d31_60: 0, d61_90: 500, d90_plus: 0, totalCents: 2250, overdueCents: 1250 });

// Tax lines never emit a registration number for a component the company is not registered for.
assert.equal(taxLinesFor(10_000, "BC", { gstHstNumber: "X" })[1]!.registrationNumber, null);

console.log("invoice math: all assertions passed");
