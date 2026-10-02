// The company's profile and the choices the Settings pages save (routes/business-profile.ts): its shape on the phone, the defaults where the server has
// nothing yet, and the small rules (the deposit that takes from the last payment, the net days, the holdback). Pure, so they are tested (profile.test.ts).

export type PaymentTerm = {
  id: string; type: "deposit" | "milestone" | "completion" | "holdback_release"; label: string;
  trigger: "on_signing" | "milestone" | "on_completion" | "days_after_signing" | "holdback_release"; milestoneKey?: string; offsetDays?: number;
  amountType: "percent" | "fixed"; value: number; dueDays: number;
};
export type PaymentSchedule = { currency: "CAD"; terms: PaymentTerm[]; holdback: { enabled: boolean; percent: number }; derived: boolean };

export type Automation = {
  notifyOnQuoteAccepted: boolean; autoDraftContract: boolean; autoSendInvoices: boolean; invoiceAutoSendAfterHours: number; invoiceReminders: boolean;
  smsEnabled: boolean; smsReminders: boolean; scheduleReminders: boolean; leadFollowupDays: number[]; quoteFollowupDays: number[]; reviewRequestDelayDays: number;
};

export type TaxPage = { byJobProvince?: boolean; split?: boolean; showAs?: "line" | "included"; perLine?: boolean; showNumber?: boolean; exempt?: { clientId: string; reason: "rebate" | "exempt" }[] };
export type QuotesPage = { goodBetterBest?: boolean; acceptanceEmail?: boolean; terms?: string; followupMessages?: string[]; followupOn?: boolean[]; followupDays?: number[] };
export type InvoicesPage = {
  numberPrefix?: string; nextNumber?: number; terms?: "receipt" | "net15" | "net30"; sendDelayDays?: number;
  reminderBefore?: boolean; reminderDue?: boolean; reminderAfter?: boolean; reminderBy?: "email" | "sms" | "both";
  payEtransfer?: boolean; payCheque?: boolean; chequePayableTo?: string; holdbackOn?: boolean; holdbackPercent?: number; holdbackReleaseDays?: number;
  lateFeeOn?: boolean; lateFeeRate?: number; lateFeeAfterDays?: number;
};
export type PocketSettings = { tax?: TaxPage; quotes?: QuotesPage; invoices?: InvoicesPage } & Record<string, Record<string, unknown> | undefined>;

export type Profile = {
  userId: string; companyName: string; vatNumber: string | null; address: string | null; logoUrl: string | null; phone: string | null; email: string | null;
  province: string | null; taxProfile?: { province: string; totalRate: number; components: { code: string; label: string; rate: number }[] } | null; gstHstNumber: string | null; qstNumber: string | null; pstNumber: string | null; licenceNumber: string | null; etransferEmail: string | null;
  apiKey?: string | null; legalName: string | null; wsibNumber: string | null; website: string | null; brandColor: string | null; docLanguage: "en" | "fr" | null;
  defaultPaymentSchedule: PaymentSchedule | null; quoteValidDays: number; materialsMarkupPercent: number; quoteCopyToMe: boolean; units: "imperial" | "metric" | "both";
  googleReviewUrl: string | null; homeStarsProfileUrl: string | null; sendReviewRequests: boolean;
  automationSettings: Automation; pocketSettings: PocketSettings; plan: string; features: Record<string, boolean>;
};

export type ProfilePatch = Partial<Omit<Profile, "userId" | "plan" | "features" | "automationSettings" | "pocketSettings">> & {
  automationSettings?: Partial<Automation>;
  pocketSettings?: { [page: string]: Record<string, unknown> };
};

/** The server's own starting schedule (lib/db payment-schedule.ts), for a company that never set one. */
export function defaultSchedule(): PaymentSchedule {
  return {
    currency: "CAD", derived: true, holdback: { enabled: false, percent: 10 },
    terms: [
      { id: "t1", type: "deposit", label: "Deposit upon contract signing", trigger: "on_signing", amountType: "percent", value: 15, dueDays: 0 },
      { id: "t2", type: "milestone", label: "Delivery of materials and start of work", trigger: "milestone", amountType: "percent", value: 35, dueDays: 15 },
      { id: "t3", type: "milestone", label: "Substantial completion", trigger: "milestone", amountType: "percent", value: 35, dueDays: 15 },
      { id: "t4", type: "completion", label: "Final balance upon completion and client walkthrough", trigger: "on_completion", amountType: "percent", value: 15, dueDays: 15 },
    ],
  };
}

export const scheduleOf = (p: Pick<Profile, "defaultPaymentSchedule"> | null | undefined): PaymentSchedule => p?.defaultPaymentSchedule ?? defaultSchedule();

const isPercentDeposit = (t: PaymentTerm) => t.type === "deposit" && t.amountType === "percent";

/** The default deposit, in percent (0 when the schedule asks for none). */
export const depositOf = (s: PaymentSchedule): number => s.terms.find(isPercentDeposit)?.value ?? 0;

