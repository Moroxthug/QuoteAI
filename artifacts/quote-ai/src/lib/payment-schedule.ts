// Client-side types/helpers for the structured payment schedule. The server
// (lib/db/src/schema/payment-schedule.ts) is the source of truth; this file
// mirrors the shape and the arithmetic so the editor can validate live.

export type PaymentTermType = "deposit" | "milestone" | "completion" | "holdback_release";
export type PaymentTrigger = "on_signing" | "milestone" | "on_completion" | "days_after_signing" | "holdback_release";

export type PaymentTerm = {
  id: string;
  type: PaymentTermType;
  label: string;
  trigger: PaymentTrigger;
  milestoneKey?: string;
  offsetDays?: number;
  amountType: "percent" | "fixed";
  value: number;
  dueDays: number;
};

export type PaymentSchedule = {
  currency: "CAD";
  terms: PaymentTerm[];
  holdback: { enabled: boolean; percent: number };
  derived: boolean;
};

export const CANADIAN_PROVINCES: { code: string; en: string; fr: string }[] = [
  { code: "AB", en: "Alberta", fr: "Alberta" },
  { code: "BC", en: "British Columbia", fr: "Colombie-Britannique" },
  { code: "MB", en: "Manitoba", fr: "Manitoba" },
  { code: "NB", en: "New Brunswick", fr: "Nouveau-Brunswick" },
  { code: "NL", en: "Newfoundland and Labrador", fr: "Terre-Neuve-et-Labrador" },
  { code: "NS", en: "Nova Scotia", fr: "Nouvelle-Écosse" },
  { code: "NT", en: "Northwest Territories", fr: "Territoires du Nord-Ouest" },
  { code: "NU", en: "Nunavut", fr: "Nunavut" },
  { code: "ON", en: "Ontario", fr: "Ontario" },
  { code: "PE", en: "Prince Edward Island", fr: "Île-du-Prince-Édouard" },
  { code: "QC", en: "Quebec", fr: "Québec" },
  { code: "SK", en: "Saskatchewan", fr: "Saskatchewan" },
  { code: "YT", en: "Yukon", fr: "Yukon" },
];

export function newTermId(): string {
  return `t${Math.random().toString(36).slice(2, 8)}`;
}

export function triggerForType(type: PaymentTermType): PaymentTrigger {
  switch (type) {
    case "deposit": return "on_signing";
    case "completion": return "on_completion";
    case "holdback_release": return "holdback_release";
    default: return "milestone";
  }
}

export function paymentTermAmount(term: PaymentTerm, total: number): number {
  const raw = term.amountType === "percent" ? (total * term.value) / 100 : term.value;
  return Math.round(raw * 100) / 100;
}

export function scheduleTotal(schedule: PaymentSchedule, total: number): number {
  return Math.round(schedule.terms.reduce((s, t) => s + paymentTermAmount(t, total), 0) * 100) / 100;
}

/** Returns a translation key describing the problem, or null when valid. */
export function validateSchedule(schedule: PaymentSchedule, total: number): "sum" | "signing" | "empty" | null {
  if (schedule.terms.length === 0) return "empty";
  if (total > 0 && Math.abs(scheduleTotal(schedule, total) - total) > 1) return "sum";
  if (schedule.terms.filter((t) => t.trigger === "on_signing").length > 1) return "signing";
  return null;
}
