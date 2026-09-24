// Phase 96 — what a QuoteAI invoice or cost looks like as QuickBooks lines.
//
// Phase 88 sent every invoice as ONE line (the invoice title) and every cost
// as one tax-included line. Now an invoice goes over line by line, each line
// pre-tax with the company's mapped tax code for the invoice's tax set (HST
// ON, GST/QST QC, GST/PST BC…), the holdback as a negative line so the tax
// base is what QuoteAI taxed, and — when the set is not mapped — the taxes
// themselves as plain lines so the total still matches to the cent. A cost
// has no line items in QuoteAI; it goes over as one pre-tax line with the
// tax code its receipt implies, or tax-included as before when unmapped.
//
// Pure: unit-tested without QuickBooks or a database.
import { getTaxProfile, type CostEntry, type Invoice, type InvoiceLine, type TaxBreakdown } from "@workspace/db";
import { taxSetKey } from "../books/keys.js";

const dollars = (cents: number) => Math.round(cents) / 100;

export type QbSalesLine = {
  Amount: number;
  DetailType: "SalesItemLineDetail";
  Description: string;
  SalesItemLineDetail: { ItemRef: { value: string }; Qty: number; UnitPrice: number; TaxCodeRef?: { value: string } };
};

type InvoiceForLines = Pick<Invoice, "lines" | "subtotalCents" | "holdbackCents" | "holdbackPercent" | "taxableCents" | "taxLines" | "totalCents" | "title" | "number">;

/** Qty × UnitPrice must equal Amount to the cent or QuickBooks recomputes it; when rounding disagrees, the line goes over as 1 × amount. */
function qtyAndUnit(line: InvoiceLine): { Qty: number; UnitPrice: number } {
  const consistent = line.quantity > 0 && Math.round(line.quantity * line.unitCents) === line.amountCents;
  return consistent ? { Qty: line.quantity, UnitPrice: dollars(line.unitCents) } : { Qty: 1, UnitPrice: dollars(line.amountCents) };
}

/**
 * The QBO lines for an invoice. `taxCodeId` is the mapped code for the
 * invoice's tax set (null = not mapped). Lines that don't add up to the
 * invoice's subtotal (data from before line items were reliable) fall back to
 * the Phase 88 shape: one line for the whole invoice.
 */
export function quickbooksInvoiceLines(invoice: InvoiceForLines, itemId: string, taxCodeId: string | null): QbSalesLine[] {
  const tax = taxCodeId ? { TaxCodeRef: { value: taxCodeId } } : {};
  const item = { ItemRef: { value: itemId } };
  const lines: QbSalesLine[] = [];

  const itemLines = invoice.lines.filter((l) => l.amountCents !== 0);
  const addsUp = itemLines.reduce((s, l) => s + l.amountCents, 0) === invoice.subtotalCents;
  if (itemLines.length && addsUp) {
    for (const l of itemLines) {
      lines.push({ Amount: dollars(l.amountCents), DetailType: "SalesItemLineDetail", Description: l.description.slice(0, 4000), SalesItemLineDetail: { ...item, ...qtyAndUnit(l), ...tax } });
    }
  } else {
    const amount = dollars(invoice.subtotalCents);
    lines.push({ Amount: amount, DetailType: "SalesItemLineDetail", Description: (invoice.title || `Invoice ${invoice.number}`).slice(0, 4000), SalesItemLineDetail: { ...item, Qty: 1, UnitPrice: amount, ...tax } });
  }

  if (invoice.holdbackCents > 0) {
    const amount = -dollars(invoice.holdbackCents);
    lines.push({
      Amount: amount,
      DetailType: "SalesItemLineDetail",
      Description: `Holdback withheld (${invoice.holdbackPercent}%) — invoiced separately when released`,
      SalesItemLineDetail: { ...item, Qty: 1, UnitPrice: amount, ...tax },
    });
  }

  // Unmapped: QuickBooks is told nothing about tax, so the taxes ride along as lines and the total matches.
  if (!taxCodeId) {
    for (const t of invoice.taxLines) {
      if (!t.amountCents) continue;
      const amount = dollars(t.amountCents);
      lines.push({ Amount: amount, DetailType: "SalesItemLineDetail", Description: `${t.label} ${t.rate}%`, SalesItemLineDetail: { ...item, Qty: 1, UnitPrice: amount } });
    }
  }
  return lines;
}

/** What the lines add up to, in cents — equals the invoice total when unmapped, its taxable base when mapped. */
export function linesTotalCents(lines: { Amount: number }[]): number {
  return Math.round(lines.reduce((s, l) => s + l.Amount * 100, 0));
}

/**
 * The tax set a cost carries, as the same key the invoice mapping uses. The
 * receipt's breakdown says which taxes were charged; the province (the job's,
 * else the company's) says their rates. A breakdown naming a tax the
 * province doesn't have, or no tax at all, is "none".
 */
export function costTaxSetKey(entry: Pick<CostEntry, "taxCents" | "taxBreakdown">, province: string | null | undefined): string {
  if (entry.taxCents <= 0) return "none";
  const profile = getTaxProfile(province);
  const breakdown: TaxBreakdown = entry.taxBreakdown ?? {};
  const charged = Object.entries(breakdown).filter(([, cents]) => (cents ?? 0) > 0).map(([code]) => code);
  const components = charged.length ? profile.components.filter((c) => charged.includes(c.code)) : profile.components;
  return taxSetKey(components);
}
