// Phase 71 — language + money/tax presentation for the quote documents (the
// three pdfmake layouts, the capitolato and the WhatsApp PDF). Contracts and
// invoices already pick a language the same way (contracts/service.ts,
// invoices/service.ts): the client's preferred language, else French in
// Québec, else English. Kept as one table so every quote surface agrees.
import { db, clientsTable, normalizeProvince, quoteTaxLines, type TaxBreakdownLine } from "@workspace/db";
import { eq } from "drizzle-orm";
import { taxLabel } from "../invoices/render.js";

export type QuoteLang = "en" | "fr";

export function resolveQuoteLanguage(opts: { clientLanguage?: string | null; province?: string | null }): QuoteLang {
  if (opts.clientLanguage === "fr" || opts.clientLanguage === "en") return opts.clientLanguage;
  return normalizeProvince(opts.province) === "QC" ? "fr" : "en";
}

/** Looks the linked client up so the document follows the client's language. */
export async function quoteLanguageFor(quote: { clientId?: string | null; province?: string | null; clientData?: unknown }): Promise<QuoteLang> {
  let clientLanguage: string | null = null;
  if (quote.clientId) {
    const [client] = await db.select({ preferredLanguage: clientsTable.preferredLanguage }).from(clientsTable).where(eq(clientsTable.id, quote.clientId));
    clientLanguage = client?.preferredLanguage ?? null;
  }
  const clientProvince = (quote.clientData as { province?: string } | null)?.province;
  return resolveQuoteLanguage({ clientLanguage, province: quote.province ?? clientProvince ?? null });
}

const Q = {
  defaultTitle: { en: "Project Quote & Itemized Estimate", fr: "Soumission et estimation détaillée" },
  quoteNo: { en: "No.", fr: "N°" },
  taxId: { en: "Tax ID", fr: "N° de taxe" },
  gstNo: { en: "GST/HST No.", fr: "N° TPS/TVH" },
  qstNo: { en: "QST No.", fr: "N° TVQ" },
  tel: { en: "Tel", fr: "Tél." },
  date: { en: "Date", fr: "Date" },
  page: { en: "Page", fr: "Page" },
  preparedFor: { en: "PREPARED FOR", fr: "PRÉPARÉE POUR" },
  summary: { en: "1. SUMMARY", fr: "1. SOMMAIRE" },
  detailedBoq: { en: "2. DETAILED BILL OF QUANTITIES", fr: "2. BORDEREAU DÉTAILLÉ" },
  chapter: { en: "Chapter", fr: "Section" },
  chapterSubtotal: { en: "Chapter {x} subtotal", fr: "Sous-total section {x}" },
  netAmount: { en: "Net Amount", fr: "Montant net" },
  notes: { en: "Notes", fr: "Notes" },
  standardItem: { en: "Standard item", fr: "Poste standard" },
  no: { en: "No.", fr: "N°" },
  description: { en: "Description", fr: "Description" },
  unit: { en: "Unit", fr: "Unité" },
  qty: { en: "Qty", fr: "Qté" },
  unitPrice: { en: "Unit Price ($)", fr: "Prix unitaire ($)" },
  total: { en: "Total ($)", fr: "Total ($)" },
  subtotal: { en: "SUBTOTAL", fr: "SOUS-TOTAL" },
  discount: { en: "DISCOUNT", fr: "RABAIS" },
  discountedSubtotal: { en: "DISCOUNTED SUBTOTAL", fr: "SOUS-TOTAL APRÈS RABAIS" },
  tax: { en: "TAX", fr: "TAXE" },
  taxExempt: { en: "TAX EXEMPT", fr: "EXONÉRÉ DE TAXES" },
  grandTotal: { en: "TOTAL + TAX", fr: "TOTAL TAXES INCLUSES" },
  paymentTerms: { en: "PAYMENT TERMS", fr: "MODALITÉS DE PAIEMENT" },
  nb: { en: "N.B. ANY REQUESTED WORK NOT INCLUDED IN THIS QUOTE MUST BE QUOTED AND PAID FOR SEPARATELY.", fr: "N.B. TOUT TRAVAIL DEMANDÉ QUI N'EST PAS INCLUS DANS CETTE SOUMISSION FERA L'OBJET D'UNE SOUMISSION ET D'UN PAIEMENT DISTINCTS." },
  note: { en: "NOTE", fr: "NOTE" },
  acceptance: { en: "QUOTE ACCEPTANCE", fr: "ACCEPTATION DE LA SOUMISSION" },
  acceptanceText: { en: "The undersigned, having reviewed this quote, accepts the terms indicated above and authorizes the work to proceed.", fr: "Le soussigné, ayant pris connaissance de la présente soumission, en accepte les conditions et autorise l'exécution des travaux." },
  dateAndLocation: { en: "Date and Location", fr: "Date et lieu" },
  clientSignature: { en: "Client Signature", fr: "Signature du client" },
  contractorSignature: { en: "Contractor Signature", fr: "Signature de l'entrepreneur" },
  draft: { en: "DRAFT", fr: "BROUILLON" },
  provisional: { en: "PROVISIONAL DOCUMENT – NOT VALID FOR CONTRACTUAL PURPOSES", fr: "DOCUMENT PROVISOIRE – SANS VALEUR CONTRACTUELLE" },
  generatedWith: { en: "Document generated with QuoteAI", fr: "Document généré avec QuoteAI" },
  acceptedOnline: { en: "Accepted online by {name} on {date}", fr: "Acceptée en ligne par {name} le {date}" },
  // capitolato (technical specification)
  specTitle: { en: "TECHNICAL SPECIFICATION", fr: "DEVIS TECHNIQUE" },
  specSubtitle: { en: "Detailed scope of work", fr: "Description détaillée des travaux" },
  scope: { en: "SCOPE OF WORK", fr: "PORTÉE DES TRAVAUX" },
  item: { en: "Item", fr: "Poste" },
  quantity: { en: "Quantity", fr: "Quantité" },
  // WhatsApp PDF
  quote: { en: "QUOTE", fr: "SOUMISSION" },
  client: { en: "Client", fr: "Client" },
  validity: { en: "Quote valid for 30 days", fr: "Soumission valide 30 jours" },
} as const;

