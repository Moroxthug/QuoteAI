import { getPdfmake } from "../lib/pdfmake.js";
import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import { createHash } from "node:crypto";
import type { Invoice, InvoicePayment, InvoiceParty } from "@workspace/db";
import { ti, fmtCents, fmtDay, fmtQty, dueText, invoiceTitle, isCreditNote, partyLines, watermark, taxLabel, type Lang, type IKey } from "./render.js";

// ── Invoice PDF ──────────────────────────────────────────────────────────────
// Letter size, sans-serif, same colour system as the contract PDF. The PDF
// is rendered once when the invoice is sent (and cached in storage); drafts
// are rendered on demand with a DRAFT banner.


const INK = "#111827";
const MUTED = "#6b7280";
const RULE = "#d1d5db";
const WM_COLOR: Record<string, string> = { status_draft: "#92400e", status_void: "#991b1b", status_paid: "#047857", status_overdue: "#b91c1c", status_partially_paid: "#1d4ed8" };

function party(label: string, p: InvoiceParty, lang: Lang, registration: boolean): Content {
  return {
    stack: [
      { text: label.toUpperCase(), fontSize: 7.5, color: MUTED, characterSpacing: 0.5 },
      { text: p.name, bold: true, fontSize: 11.5, margin: [0, 2, 0, 2] },
      ...partyLines(p, lang, { registration }).map((l) => ({ text: l, fontSize: 9, color: "#374151" }) as Content),
    ],
  };
}

const cell = (t: string, opts: Partial<{ bold: boolean; align: "right" | "left"; fill: string; color: string; size: number }> = {}): TableCell => ({
  text: t,
  fontSize: opts.size ?? 9.5,
  bold: opts.bold,
  alignment: opts.align ?? "left",
  fillColor: opts.fill,
  color: opts.color,
});

