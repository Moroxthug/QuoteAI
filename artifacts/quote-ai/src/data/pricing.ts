// Phase 81 — the public pricing table.
//
// The numbers here mirror PLANS in artifacts/api-server/src/routes/payments.ts
// (the Stripe prices are the real authority). Two things keep the mirror
// honest rather than hopeful:
//
//   • the /pricing page refetches GET /api/payments/plans after hydration and
//     renders whatever the server says — this table is what the *prerendered*
//     HTML shows, i.e. what a crawler and a first paint see;
//   • `pricing-parity.test.ts` in the api-server unit suite imports this file
//     and fails the build if a price, quota or annual multiplier drifts.
//
// Labels are not here: every string on the page goes through t() so the
// French page is a translation, not a second table that can drift.

// Relative, not the "@/" alias: the api-server parity test imports this file
// across packages and only the frontend's bundler knows that alias.
import { PLAN_FEATURES, SEATS_INCLUDED, type PlanId, type ProductFeature } from "../lib/plans";

/** Annual = 10 × monthly ("2 months free") — same constant as lib/billing.ts on the server. */
export const ANNUAL_MONTHS_CHARGED = 10;

type SubscriptionTierId = Extract<PlanId, "monthly_starter" | "monthly_pro" | "monthly_elite">;

export interface MarketingPlan {
  id: SubscriptionTierId;
  /** Product name — the same word in both languages, so it is not a t() key. */
  name: string;
  monthly: number;
  /** Quotes included per month; null = unlimited. */
  quotaPerMonth: number | null;
  /** Emphasised column on the pricing grid. */
  popular?: boolean;
}

export const MARKETING_PLANS: readonly MarketingPlan[] = [
  { id: "monthly_starter", name: "Starter", monthly: 19, quotaPerMonth: 10 },
  { id: "monthly_pro", name: "Pro", monthly: 49, quotaPerMonth: 60, popular: true },
  { id: "monthly_elite", name: "Elite", monthly: 59, quotaPerMonth: null },
];

/** Pay-per-quote, for contractors who send two a year and do not want a subscription. */
export interface OneShotOption {
  id: "oneshot_watermark" | "oneshot_clean";
  price: number;
}

export const ONE_SHOT_OPTIONS: readonly OneShotOption[] = [
  { id: "oneshot_watermark", price: 5 },
  { id: "oneshot_clean", price: 13 },
];

export function yearlyPrice(monthly: number): number {
  return monthly * ANNUAL_MONTHS_CHARGED;
}

/** "$49" → "$40.83" — what the annual price works out to per month. */
export function monthlyEquivalent(monthly: number): number {
  return Math.round((yearlyPrice(monthly) / 12) * 100) / 100;
}

/**
 * The comparison table. `feature` rows are answered from PLAN_FEATURES — the
 * same map the server gates on — so the marketing page cannot promise a tier
 * something the product does not give it. The handful of rows that are not a
 * feature flag (quotes included, seats, watermark) are computed instead.
 */
export type PricingRow =
  | { kind: "feature"; labelKey: string; feature: ProductFeature }
  | { kind: "quota"; labelKey: string }
  | { kind: "seats"; labelKey: string }
  | { kind: "watermark"; labelKey: string };

export const PRICING_ROWS: readonly PricingRow[] = [
  { kind: "quota", labelKey: "pricing.row.quotes" },
  { kind: "watermark", labelKey: "pricing.row.watermark" },
  { kind: "seats", labelKey: "pricing.row.seats" },
  { kind: "feature", labelKey: "pricing.row.quoteEmail", feature: "quote_email" },
  { kind: "feature", labelKey: "pricing.row.catalog", feature: "catalog" },
  { kind: "feature", labelKey: "pricing.row.contracts", feature: "contracts" },
  { kind: "feature", labelKey: "pricing.row.jobs", feature: "jobs" },
  { kind: "feature", labelKey: "pricing.row.costs", feature: "costs" },
  { kind: "feature", labelKey: "pricing.row.invoicing", feature: "invoicing" },
  { kind: "feature", labelKey: "pricing.row.teamAccounts", feature: "team_accounts" },
  { kind: "feature", labelKey: "pricing.row.teamTime", feature: "team_time" },
  { kind: "feature", labelKey: "pricing.row.assistant", feature: "assistant" },
  { kind: "feature", labelKey: "pricing.row.analytics", feature: "analytics_pro" },
];

/** Plans that print the "quoteai.ca" footer line on the PDF. */
const WATERMARKED: ReadonlySet<SubscriptionTierId> = new Set<SubscriptionTierId>(["monthly_starter"]);

/** What a cell says: true/false render a tick or a dash, a string renders as text. */
export function rowValue(row: PricingRow, plan: MarketingPlan, t: (k: string) => string): boolean | string {
  switch (row.kind) {
    case "feature":
      return PLAN_FEATURES[plan.id].has(row.feature);
    case "quota":
      return plan.quotaPerMonth === null ? t("pricing.value.unlimited") : String(plan.quotaPerMonth);
    case "seats":
      return String(SEATS_INCLUDED[plan.id]);
    case "watermark":
      return WATERMARKED.has(plan.id) ? t("pricing.value.watermarked") : t("pricing.value.clean");
  }
}

/** The questions the pricing page answers, in order. Bodies come from t(). */
export const PRICING_FAQ_KEYS = ["trial", "annual", "switch", "oneshot", "tax", "cancel", "pilot"] as const;