export type QKey = keyof typeof Q;

export function qt(key: QKey, lang: QuoteLang, vars?: Record<string, string | number>): string {
  let s: string = Q[key][lang];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/** "$ 1,234.56" in English (matches the existing layouts), "1 234,56 $" in French. */
export function fmtMoney(amount: number, lang: QuoteLang): string {
  const n = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return lang === "fr" ? `${n} $` : `$ ${n}`;
}

export function fmtQuoteDate(d: Date, lang: QuoteLang): string {
  return d.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { timeZone: "America/Toronto" });
}

export function fmtRate(rate: number, lang: QuoteLang): string {
  const n = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 3 }).format(rate);
  return lang === "fr" ? `${n} %` : `${n}%`;
}

export type QuoteTaxLine = TaxBreakdownLine & { display: string };

/**
 * Tax lines for a quote (or a variant) in the document's language:
 * "TPS 5 %" / "TVQ 9,975 %" in French, "GST 5%" / "QST 9.975%" in English,
 * or a single "TAX (x%)" when the stored rate is not a provincial profile.
 */
export function quoteTaxLinesFor(q: { subtotale: string | number; ivaPercentuale: string | number; ivaValore: string | number; sconto?: { importoScontato?: number } | null }, province: string | null | undefined, lang: QuoteLang): QuoteTaxLine[] {
  const subtotal = Number(q.subtotale);
  const taxable = q.sconto && typeof q.sconto.importoScontato === "number" ? q.sconto.importoScontato : subtotal;
  const rate = Number(q.ivaPercentuale);
  const lines = quoteTaxLines(taxable, rate, Number(q.ivaValore), province);
  return lines.map((l) => ({
    ...l,
    display: l.code === "TAX" ? `${qt("tax", lang)} (${fmtRate(l.rate, lang)})` : `${taxLabel(l.label, lang)} ${fmtRate(l.rate, lang)}`,
  }));
}

/** Plain number with locale separators (table cells where the $ is in the header). */
export function fmtQty(n: number, lang: QuoteLang): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
