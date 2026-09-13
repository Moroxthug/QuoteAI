import type { Invoice, InvoiceParty, InvoicePayment } from "@workspace/db";
import { PROVINCE_NAMES, isProvinceCode } from "@workspace/db";

// ── Invoice rendering: strings + HTML ────────────────────────────────────────
// The PDF (pdf.ts) and the public page / email share these labels so the
// customer sees the same document everywhere. CRA invoice requirements
// (≥ $150): supplier name + GST/HST number, date, buyer name, description,
// tax shown separately with the rate, total. QC adds the QST number.

export type Lang = "en" | "fr";

export const I = {
  invoice: { en: "Invoice", fr: "Facture" },
  creditNote: { en: "Credit note", fr: "Note de crédit" },
  invoiceNo: { en: "Invoice No.", fr: "Facture n°" },
  creditNoteNo: { en: "Credit note No.", fr: "Note de crédit n°" },
  issued: { en: "Issued", fr: "Émise le" },
  due: { en: "Due", fr: "Échéance" },
  dueOnReceipt: { en: "Due on receipt", fr: "Payable à réception" },
  from: { en: "From", fr: "De" },
  billTo: { en: "Bill to", fr: "Facturer à" },
  site: { en: "Job site", fr: "Chantier" },
  job: { en: "Job", fr: "Projet" },
  contract: { en: "Contract", fr: "Contrat" },
  description: { en: "Description", fr: "Description" },
  qty: { en: "Qty", fr: "Qté" },
  unit: { en: "Unit price", fr: "Prix unitaire" },
  amount: { en: "Amount", fr: "Montant" },
  subtotal: { en: "Subtotal", fr: "Sous-total" },
  holdback: { en: "Less statutory holdback", fr: "Moins retenue légale" },
  holdbackNote: {
    en: "The statutory holdback is retained as required by the applicable construction lien legislation and will be invoiced, with the applicable taxes, at the end of the lien period.",
    fr: "La retenue légale est conservée conformément à la législation applicable sur les privilèges de construction et sera facturée, avec les taxes applicables, à la fin de la période de privilège.",
  },
  taxable: { en: "Taxable amount", fr: "Montant taxable" },
  total: { en: "Total due", fr: "Total à payer" },
  creditTotal: { en: "Credit amount", fr: "Montant du crédit" },
  paid: { en: "Paid", fr: "Payé" },
  balance: { en: "Balance due", fr: "Solde à payer" },
  payment: { en: "How to pay", fr: "Modalités de paiement" },
  paymentTerm: { en: "Payment term", fr: "Versement" },
  etransfer: { en: "Interac e-Transfer to", fr: "Virement Interac à" },
  cheque: { en: "Cheque payable to", fr: "Chèque à l'ordre de" },
  reference: { en: "Please quote the invoice number as the payment reference.", fr: "Veuillez indiquer le numéro de facture comme référence de paiement." },
  notes: { en: "Notes", fr: "Notes" },
  gstHst: { en: "GST/HST No.", fr: "N° TPS/TVH" },
  qst: { en: "QST No.", fr: "N° TVQ" },
  pst: { en: "PST No.", fr: "N° TVP" },
  licence: { en: "Licence No.", fr: "N° de licence" },
  email: { en: "Email", fr: "Courriel" },
  phone: { en: "Phone", fr: "Téléphone" },
  status_draft: { en: "DRAFT", fr: "BROUILLON" },
  status_void: { en: "VOID", fr: "ANNULÉE" },
  status_paid: { en: "PAID", fr: "PAYÉE" },
  status_overdue: { en: "OVERDUE", fr: "EN RETARD" },
  status_partially_paid: { en: "PARTIALLY PAID", fr: "PARTIELLEMENT PAYÉE" },
  page: { en: "Page", fr: "Page" },
  refersTo: { en: "Correction of invoice", fr: "Correction de la facture" },
  netDays: { en: "Net {n} days", fr: "Net {n} jours" },
  type_deposit: { en: "Deposit", fr: "Dépôt" },
  type_progress: { en: "Progress payment", fr: "Paiement progressif" },
  type_final: { en: "Final invoice", fr: "Facture finale" },
  type_holdback_release: { en: "Holdback release", fr: "Libération de la retenue" },
  type_change_order: { en: "Change order", fr: "Ordre de changement" },
  type_manual: { en: "Invoice", fr: "Facture" },
  type_credit_note: { en: "Credit note", fr: "Note de crédit" },
  paymentsReceived: { en: "Payments received", fr: "Paiements reçus" },
  method_etransfer: { en: "e-Transfer", fr: "Virement Interac" },
  method_cheque: { en: "Cheque", fr: "Chèque" },
  method_cash: { en: "Cash", fr: "Comptant" },
  method_card: { en: "Card", fr: "Carte" },
  method_bank_transfer: { en: "Bank transfer", fr: "Virement bancaire" },
  method_credit_note: { en: "Credit note", fr: "Note de crédit" },
  method_other: { en: "Other", fr: "Autre" },
  thanks: { en: "Thank you for your business.", fr: "Merci de votre confiance." },
} satisfies Record<string, { en: string; fr: string }>;