export async function buildInvoicePdf(inv: Invoice, payments: InvoicePayment[] = []): Promise<{ buffer: Buffer; sha256: string }> {
  const lang = inv.language as Lang;
  const credit = isCreditNote(inv);
  const content: Content[] = [];
  const wm = watermark(inv);

  content.push({
    columns: [
      { stack: [{ text: invoiceTitle(inv, lang), fontSize: 20, bold: true }, { text: `${credit ? ti("creditNoteNo", lang) : ti("invoiceNo", lang)} ${inv.number}`, fontSize: 10, color: MUTED, margin: [0, 2, 0, 0] }] },
      wm ? { text: ti(wm, lang), alignment: "right", fontSize: 11, bold: true, color: WM_COLOR[wm], characterSpacing: 1.2, margin: [0, 6, 0, 0] } : { text: "" },
    ],
    margin: [0, 0, 0, 14],
  });

  content.push({ columns: [party(ti("from", lang), inv.contractor, lang, true), party(ti("billTo", lang), inv.customer, lang, false)], columnGap: 20, margin: [0, 0, 0, 14] });

  const kvRows: TableCell[][] = [
    [cell(ti("issued", lang), { color: MUTED, size: 9 }), cell(fmtDay(inv.issueDate, lang))],
  ];
  if (!credit) kvRows.push([cell(ti("due", lang), { color: MUTED, size: 9 }), cell(dueText(inv, lang), { bold: true })]);
  if (inv.siteAddress) kvRows.push([cell(ti("site", lang), { color: MUTED, size: 9 }), cell(inv.siteAddress)]);
  if (inv.paymentTermLabel) kvRows.push([cell(ti("paymentTerm", lang), { color: MUTED, size: 9 }), cell(inv.paymentTermLabel)]);
  content.push({ table: { widths: [110, "*"], body: kvRows }, layout: "noBorders", margin: [0, 0, 0, 12] });

  const header = [ti("description", lang), ti("qty", lang), ti("unit", lang), ti("amount", lang)].map((h, i) => ({ text: h.toUpperCase(), fontSize: 7.5, color: MUTED, bold: true, alignment: i === 0 ? "left" : "right", margin: [0, 2, 0, 2] }) as TableCell);
  const rows: TableCell[][] = inv.lines.map((l) => [cell(l.description), cell(fmtQty(l.quantity, lang), { align: "right" }), cell(fmtCents(l.unitCents, lang), { align: "right" }), cell(fmtCents(l.amountCents, lang), { align: "right" })]);
  content.push({
    table: { headerRows: 1, widths: ["*", 45, 90, 95], body: [header, ...rows] },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0 : i === 1 ? 0.8 : 0.4),
      vLineWidth: () => 0,
      hLineColor: (i: number) => (i === 1 ? RULE : "#f3f4f6"),
      paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 5, paddingBottom: () => 5,
    },
    margin: [0, 0, 0, 10],
  });

  const totals: TableCell[][] = [];
  totals.push([cell(ti("subtotal", lang)), cell(fmtCents(inv.subtotalCents, lang), { align: "right" })]);
  if (inv.holdbackCents > 0) {
    totals.push([cell(`${ti("holdback", lang)} (${inv.holdbackPercent}%)`), cell(`- ${fmtCents(inv.holdbackCents, lang)}`, { align: "right" })]);
    totals.push([cell(ti("taxable", lang), { color: MUTED }), cell(fmtCents(inv.taxableCents, lang), { align: "right", color: MUTED })]);
  }
  for (const t of inv.taxLines) {
    totals.push([cell(`${taxLabel(t.label, lang)} ${t.rate}%${t.registrationNumber ? `  (${t.registrationNumber})` : ""}`), cell(fmtCents(t.amountCents, lang), { align: "right" })]);
  }
  totals.push([cell(credit ? ti("creditTotal", lang) : ti("total", lang), { bold: true, fill: "#f9fafb", size: 11 }), cell(fmtCents(inv.totalCents, lang), { bold: true, align: "right", fill: "#f9fafb", size: 11 })]);
  if (!credit && inv.paidCents > 0 && inv.status !== "void") {
    totals.push([cell(ti("paid", lang), { color: MUTED }), cell(`- ${fmtCents(inv.paidCents, lang)}`, { align: "right", color: MUTED })]);
    totals.push([cell(ti("balance", lang), { bold: true, color: "#047857" }), cell(fmtCents(Math.max(0, inv.totalCents - inv.paidCents), lang), { bold: true, align: "right", color: "#047857" })]);
  }
  content.push({
    columns: [
      { width: "*", text: "" },
      {
        width: 280,
        table: { widths: ["*", 100], body: totals },
        layout: { hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === node.table.body.length - (inv.paidCents > 0 && !credit && inv.status !== "void" ? 3 : 1) ? 1.2 : 0), vLineWidth: () => 0, hLineColor: () => INK, paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 4, paddingBottom: () => 4 },
      },
    ],
  });
  if (inv.holdbackCents > 0) content.push({ text: ti("holdbackNote", lang), fontSize: 8, color: MUTED, margin: [0, 10, 0, 0] });

  if (!credit && inv.status !== "void" && inv.status !== "paid") {
    const pi = inv.paymentInstructions ?? {};
    const lines: Content[] = [];
    if (pi.etransferEmail) lines.push({ text: [{ text: `${ti("etransfer", lang)} ` }, { text: pi.etransferEmail, bold: true }], fontSize: 9.5 });
    if (pi.chequePayableTo) lines.push({ text: [{ text: `${ti("cheque", lang)} ` }, { text: pi.chequePayableTo, bold: true }], fontSize: 9.5 });
    if (pi.note) lines.push({ text: pi.note, fontSize: 9.5 });
    if (lines.length) {
      content.push({
        table: { widths: ["*"], body: [[{ stack: [{ text: ti("payment", lang).toUpperCase(), fontSize: 7.5, color: "#5b21b6", characterSpacing: 0.5, margin: [0, 0, 0, 4] }, ...lines, { text: ti("reference", lang), fontSize: 8, color: MUTED, margin: [0, 4, 0, 0] }], fillColor: "#f5f3ff", margin: [8, 8, 8, 8] }]] },
        layout: "noBorders",
        margin: [0, 18, 0, 0],
      });
    }
  }

  if (payments.length > 0 && !credit) {
    content.push({ text: ti("paymentsReceived", lang).toUpperCase(), fontSize: 7.5, color: MUTED, characterSpacing: 0.5, margin: [0, 16, 0, 4] });
    content.push({
      table: { widths: [110, "*", 95], body: payments.map((p) => [cell(fmtDay(p.date, lang), { size: 9 }), cell(`${ti(`method_${p.method}` as IKey, lang)}${p.reference ? ` · ${p.reference}` : ""}`, { size: 9 }), cell(fmtCents(p.amountCents, lang), { align: "right", size: 9 })]) },
      layout: { hLineWidth: () => 0.4, vLineWidth: () => 0, hLineColor: () => "#f3f4f6", paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 3, paddingBottom: () => 3 },
    });
  }

  if (inv.notes) content.push({ text: [{ text: `${ti("notes", lang)}: `, bold: true }, { text: inv.notes }], fontSize: 9, color: "#374151", margin: [0, 14, 0, 0] });
  content.push({ text: ti("thanks", lang), fontSize: 9.5, color: "#374151", margin: [0, 18, 0, 0] });

  const def: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageMargins: [48, 52, 48, 56],
    defaultStyle: { font: "Roboto", fontSize: 10, color: INK, lineHeight: 1.2 },
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `${inv.contractor.name} · ${inv.number}`, fontSize: 7.5, color: MUTED },
        { text: `${ti("page", lang)} ${currentPage} / ${pageCount}`, fontSize: 7.5, color: MUTED, alignment: "right" },
      ],
      margin: [48, 20, 48, 0],
    }),
    info: { title: `${invoiceTitle(inv, lang)} ${inv.number}`, author: inv.contractor.name, creator: "QuoteAI" },
  };

  const buffer = await getPdfmake().createPdf(def).getBuffer();
  return { buffer, sha256: createHash("sha256").update(buffer).digest("hex") };
}
