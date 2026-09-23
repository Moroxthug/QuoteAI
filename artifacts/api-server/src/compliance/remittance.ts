// Phase 87 — the remittance worksheet.
//
// Net tax for a period, out of data the product already holds: the tax on
// every invoice issued in the period (credit notes subtract themselves,
// being negative) minus the input tax credits on confirmed costs dated in
// the period. It is a worksheet to hand a bookkeeper — the line numbers are
// there so they can check it against the return, not so anyone files from it.
//
// What it will not do is guess: a cost with tax but no GST/HST/QST split is
// left out of the credits and counted in a warning, as are costs still
// waiting for review and invoices with a hand-entered generic "Tax" line.

import { and, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { db, costEntriesTable, invoicesTable, type InvoiceTaxLine, type TaxBreakdown } from "@workspace/db";
import { timeZoneForProvince } from "../jobs/dates.js";

export type WorksheetInvoice = {
  id: string;
  number: string;
  type: string;
  day: string;
  customer: string;
  taxableCents: number;
  taxLines: Pick<InvoiceTaxLine, "code" | "amountCents">[];
};

export type WorksheetCost = {
  id: string;
  day: string;
  vendor: string;
  description: string;
  status: "pending_review" | "confirmed";
  subtotalCents: number;
  taxCents: number;
  taxBreakdown: TaxBreakdown;
};

type Codes = { GST: number; HST: number; QST: number; PST: number; RST: number; TAX: number };
const zero = (): Codes => ({ GST: 0, HST: 0, QST: 0, PST: 0, RST: 0, TAX: 0 });

export type WorksheetSummary = {
  invoiceCount: number;
  /** GST34 line 101 — sales and other revenue, before tax (holdbacks are taxed when released). */
  salesCents: number;
  collected: Codes;
  /** Input tax credits (GST/HST) and refunds (QST) from confirmed, split receipts. */
  credits: { GST: number; HST: number; QST: number };
  /** PST/RST paid on purchases — not recoverable, shown so nobody tries to. */
  nonRecoverableCents: number;
  /** Line 105 (GST + HST collected), 108 (ITCs), 109 (net). */
  gstHst: { collectedCents: number; creditsCents: number; netCents: number };
  qst: { collectedCents: number; creditsCents: number; netCents: number };
  pst: { collectedCents: number };
  warnings: {
    unsplitCostCount: number;
    unsplitTaxCents: number;
    pendingCostCount: number;
    pendingTaxCents: number;
    genericTaxCents: number;
  };
};

export function summarizeWorksheet(invoices: WorksheetInvoice[], costs: WorksheetCost[]): WorksheetSummary {
  const collected = zero();
  let salesCents = 0;
  for (const inv of invoices) {
    salesCents += inv.taxableCents;
    for (const line of inv.taxLines) {
      const code = (line.code in collected ? line.code : "TAX") as keyof Codes;
      collected[code] += line.amountCents;
    }
  }

  const credits = { GST: 0, HST: 0, QST: 0 };
  let nonRecoverableCents = 0;
  const warnings = { unsplitCostCount: 0, unsplitTaxCents: 0, pendingCostCount: 0, pendingTaxCents: 0, genericTaxCents: collected.TAX };
  for (const c of costs) {
    if (c.status !== "confirmed") {
      if (c.taxCents > 0) {
        warnings.pendingCostCount += 1;
        warnings.pendingTaxCents += c.taxCents;
      }
      continue;
    }
    const b = c.taxBreakdown ?? {};
    const split = (b.GST ?? 0) + (b.HST ?? 0) + (b.QST ?? 0) + (b.PST ?? 0) + (b.RST ?? 0);
    if (c.taxCents > 0 && split === 0) {
      warnings.unsplitCostCount += 1;
      warnings.unsplitTaxCents += c.taxCents;
      continue;
    }
    credits.GST += b.GST ?? 0;
    credits.HST += b.HST ?? 0;
    credits.QST += b.QST ?? 0;
    nonRecoverableCents += (b.PST ?? 0) + (b.RST ?? 0);
  }

  const gstHstCollected = collected.GST + collected.HST;
  const gstHstCredits = credits.GST + credits.HST;
  return {
    invoiceCount: invoices.length,
    salesCents,
    collected,
    credits,
    nonRecoverableCents,
    gstHst: { collectedCents: gstHstCollected, creditsCents: gstHstCredits, netCents: gstHstCollected - gstHstCredits },
    qst: { collectedCents: collected.QST, creditsCents: credits.QST, netCents: collected.QST - credits.QST },
    pst: { collectedCents: collected.PST + collected.RST },
    warnings,
  };
}

/**
 * The calendar day a stored timestamp belongs to. Date-only values (receipt
 * dates, invoice dates typed by hand) are stored at UTC midnight and are
 * taken as-is; real instants (an invoice issued "now") are read in the
 * company's province, so 20:00 in Vancouver on the 30th stays on the 30th.
 */
export function dayOf(d: Date, province: string | null | undefined): string {
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) return d.toISOString().slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: timeZoneForProvince(province), year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export async function loadWorksheet(userId: string, province: string | null, from: string, to: string) {
  // Pad a day each side in SQL and settle the local day in JS.
  const lo = new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000);
  const hi = new Date(Date.parse(`${to}T00:00:00Z`) + 2 * 86_400_000);
  const inRange = (day: string) => day >= from && day <= to;

  const invRows = await db
    .select({
      id: invoicesTable.id,
      number: invoicesTable.number,
      type: invoicesTable.type,
      issueDate: invoicesTable.issueDate,
      customer: invoicesTable.customer,
      taxableCents: invoicesTable.taxableCents,
      taxLines: invoicesTable.taxLines,
    })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.userId, userId), inArray(invoicesTable.status, ["sent", "viewed", "pending_confirmation", "partially_paid", "paid", "overdue"]), gte(invoicesTable.issueDate, lo), lt(invoicesTable.issueDate, hi)));

  const invoices: WorksheetInvoice[] = invRows
    .map((r) => ({
      id: r.id,
      number: r.number,
      type: r.type,
      day: dayOf(r.issueDate, province),
      customer: (r.customer as { name?: string } | null)?.name ?? "",
      taxableCents: r.taxableCents,
      taxLines: (r.taxLines ?? []).map((l) => ({ code: l.code, amountCents: l.amountCents })),
    }))
    .filter((r) => inRange(r.day))
    .sort((a, b) => (a.day === b.day ? a.number.localeCompare(b.number) : a.day < b.day ? -1 : 1));

  const costRows = await db
    .select({
      id: costEntriesTable.id,
      date: costEntriesTable.date,
      vendor: costEntriesTable.vendor,
      description: costEntriesTable.description,
      status: costEntriesTable.status,
      subtotalCents: costEntriesTable.subtotalCents,
      taxCents: costEntriesTable.taxCents,
      taxBreakdown: costEntriesTable.taxBreakdown,
    })
    .from(costEntriesTable)
    // Labour and equipment usage carry no tax; only purchases can hold a credit.
    .where(and(eq(costEntriesTable.userId, userId), ne(costEntriesTable.source, "time_entry"), ne(costEntriesTable.source, "equipment"), ne(costEntriesTable.source, "allowance"), gte(costEntriesTable.date, lo), lt(costEntriesTable.date, hi)));

  const costs: WorksheetCost[] = costRows
    .map((r) => ({ id: r.id, day: dayOf(r.date, province), vendor: r.vendor, description: r.description, status: r.status, subtotalCents: r.subtotalCents, taxCents: r.taxCents, taxBreakdown: r.taxBreakdown ?? {} }))
    .filter((r) => inRange(r.day))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  return { from, to, summary: summarizeWorksheet(invoices, costs), invoices, costs };
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const money = (c: number) => (c / 100).toFixed(2);

