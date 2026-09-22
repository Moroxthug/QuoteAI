// Mirror of lib/db/src/schema/tax.ts — keep the two in sync. Same reason as
// src/lib/plans.ts: the frontend cannot import @workspace/db (pg dependency),
// and the marketing pages are prerendered at build time, so they cannot wait
// for GET /api/tax-profiles the way the quote builder does.
//
// `tax-parity.test.ts` in the api-server unit suite imports both and fails on
// any drift, so a rate change in one place breaks the build rather than
// quietly printing a wrong number on a province landing page.

export const CANADIAN_PROVINCES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
] as const;
export type ProvinceCode = (typeof CANADIAN_PROVINCES)[number];

export const PROVINCE_NAMES: Record<ProvinceCode, { en: string; fr: string }> = {
  AB: { en: "Alberta", fr: "Alberta" },
  BC: { en: "British Columbia", fr: "Colombie-Britannique" },
  MB: { en: "Manitoba", fr: "Manitoba" },
  NB: { en: "New Brunswick", fr: "Nouveau-Brunswick" },
  NL: { en: "Newfoundland and Labrador", fr: "Terre-Neuve-et-Labrador" },
  NS: { en: "Nova Scotia", fr: "Nouvelle-Écosse" },
  NT: { en: "Northwest Territories", fr: "Territoires du Nord-Ouest" },
  NU: { en: "Nunavut", fr: "Nunavut" },
  ON: { en: "Ontario", fr: "Ontario" },
  PE: { en: "Prince Edward Island", fr: "Île-du-Prince-Édouard" },
  QC: { en: "Quebec", fr: "Québec" },
  SK: { en: "Saskatchewan", fr: "Saskatchewan" },
  YT: { en: "Yukon", fr: "Yukon" },
};

export type TaxComponent = {
  code: "GST" | "HST" | "PST" | "QST" | "RST" | "TAX";
  label: string;
  /** Percent, e.g. 13 for 13 %. */
  rate: number;
};

export type TaxProfile = {
  province: ProvinceCode;
  components: TaxComponent[];
  totalRate: number;
};

const P = (province: ProvinceCode, components: TaxComponent[]): TaxProfile => ({
  province,
  components,
  totalRate: Math.round(components.reduce((s, c) => s + c.rate, 0) * 1000) / 1000,
});

const GST: TaxComponent = { code: "GST", label: "GST", rate: 5 };

/** Rates as of 2026. Nova Scotia HST dropped to 14 % on 2025-04-01. */
export const TAX_PROFILES: Record<ProvinceCode, TaxProfile> = {
  AB: P("AB", [GST]),
  BC: P("BC", [GST, { code: "PST", label: "PST", rate: 7 }]),
  MB: P("MB", [GST, { code: "RST", label: "RST", rate: 7 }]),
  NB: P("NB", [{ code: "HST", label: "HST", rate: 15 }]),
  NL: P("NL", [{ code: "HST", label: "HST", rate: 15 }]),
  NS: P("NS", [{ code: "HST", label: "HST", rate: 14 }]),
  NT: P("NT", [GST]),
  NU: P("NU", [GST]),
  ON: P("ON", [{ code: "HST", label: "HST", rate: 13 }]),
  PE: P("PE", [{ code: "HST", label: "HST", rate: 15 }]),
  QC: P("QC", [GST, { code: "QST", label: "QST", rate: 9.975 }]),
  SK: P("SK", [GST, { code: "PST", label: "PST", rate: 6 }]),
  YT: P("YT", [GST]),
};

/** French names for the component codes — "GST" is "TPS" on a French document. */
const FR_CODE_LABEL: Record<TaxComponent["code"], string> = {
  GST: "TPS", HST: "TVH", PST: "TVP", QST: "TVQ", RST: "TVD", TAX: "Taxe",
};

export function taxComponentLabel(c: TaxComponent, lang: "en" | "fr"): string {
  return lang === "fr" ? FR_CODE_LABEL[c.code] : c.label;
}

/** "9.975" in English, "9,975" in French — Intl, so the separator follows the locale. */
export function formatRate(rate: number, lang: "en" | "fr"): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 3 }).format(rate);
}
