// Phase 73 (docs/PILOT-LAUNCH-PLAN.md): the one place QuoteAI's registered
// legal identity lives. The privacy policy, the terms, the public footer, every
// email QuoteAI sends from quoteai.ca and the billing page all read from here,
// so the owner-track item O5 is a single edit to this file.
//
// Until `legalName` is filled in, `isLegalEntityConfigured()` is false and
// every consumer falls back to the plain "QuoteAI" wording that shipped
// before this phase — nothing renders an empty address or a blank tax number.

export type LegalEntity = {
  /** Registered corporate / business name exactly as on the registration, e.g. "1234567 Canada Inc." */
  legalName: string;
  /** Operating name shown to customers. */
  tradeName: string;
  /** Mailing address lines (street, city + province + postal code), no country. */
  addressLines: string[];
  /** Two-letter province of incorporation / registration. */
  province: string;
  /** e.g. "123456789 RT0001" — leave "" if not registered. */
  gstHstNumber: string;
  /** e.g. "1234567890 TQ0001" — leave "" if not registered for QST. */
  qstNumber: string;
  supportEmail: string;
  privacyEmail: string;
  website: string;
};

export const LEGAL_ENTITY: LegalEntity = {
  legalName: "",
  tradeName: "QuoteAI",
  addressLines: [],
  province: "ON",
  gstHstNumber: "",
  qstNumber: "",
  supportEmail: "support@quoteai.ca",
  privacyEmail: "privacy@quoteai.ca",
  website: "https://quoteai.ca",
};

export function isLegalEntityConfigured(entity: LegalEntity = LEGAL_ENTITY): boolean {
  return entity.legalName.trim().length > 0;
}

const PROVINCE_NAMES: Record<"en" | "fr", Record<string, string>> = {
  en: { AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories", NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan", YT: "Yukon" },
  fr: { AB: "Alberta", BC: "Colombie-Britannique", MB: "Manitoba", NB: "Nouveau-Brunswick", NL: "Terre-Neuve-et-Labrador", NS: "Nouvelle-Écosse", NT: "Territoires du Nord-Ouest", NU: "Nunavut", ON: "Ontario", PE: "Île-du-Prince-Édouard", QC: "Québec", SK: "Saskatchewan", YT: "Yukon" },
};

export function provinceName(code: string, lang: "en" | "fr" = "en"): string {
  return PROVINCE_NAMES[lang][code.toUpperCase()] ?? code;
}

/** "QuoteAI is operated by <legal name>" / "QuoteAI est exploité par <legal name>" — or just the trade name before O5. */
export function operatedByLine(lang: "en" | "fr", entity: LegalEntity = LEGAL_ENTITY): string {
  if (!isLegalEntityConfigured(entity)) return entity.tradeName;
  return lang === "fr"
    ? `${entity.tradeName} est exploité par ${entity.legalName}`
    : `${entity.tradeName} is operated by ${entity.legalName}`;
}

/** Mailing address on one line, "" before O5. */
export function addressLine(entity: LegalEntity = LEGAL_ENTITY): string {
  return entity.addressLines.map((l) => l.trim()).filter(Boolean).join(", ");
}

/** "GST/HST 123456789 RT0001 · QST 1234567890 TQ0001" — only the numbers that are set. */
export function taxNumbersLine(lang: "en" | "fr", entity: LegalEntity = LEGAL_ENTITY): string {
  const parts: string[] = [];
  if (entity.gstHstNumber.trim()) parts.push(`${lang === "fr" ? "TPS/TVH" : "GST/HST"} ${entity.gstHstNumber.trim()}`);
  if (entity.qstNumber.trim()) parts.push(`${lang === "fr" ? "TVQ" : "QST"} ${entity.qstNumber.trim()}`);
  return parts.join(" · ");
}

/**
 * The compact identity block used in email footers and the site footer:
 * ["QuoteAI is operated by X", "street, city ON A1B 2C3", "GST/HST … · QST …"]
 * — empty parts dropped. Before O5 it is just ["QuoteAI"].
 */
export function legalIdentityLines(lang: "en" | "fr", entity: LegalEntity = LEGAL_ENTITY): string[] {
  return [operatedByLine(lang, entity), addressLine(entity), taxNumbersLine(lang, entity)].filter((l) => l.length > 0);
}
