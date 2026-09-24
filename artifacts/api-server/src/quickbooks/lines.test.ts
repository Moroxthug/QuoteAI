import { describe, expect, test } from "vitest";
import { quickbooksInvoiceLines, linesTotalCents, costTaxSetKey } from "./lines.js";

// Phase 96: an invoice as QuickBooks lines, and a cost's tax set.

const ON_HST = [{ code: "HST", label: "HST", rate: 13, amountCents: 0 }];

function invoice(over: Partial<Parameters<typeof quickbooksInvoiceLines>[0]> = {}) {
  const lines = over.lines ?? [
    { description: "Deck boards", quantity: 10, unitCents: 4_250, amountCents: 42_500 },
    { description: "Labour", quantity: 12.5, unitCents: 8_000, amountCents: 100_000 },
    { description: "Discount", quantity: 1, unitCents: -2_500, amountCents: -2_500 },
  ];
  const subtotalCents = lines.reduce((s, l) => s + l.amountCents, 0);
  const holdbackCents = over.holdbackCents ?? 0;
  const taxableCents = subtotalCents - holdbackCents;
  const taxLines = (over.taxLines ?? ON_HST).map((t) => ({ ...t, amountCents: Math.round((taxableCents * t.rate) / 100) }));
  const taxCents = taxLines.reduce((s, t) => s + t.amountCents, 0);
  return { number: "INV-0001", title: "Deck", lines, subtotalCents, holdbackPercent: over.holdbackPercent ?? 0, holdbackCents, taxableCents, taxLines, totalCents: taxableCents + taxCents };
}

describe("quickbooksInvoiceLines", () => {
  test("mapped: one pre-tax line per item, each with the tax code, quantities kept", () => {
    const out = quickbooksInvoiceLines(invoice(), "17", "7");
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ Amount: 425, Description: "Deck boards", SalesItemLineDetail: { ItemRef: { value: "17" }, Qty: 10, UnitPrice: 42.5, TaxCodeRef: { value: "7" } } });
    expect(out[1]).toMatchObject({ Amount: 1000, SalesItemLineDetail: { Qty: 12.5, UnitPrice: 80, TaxCodeRef: { value: "7" } } });
    expect(out[2]).toMatchObject({ Amount: -25, SalesItemLineDetail: { Qty: 1, UnitPrice: -25 } });
    // The lines are the tax base: QuickBooks adds the tax itself.
    expect(linesTotalCents(out)).toBe(140_000);
  });

  test("unmapped: the same lines without a code, then each tax as a line, so the total matches to the cent", () => {
    const inv = invoice();
    const out = quickbooksInvoiceLines(inv, "17", null);
    expect(out).toHaveLength(4);
    expect(out[0]!.SalesItemLineDetail.TaxCodeRef).toBeUndefined();
    expect(out[3]).toMatchObject({ Amount: 182, Description: "HST 13%", SalesItemLineDetail: { Qty: 1, UnitPrice: 182 } });
    expect(linesTotalCents(out)).toBe(inv.totalCents);
  });

  test("a holdback is a negative line with the same tax code, so tax is charged on what QuoteAI taxed", () => {
    const inv = invoice({ holdbackPercent: 10, holdbackCents: 14_000 });
    const mapped = quickbooksInvoiceLines(inv, "17", "7");
    expect(mapped[3]).toMatchObject({ Amount: -140, Description: expect.stringContaining("Holdback withheld (10%)"), SalesItemLineDetail: { TaxCodeRef: { value: "7" } } });
    expect(linesTotalCents(mapped)).toBe(inv.taxableCents);
    const unmapped = quickbooksInvoiceLines(inv, "17", null);
    expect(linesTotalCents(unmapped)).toBe(inv.totalCents);
  });

  test("two taxes unmapped become two tax lines (GST + QST)", () => {
    const inv = invoice({ taxLines: [{ code: "GST", label: "GST", rate: 5, amountCents: 0 }, { code: "QST", label: "QST", rate: 9.975, amountCents: 0 }] });
    const out = quickbooksInvoiceLines(inv, "17", null);
    expect(out.slice(-2).map((l) => l.Description)).toEqual(["GST 5%", "QST 9.975%"]);
    expect(linesTotalCents(out)).toBe(inv.totalCents);
  });

  test("a quantity whose rounding disagrees with the amount goes over as 1 × amount", () => {
    const inv = invoice({ lines: [{ description: "Odd", quantity: 3, unitCents: 3_333, amountCents: 10_000 }] });
    const [line] = quickbooksInvoiceLines(inv, "17", "7");
    expect(line!.SalesItemLineDetail).toMatchObject({ Qty: 1, UnitPrice: 100 });
    expect(line!.Amount).toBe(100);
  });

  test("lines that don't add up to the subtotal (old data) fall back to one line for the whole invoice", () => {
    const inv = { ...invoice(), lines: [{ description: "Half of it", quantity: 1, unitCents: 1, amountCents: 1 }] };
    const out = quickbooksInvoiceLines(inv, "17", "7");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ Amount: 1400, Description: "Deck", SalesItemLineDetail: { Qty: 1, UnitPrice: 1400, TaxCodeRef: { value: "7" } } });
  });

  test("zero-amount lines are left out; an invoice with no lines at all still goes over", () => {
    const inv = invoice({ lines: [{ description: "Free", quantity: 1, unitCents: 0, amountCents: 0 }, { description: "Paid", quantity: 1, unitCents: 500, amountCents: 500 }] });
    expect(quickbooksInvoiceLines(inv, "17", "7").map((l) => l.Description)).toEqual(["Paid"]);
    const empty = { ...invoice({ lines: [] }), subtotalCents: 0, taxableCents: 0, totalCents: 0, taxLines: [] };
    expect(quickbooksInvoiceLines(empty, "17", null)).toHaveLength(1);
  });
});

describe("costTaxSetKey", () => {
  test("the receipt's taxes at the province's rates, in the invoice mapping's spelling", () => {
    expect(costTaxSetKey({ taxCents: 1_498, taxBreakdown: { GST: 500, QST: 998 } }, "QC")).toBe("GST 5% + QST 9.975%");
    expect(costTaxSetKey({ taxCents: 1_300, taxBreakdown: { HST: 1_300 } }, "ON")).toBe("HST 13%");
    expect(costTaxSetKey({ taxCents: 500, taxBreakdown: { GST: 500 } }, "BC"), "a GST-only receipt in BC (PST-exempt item)").toBe("GST 5%");
  });
  test("no breakdown means every tax the province charges; no tax means none", () => {
    expect(costTaxSetKey({ taxCents: 1_200, taxBreakdown: {} }, "BC")).toBe("GST 5% + PST 7%");
    expect(costTaxSetKey({ taxCents: 0, taxBreakdown: {} }, "ON")).toBe("none");
  });
  test("a tax the province doesn't have is not guessed", () => {
    expect(costTaxSetKey({ taxCents: 1_300, taxBreakdown: { HST: 1_300 } }, "QC")).toBe("none");
  });
});