/**
 * The schedule with a new deposit: what the deposit gained comes off the last percentage payment, and what it lost goes back to it, so the terms
 * still add up. Null when the last payment can't give that much (the deposit would push it below nothing), or when there is no payment to move it to.
 */
export function withDeposit(s: PaymentSchedule, value: number, label: string): PaymentSchedule | null {
  const terms = s.terms.map((t) => ({ ...t }));
  const tail = terms.filter((t) => t.type !== "deposit" && t.type !== "holdback_release" && t.amountType === "percent").at(-1);
  if (!tail) return null;
  const dep = terms.find(isPercentDeposit);
  const delta = value - (dep?.value ?? 0);
  if (tail.value - delta < 0) return null;
  tail.value = Math.round((tail.value - delta) * 100) / 100;
  if (dep) dep.value = value;
  else terms.unshift({ id: `t${terms.length + 1}d`, type: "deposit", label, trigger: "on_signing", amountType: "percent", value, dueDays: 0 });
  return { ...s, terms: terms.filter((t) => t.type !== "deposit" || t.value > 0), derived: false };
}

export type Net = "receipt" | "net15" | "net30";
const NET_DAYS: Record<Net, number> = { receipt: 0, net15: 15, net30: 30 };
export const NETS: Net[] = ["receipt", "net15", "net30"];

/** The payment terms: the days an invoice gives, read from the payments after the deposit (the deposit is due on signing). */
export function netOf(s: PaymentSchedule): Net {
  const t = s.terms.find((x) => x.type !== "deposit" && x.type !== "holdback_release");
  const d = t?.dueDays ?? 15;
  return d <= 0 ? "receipt" : d <= 22 ? "net15" : "net30";
}

export function withNet(s: PaymentSchedule, net: Net): PaymentSchedule {
  return { ...s, derived: false, terms: s.terms.map((t) => (t.type === "deposit" || t.type === "holdback_release" ? t : { ...t, dueDays: NET_DAYS[net] })) };
}

export function withHoldback(s: PaymentSchedule, enabled: boolean, percent = s.holdback.percent): PaymentSchedule {
  return { ...s, derived: false, holdback: { enabled, percent } };
}

/** The day after which the invoices' send is delayed, from the server's hours (0 = sent as drafted). */
export const sendDelayDays = (a: Pick<Automation, "invoiceAutoSendAfterHours">): number => Math.round(a.invoiceAutoSendAfterHours / 24);

/** One value of a Settings page, read with its default. */
export function pageOf<K extends "tax" | "quotes" | "invoices">(p: Pick<Profile, "pocketSettings"> | null | undefined, key: K): NonNullable<PocketSettings[K]> {
  return (p?.pocketSettings?.[key] ?? {}) as NonNullable<PocketSettings[K]>;
}

/** A page the server keeps as sent (messaging, templates, widget): one value is read with its default. */
export function extraPage(p: Pick<Profile, "pocketSettings"> | null | undefined, key: string): Record<string, unknown> {
  return (p?.pocketSettings?.[key] ?? {}) as Record<string, unknown>;
}

export type BrandKey = "violet" | "harbour" | "forest" | "brick" | "teal" | "charcoal";
/** The brand colours the board offers (SetCompany swatches) are in theme/board.ts (src/ui stays free of typed colours); the first is the violet of the app. */
export const BRAND_KEYS: BrandKey[] = ["violet", "harbour", "forest", "brick", "teal", "charcoal"];

/** A GST/HST number as the CRA writes it: 9 digits, "RT", 4 digits. Spaces are ignored. True when it looks right; nothing is checked with the CRA. */
export const looksLikeGstHst = (v: string): boolean => /^\d{9}RT\d{4}$/i.test(v.replace(/\s+/g, ""));

/** The profile with a patch applied as the server will: pages and the automation settings change only the keys sent. */
export function applyPatch(p: Profile, patch: ProfilePatch): Profile {
  const { automationSettings, pocketSettings, ...rest } = patch;
  const pages: PocketSettings = { ...p.pocketSettings };
  for (const [k, v] of Object.entries(pocketSettings ?? {})) pages[k] = { ...(pages[k] ?? {}), ...v };
  return { ...p, ...rest, automationSettings: { ...p.automationSettings, ...(automationSettings ?? {}) }, pocketSettings: pages };
}

/** Which swatch a saved colour is (the violet when it is none of them). */
export const brandKeyOf = (hex: string | null | undefined, colours: Record<BrandKey, string>): BrandKey => BRAND_KEYS.find((k) => colours[k].toLowerCase() === (hex ?? "").toLowerCase()) ?? "violet";

/** The next invoice number as the server writes it (INV-2026-0004): one more than the highest of this year's, or the first. */
export function nextInvoiceNumber(numbers: string[], year: number): string {
  const re = new RegExp(`^INV-${year}-(\\d+)$`);
  const top = numbers.reduce((n, x) => Math.max(n, Number(re.exec(x)?.[1] ?? 0)), 0);
  return `INV-${year}-${String(top + 1).padStart(4, "0")}`;
}
