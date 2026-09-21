// Canadian sales-tax profiles by province/territory. Kept in code (not a
// table) because rates change rarely and every money document must be able
// to compute them without a DB round-trip.

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
  /** "TAX" only for a hand-entered rate that matches no provincial profile (quotes, Phase 71). */
  code: "GST" | "HST" | "PST" | "QST" | "RST" | "TAX";
  label: string;
  /** Percent, e.g. 13 for 13%. */
  rate: number;
};

export type TaxProfile = {
  province: ProvinceCode;
  components: TaxComponent[];
  /** Sum of the component rates. */
  totalRate: number;
};

const P = (province: ProvinceCode, components: TaxComponent[]): TaxProfile => ({
  province,
  components,
  totalRate: Math.round(components.reduce((s, c) => s + c.rate, 0) * 1000) / 1000,
});

const GST: TaxComponent = { code: "GST", label: "GST", rate: 5 };

/** Rates as of 2026. Nova Scotia HST dropped to 14% on 2025-04-01. */
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

export const DEFAULT_PROVINCE: ProvinceCode = "ON";

export function isProvinceCode(value: unknown): value is ProvinceCode {
  return typeof value === "string" && (CANADIAN_PROVINCES as readonly string[]).includes(value);
}

/** Normalises free-form province input ("ontario", "Ont.", "on") to a code. */
export function normalizeProvince(value: string | null | undefined): ProvinceCode | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  if (isProvinceCode(v)) return v;
  const byName = (Object.keys(PROVINCE_NAMES) as ProvinceCode[]).find((code) => {
    const n = PROVINCE_NAMES[code];
    return n.en.toUpperCase() === v || n.fr.toUpperCase() === v;
  });
  if (byName) return byName;
  const aliases: Record<string, ProvinceCode> = {
    "ONT": "ON", "ONT.": "ON", "QUE": "QC", "QUE.": "QC", "PQ": "QC", "B.C.": "BC", "ALTA": "AB", "ALTA.": "AB",
    "SASK": "SK", "SASK.": "SK", "MAN": "MB", "MAN.": "MB", "N.B.": "NB", "N.S.": "NS", "P.E.I.": "PE", "PEI": "PE",
    "NFLD": "NL", "N.L.": "NL", "N.W.T.": "NT", "NWT": "NT", "Y.T.": "YT", "YUKON": "YT",
  };
  return aliases[v] ?? null;
}

export function getTaxProfile(province: string | null | undefined): TaxProfile {
  const code = normalizeProvince(province) ?? DEFAULT_PROVINCE;
  return TAX_PROFILES[code];
}

export type TaxBreakdownLine = TaxComponent & { amount: number };

/** Computes the tax breakdown (2-decimal CAD) for a pre-tax amount. */
export function computeTax(subtotal: number, province: string | null | undefined): {
  profile: TaxProfile;
  lines: TaxBreakdownLine[];
  total: number;
} {
  const profile = getTaxProfile(province);
  const lines = profile.components.map((c) => ({
    ...c,
    amount: Math.round(subtotal * c.rate) / 100,
  }));
  const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  return { profile, lines, total };
}

/**
 * Phase 71 — quotes store one total rate (`ivaPercentuale`) plus a province.
 * When that rate is the province's statutory total, the document shows the
 * statutory components (GST 5 % + QST 9.975 % in Québec, GST + PST in BC,
 * HST in Ontario); a hand-entered rate that matches no profile is shown as a
 * single generic "Tax" line, and 0 means tax-exempt (no lines at all).
 */
export function splitTaxRate(rate: number, province: string | null | undefined): TaxComponent[] {
  if (!(rate > 0)) return [];
  const code = normalizeProvince(province);
  if (code && Math.abs(TAX_PROFILES[code].totalRate - rate) < 0.01) return TAX_PROFILES[code].components;
  // The rate may be another province's total (client site elsewhere).
  const match = (Object.values(TAX_PROFILES) as TaxProfile[]).find((p) => Math.abs(p.totalRate - rate) < 0.01);
  if (match && match.components.length === 1) return match.components;
  return [{ code: "TAX", label: "Tax", rate }];
}

/**
 * Tax lines for a quote: component amounts sum exactly to `taxTotal` (the
 * stored `ivaValore`), so the PDF, the public page and the total never
 * disagree by a cent — the last line absorbs rounding.
 */
export function quoteTaxLines(taxable: number, rate: number, taxTotal: number, province: string | null | undefined): TaxBreakdownLine[] {
  const components = splitTaxRate(rate, province);
  if (components.length === 0) return [];
  const lines = components.map((c) => ({ ...c, amount: Math.round(taxable * c.rate) / 100 }));
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  const drift = Math.round((taxTotal - sum) * 100) / 100;
  if (drift !== 0) lines[lines.length - 1].amount = Math.round((lines[lines.length - 1].amount + drift) * 100) / 100;
  return lines;
}
