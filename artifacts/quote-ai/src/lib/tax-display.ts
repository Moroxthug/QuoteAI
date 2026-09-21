// Phase 71: presentation helpers for the statutory tax lines the API returns
// on quotes (`taxLines`) and for the manual builder's live preview. The rates
// themselves come from GET /api/tax-profiles — never a client-side copy.
import type { QuoteTaxLine, TaxProfile } from "@workspace/api-client-react";

type Lang = "en" | "fr";

const TAX_LABEL_FR: Record<string, string> = { GST: "TPS", HST: "TVH", QST: "TVQ", PST: "TVP", RST: "TVD" };

function taxLabel(label: string, lang: Lang): string {
  return lang === "fr" ? (TAX_LABEL_FR[label.toUpperCase()] ?? label) : label;
}

function fmtRate(rate: number, lang: Lang): string {
  const n = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 3 }).format(rate);
  return lang === "fr" ? `${n} %` : `${n}%`;
}

/** "GST 5%" / "TVQ 9,975 %" / "Tax (7%)" for the generic line. */
export function taxLineLabel(line: { code: string; label: string; rate: number }, lang: Lang, genericLabel: string): string {
  if (line.code === "TAX") return `${genericLabel} (${fmtRate(line.rate, lang)})`;
  return `${taxLabel(line.label, lang)} ${fmtRate(line.rate, lang)}`;
}

/** "GST 5% + QST 9.975%" — the summary shown next to a province in a picker. */
export function profileSummary(profile: TaxProfile, lang: Lang): string {
  return profile.components.map((c) => `${taxLabel(c.label, lang)} ${fmtRate(c.rate, lang)}`).join(" + ");
}

/**
 * Client-side preview of the component amounts for a taxable amount; mirrors
 * `quoteTaxLines` in lib/db (last line absorbs rounding so the sum equals the
 * rounded total).
 */
export function previewTaxLines(taxable: number, profile: TaxProfile | null): QuoteTaxLine[] {
  if (!profile) return [];
  const total = Math.round(taxable * profile.totalRate) / 100;
  const lines = profile.components.map((c) => ({ code: c.code as QuoteTaxLine["code"], label: c.label, rate: c.rate, amount: Math.round(taxable * c.rate) / 100 }));
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  const drift = Math.round((total - sum) * 100) / 100;
  if (drift !== 0 && lines.length > 0) lines[lines.length - 1].amount = Math.round((lines[lines.length - 1].amount + drift) * 100) / 100;
  return lines;
}
