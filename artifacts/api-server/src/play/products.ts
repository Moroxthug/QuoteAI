// Phase 135 (docs/GROWTH-PLAN.md, "Play Billing contract"): the Google Play product catalog and how a Play product maps to our plans. Pure.
// The server derives plan, interval and founding from what Google returns (product id + base plan id), never from what the app says.

export type PlayTier = "monthly_starter" | "monthly_pro" | "monthly_business";
export type PlayInterval = "month" | "year";

export const DEFAULT_PLAY_PACKAGE = "ca.quoteai.app";

/** Play subscription (product) ids, as created in the Play Console. */
export const PLAY_PRODUCTS: Readonly<Record<string, PlayTier>> = {
  quoteai_starter: "monthly_starter",
  quoteai_pro: "monthly_pro",
  quoteai_business: "monthly_business",
};

/** Base plans every product has, and the one only Starter has (the founding price, kept for life). */
const BASE_PLANS: Readonly<Record<string, { interval: PlayInterval; founding: boolean }>> = {
  monthly: { interval: "month", founding: false },
  yearly: { interval: "year", founding: false },
  launch: { interval: "month", founding: true },
};

/** CAD cents per month on the list; yearly is 10 months (same rule as Stripe, lib/billing.ts). */
export const LIST_MONTHLY_CENTS: Readonly<Record<PlayTier, number>> = { monthly_starter: 2900, monthly_pro: 7900, monthly_business: 24900 };
export const FOUNDING_MONTHLY_CENTS = 1900;
const ANNUAL_MONTHS_CHARGED = 10;

export type PlayPlan = { tier: PlayTier; interval: PlayInterval; founding: boolean };

/** Null when the pair is not one of ours (an unknown product, or `launch` on a tier other than Starter). */
export function planFromPlay(productId: string | null | undefined, basePlanId: string | null | undefined): PlayPlan | null {
  if (!productId || !basePlanId) return null;
  if (!Object.prototype.hasOwnProperty.call(PLAY_PRODUCTS, productId) || !Object.prototype.hasOwnProperty.call(BASE_PLANS, basePlanId)) return null;
  const tier = PLAY_PRODUCTS[productId]!;
  const base = BASE_PLANS[basePlanId]!;
  if (base.founding && tier !== "monthly_starter") return null;
  return { tier, interval: base.interval, founding: base.founding };
}

/** What one payment of this plan costs on the list (CAD cents): the fallback when Google's reply carries no price. */
export function listPriceCents(plan: PlayPlan): number {
  if (plan.founding) return FOUNDING_MONTHLY_CENTS;
  const monthly = LIST_MONTHLY_CENTS[plan.tier];
  return plan.interval === "year" ? monthly * ANNUAL_MONTHS_CHARGED : monthly;
}

/** The monthly money of the plan, the way the HQ counts MRR (a yearly price is a twelfth). */
export function monthlyCentsOf(plan: PlayPlan, paymentCents: number): number {
  return plan.interval === "year" ? Math.round(paymentCents / 12) : paymentCents;
}

export type CatalogProduct = { productId: string; basePlanId: string; tier: PlayTier; interval: PlayInterval; founding: boolean };

/** The `products` array of GET /billing/play/catalog. `launch` appears only while the launch offer is active. */
export function catalogProducts(launchActive: boolean): CatalogProduct[] {
  const out: CatalogProduct[] = [];
  for (const [productId, tier] of Object.entries(PLAY_PRODUCTS)) {
    for (const [basePlanId, base] of Object.entries(BASE_PLANS)) {
      if (base.founding && (tier !== "monthly_starter" || !launchActive)) continue;
      out.push({ productId, basePlanId, tier, interval: base.interval, founding: base.founding });
    }
  }
  return out;
}

/** The Play package name (env, default ca.quoteai.app). Read by its literal name for env:inventory. */
export function playPackageName(env: NodeJS.ProcessEnv = { GOOGLE_PLAY_PACKAGE_NAME: process.env.GOOGLE_PLAY_PACKAGE_NAME }): string {
  const v = env.GOOGLE_PLAY_PACKAGE_NAME?.trim();
  return v ? v : DEFAULT_PLAY_PACKAGE;
}