export type IKey = keyof typeof I;

export function ti(key: IKey, lang: Lang): string {
  return I[key][lang];
}

export function fmtCents(cents: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

export function fmtDay(d: Date | string | null | undefined, lang: Lang): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long", timeZone: "America/Toronto" });
}

export function fmtQty(q: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 2 }).format(q);
}

export function provinceName(code: string | null | undefined, lang: Lang): string {
  return code && isProvinceCode(code) ? PROVINCE_NAMES[code][lang] : code ?? "";
}

export function isCreditNote(inv: Pick<Invoice, "type">): boolean {
  return inv.type === "credit_note";
}

export function invoiceTitle(inv: Pick<Invoice, "type" | "title">, lang: Lang): string {
  return inv.title || ti(`type_${inv.type}` as IKey, lang);
}

export function partyLines(p: InvoiceParty, lang: Lang, opts: { registration: boolean }): string[] {
  const lines = [
    p.address ?? "",
    [p.city, p.province, p.postalCode].filter(Boolean).join(", "),
    p.email ? `${ti("email", lang)}: ${p.email}` : "",
    p.phone ? `${ti("phone", lang)}: ${p.phone}` : "",
  ];
  if (opts.registration) {
    if (p.gstHstNumber) lines.push(`${ti("gstHst", lang)}: ${p.gstHstNumber}`);
    if (p.qstNumber) lines.push(`${ti("qst", lang)}: ${p.qstNumber}`);
    if (p.pstNumber) lines.push(`${ti("pst", lang)}: ${p.pstNumber}`);
    if (p.licenceNumber) lines.push(`${ti("licence", lang)}: ${p.licenceNumber}`);
  } else if (p.businessNumber) {
    lines.push(`${ti("gstHst", lang)}: ${p.businessNumber}`);
  }
  return lines.filter(Boolean);
}

export function dueText(inv: Pick<Invoice, "issueDate" | "dueDate">, lang: Lang): string {
  const days = Math.round((inv.dueDate.getTime() - inv.issueDate.getTime()) / 86_400_000);
  if (days <= 0) return `${ti("dueOnReceipt", lang)}`;
  return `${fmtDay(inv.dueDate, lang)} · ${ti("netDays", lang).replace("{n}", String(days))}`;
}

export function watermark(inv: Pick<Invoice, "status" | "totalCents" | "paidCents">): IKey | null {
  if (inv.status === "draft") return "status_draft";
  if (inv.status === "void") return "status_void";
  if (inv.status === "paid") return "status_paid";
  if (inv.status === "overdue") return "status_overdue";
  if (inv.status === "partially_paid") return "status_partially_paid";
  return null;
}

