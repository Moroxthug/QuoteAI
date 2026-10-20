import { and, count, eq, inArray, isNotNull, or } from "drizzle-orm";
import { db, businessProfilesTable } from "@workspace/db";
import { launchStarterPriceId } from "./billing.js";

// Launch pricing (docs/GROWTH-PLAN.md, Phase 133): Starter costs $19/month until the business has 100 paying customers, then $29/month for new customers.
// People who subscribe at $19 keep it (their Stripe subscription is never repriced). "Paying" = an active subscription with a Stripe customer or billed by Google Play (Phase 135), so plans the owner grants for free do not count.

export const LAUNCH_PRICE_CENTS = 1900;
export const STANDARD_PRICE_CENTS = 2900;
export const LAUNCH_CUSTOMER_LIMIT_DEFAULT = 100;

export type LaunchOffer = {
  /** True while the $19 price is offered (and a Stripe launch price exists on this deployment). */
  active: boolean;
  payingCustomers: number;
  limit: number;
  /** Spots left at the launch price. */
  remaining: number;
  launchPriceCents: number;
  standardPriceCents: number;
};

export function launchCustomerLimit(env: NodeJS.ProcessEnv = { LAUNCH_CUSTOMER_LIMIT: process.env.LAUNCH_CUSTOMER_LIMIT }): number {
  const n = Number.parseInt(env.LAUNCH_CUSTOMER_LIMIT ?? "", 10);
  return Number.isFinite(n) && n > 0 && n <= 100_000 ? n : LAUNCH_CUSTOMER_LIMIT_DEFAULT;
}

/** Pure: the offer for a given number of paying customers. `configured` = a Stripe launch price exists here. */
export function launchOfferFor(payingCustomers: number, limit: number, configured: boolean): LaunchOffer {
  const remaining = Math.max(0, limit - payingCustomers);
  return { active: configured && remaining > 0, payingCustomers, limit, remaining, launchPriceCents: LAUNCH_PRICE_CENTS, standardPriceCents: STANDARD_PRICE_CENTS };
}

let cached: { at: number; n: number } | null = null;

export async function payingCustomerCount(nowMs = Date.now()): Promise<number> {
  if (cached && nowMs - cached.at < 60_000) return cached.n;
  const [row] = await db
    .select({ n: count() })
    .from(businessProfilesTable)
    .where(and(eq(businessProfilesTable.subscriptionStatus, "active"), or(isNotNull(businessProfilesTable.stripeCustomerId), eq(businessProfilesTable.subscriptionProvider, "play")), inArray(businessProfilesTable.subscriptionPlan, ["monthly_starter", "monthly_pro", "monthly_business", "monthly_elite"])));
  cached = { at: nowMs, n: Number(row?.n ?? 0) };
  return cached.n;
}

export function forgetPayingCount(): void {
  cached = null;
}

export async function currentLaunchOffer(): Promise<LaunchOffer> {
  return launchOfferFor(await payingCustomerCount(), launchCustomerLimit(), launchStarterPriceId() !== null);
}