/** One file a bookkeeper can open: every invoice and every purchase in the period, with the split. */
export function worksheetCsv(w: Awaited<ReturnType<typeof loadWorksheet>>): string {
  const head = ["record", "date", "number_or_vendor", "party_or_description", "status", "pre_tax", "GST", "HST", "QST", "PST_RST", "other_tax", "counted"];
  const rows: (string | number)[][] = [head];
  for (const inv of w.invoices) {
    const by = (code: string) => inv.taxLines.filter((l) => l.code === code).reduce((s, l) => s + l.amountCents, 0);
    const other = inv.taxLines.filter((l) => !["GST", "HST", "QST", "PST", "RST"].includes(l.code)).reduce((s, l) => s + l.amountCents, 0);
    rows.push([inv.type === "credit_note" ? "credit_note" : "invoice", inv.day, inv.number, inv.customer, "issued", money(inv.taxableCents), money(by("GST")), money(by("HST")), money(by("QST")), money(by("PST") + by("RST")), money(other), "yes"]);
  }
  for (const c of w.costs) {
    const b = c.taxBreakdown;
    const split = (b.GST ?? 0) + (b.HST ?? 0) + (b.QST ?? 0) + (b.PST ?? 0) + (b.RST ?? 0);
    const counted = c.status !== "confirmed" ? "no (awaiting review)" : c.taxCents > 0 && split === 0 ? "no (tax not split)" : "yes";
    rows.push(["purchase", c.day, c.vendor, c.description, c.status, money(c.subtotalCents), money(b.GST ?? 0), money(b.HST ?? 0), money(b.QST ?? 0), money((b.PST ?? 0) + (b.RST ?? 0)), money(split === 0 ? c.taxCents : 0), counted]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