// ── HTML ─────────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const INVOICE_CSS = `
.inv { font-family: system-ui,-apple-system,"Segoe UI",sans-serif; color:#111827; font-size:14px; line-height:1.5; position:relative; }
.inv .wm { position:absolute; right:0; top:0; font-size:12px; font-weight:800; letter-spacing:0.12em; padding:4px 10px; border-radius:6px; border:2px solid currentColor; }
.inv .wm.draft { color:#92400e; } .inv .wm.void { color:#991b1b; } .inv .wm.paid { color:#047857; } .inv .wm.overdue { color:#b91c1c; } .inv .wm.partially_paid { color:#1d4ed8; }
.inv h1 { font-size:24px; margin:0 0 2px; letter-spacing:-0.01em; }
.inv .sub { color:#6b7280; font-size:13px; margin-bottom:20px; }
.inv .meta { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
.inv .party-label { font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#6b7280; margin-bottom:2px; }
.inv .party-name { font-weight:700; font-size:15px; }
.inv .party-line { font-size:12.5px; color:#374151; }
.inv table.kv { font-size:13px; border-collapse:collapse; margin-bottom:16px; }
.inv table.kv th { text-align:left; color:#6b7280; font-weight:600; padding:2px 16px 2px 0; font-size:12px; white-space:nowrap; }
.inv table.kv td { padding:2px 0; }
.inv table.grid { width:100%; border-collapse:collapse; font-size:13px; margin:8px 0 12px; }
.inv table.grid th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:#6b7280; border-bottom:1px solid #d1d5db; padding:6px 8px; }
.inv table.grid td { padding:7px 8px; border-bottom:1px solid #f3f4f6; vertical-align:top; }
.inv table.grid .num { text-align:right; white-space:nowrap; }
.inv table.totals { width:100%; max-width:360px; margin-left:auto; border-collapse:collapse; font-size:13.5px; }
.inv table.totals td { padding:5px 8px; }
.inv table.totals tr.total td { font-weight:800; font-size:16px; border-top:2px solid #111827; background:#f9fafb; }
.inv table.totals tr.muted td { color:#6b7280; }
.inv table.totals tr.balance td { font-weight:700; color:#047857; }
.inv .box { background:#f5f3ff; border:1px solid #ede9fe; border-radius:10px; padding:12px 16px; margin:20px 0 8px; font-size:13px; }
.inv .box h3 { margin:0 0 6px; font-size:12px; text-transform:uppercase; letter-spacing:0.06em; color:#5b21b6; }
.inv .note { font-size:12px; color:#6b7280; margin-top:8px; }
.inv .thanks { margin-top:18px; color:#374151; font-size:13px; }
`;

export function renderInvoiceHtml(inv: Invoice, payments: InvoicePayment[] = []): string {
  const lang = inv.language as Lang;
  const credit = isCreditNote(inv);
  const parts: string[] = [];
  const wm = watermark(inv);
  if (wm) parts.push(`<div class="wm ${inv.status}">${ti(wm, lang)}</div>`);
  parts.push(`<h1>${esc(invoiceTitle(inv, lang))}</h1>`);
  parts.push(`<div class="sub">${credit ? ti("creditNoteNo", lang) : ti("invoiceNo", lang)} <strong>${esc(inv.number)}</strong> · ${ti("issued", lang)} ${fmtDay(inv.issueDate, lang)}${credit ? "" : ` · ${ti("due", lang)}: ${esc(dueText(inv, lang))}`}</div>`);

  const party = (label: string, p: InvoiceParty, registration: boolean) =>
    `<div><div class="party-label">${label}</div><div class="party-name">${esc(p.name)}</div>${partyLines(p, lang, { registration }).map((l) => `<div class="party-line">${esc(l)}</div>`).join("")}</div>`;
  parts.push(`<div class="meta">${party(ti("from", lang), inv.contractor, true)}${party(ti("billTo", lang), inv.customer, false)}</div>`);

  const kv: string[] = [];
  if (inv.siteAddress) kv.push(`<tr><th>${ti("site", lang)}</th><td>${esc(inv.siteAddress)}</td></tr>`);
  if (inv.paymentTermLabel) kv.push(`<tr><th>${ti("paymentTerm", lang)}</th><td>${esc(inv.paymentTermLabel)}</td></tr>`);
  if (kv.length) parts.push(`<table class="kv">${kv.join("")}</table>`);

  const rows = inv.lines
    .map((l) => `<tr><td>${esc(l.description)}</td><td class="num">${fmtQty(l.quantity, lang)}</td><td class="num">${fmtCents(l.unitCents, lang)}</td><td class="num">${fmtCents(l.amountCents, lang)}</td></tr>`)
    .join("");
  parts.push(`<table class="grid"><thead><tr><th>${ti("description", lang)}</th><th class="num">${ti("qty", lang)}</th><th class="num">${ti("unit", lang)}</th><th class="num">${ti("amount", lang)}</th></tr></thead><tbody>${rows}</tbody></table>`);

  const totals: string[] = [];
  totals.push(`<tr><td>${ti("subtotal", lang)}</td><td class="num">${fmtCents(inv.subtotalCents, lang)}</td></tr>`);
  if (inv.holdbackCents > 0) {
    totals.push(`<tr><td>${ti("holdback", lang)} (${inv.holdbackPercent}%)</td><td class="num">− ${fmtCents(inv.holdbackCents, lang)}</td></tr>`);
    totals.push(`<tr class="muted"><td>${ti("taxable", lang)}</td><td class="num">${fmtCents(inv.taxableCents, lang)}</td></tr>`);
  }
  for (const t of inv.taxLines) {
    totals.push(`<tr><td>${esc(t.label)} ${t.rate}%${t.registrationNumber ? ` <span style="color:#6b7280">(${esc(t.registrationNumber)})</span>` : ""}</td><td class="num">${fmtCents(t.amountCents, lang)}</td></tr>`);
  }
  totals.push(`<tr class="total"><td>${credit ? ti("creditTotal", lang) : ti("total", lang)}</td><td class="num">${fmtCents(inv.totalCents, lang)}</td></tr>`);
  if (!credit && inv.paidCents > 0 && inv.status !== "void") {
    totals.push(`<tr class="muted"><td>${ti("paid", lang)}</td><td class="num">− ${fmtCents(inv.paidCents, lang)}</td></tr>`);
    totals.push(`<tr class="balance"><td>${ti("balance", lang)}</td><td class="num">${fmtCents(Math.max(0, inv.totalCents - inv.paidCents), lang)}</td></tr>`);
  }
  parts.push(`<table class="totals">${totals.join("")}</table>`);
  if (inv.holdbackCents > 0) parts.push(`<p class="note">${ti("holdbackNote", lang)}</p>`);

  if (!credit && inv.status !== "void" && inv.status !== "paid") {
    const pi = inv.paymentInstructions ?? {};
    const lines: string[] = [];
    if (pi.etransferEmail) lines.push(`<div>${ti("etransfer", lang)} <strong>${esc(pi.etransferEmail)}</strong></div>`);
    if (pi.chequePayableTo) lines.push(`<div>${ti("cheque", lang)} <strong>${esc(pi.chequePayableTo)}</strong></div>`);
    if (pi.note) lines.push(`<div>${esc(pi.note)}</div>`);
    if (lines.length) parts.push(`<div class="box"><h3>${ti("payment", lang)}</h3>${lines.join("")}<div class="note">${ti("reference", lang)}</div></div>`);
  }

  if (payments.length > 0 && !credit) {
    const prow = payments.map((p) => `<tr><td>${fmtDay(p.date, lang)}</td><td>${ti(`method_${p.method}` as IKey, lang)}${p.reference ? ` · ${esc(p.reference)}` : ""}</td><td class="num">${fmtCents(p.amountCents, lang)}</td></tr>`).join("");
    parts.push(`<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;margin:16px 0 4px">${ti("paymentsReceived", lang)}</h3><table class="grid"><tbody>${prow}</tbody></table>`);
  }

  if (inv.notes) parts.push(`<div class="note"><strong>${ti("notes", lang)}:</strong> ${esc(inv.notes).replace(/\n/g, "<br/>")}</div>`);
  parts.push(`<p class="thanks">${ti("thanks", lang)}</p>`);
  return `<div class="inv">${parts.join("\n")}</div>`;
}
