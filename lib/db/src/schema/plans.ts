// Single source of truth for which subscription tier unlocks which product
// feature. Route handlers call `hasFeature(profile, "contracts")` instead of
// hand-rolling `plan === "monthly_pro" || plan === "monthly_elite"` checks.
// The frontend keeps a mirror in src/lib/plans.ts (it does not import this
// package because of the pg dependency).

export const PLAN_IDS = ["free", "monthly_starter", "monthly_pro", "monthly_elite"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PRODUCT_FEATURES = [
  "quotes", // create + download quotes
  "quote_email", // email quotes with an accept link
  "acceptance_notifications", // be notified when a customer accepts
  "catalog", // price catalog
  "contracts", // Phase 1: contracts + e-signature
  "jobs", // Phase 2: job sites, milestones, change orders
  "costs", // Phase 3: cost tracking + receipt AI
  "invoicing", // Phase 4
  "team_time", // Phase 3: workers, time entries, equipment
  "assistant", // Phase 5: job AI assistant
  "analytics_pro", // Phase 5: margin / AR / cash flow
  "team_accounts", // Phase 7: multi-user team accounts (invite logins, roles)
] as const;
export type ProductFeature = (typeof PRODUCT_FEATURES)[number];

const STARTER: ProductFeature[] = ["quotes", "quote_email", "acceptance_notifications"];
const PRO: ProductFeature[] = [...STARTER, "catalog", "contracts", "jobs", "costs", "invoicing", "team_accounts"];
const ELITE: ProductFeature[] = [...PRO, "team_time", "assistant", "analytics_pro"];

/** Seats included in each plan's base price (Phase 7 §3.5) — extra seats are a plan add-on, enforced at invite time. */
export const SEATS_INCLUDED: Record<PlanId, number> = {
  free: 1,
  monthly_starter: 1,
  monthly_pro: 2,
  monthly_elite: 5,
};

export function seatsIncluded(plan: PlanId): number {
  return SEATS_INCLUDED[plan];
}

export const PLAN_FEATURES: Record<PlanId, ReadonlySet<ProductFeature>> = {
  free: new Set<ProductFeature>(["quotes"]),
  monthly_starter: new Set(STARTER),
  monthly_pro: new Set(PRO),
  monthly_elite: new Set(ELITE),
};

export type PlanLike = {
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  featureFlags?: Record<string, boolean> | null;
} | null | undefined;

export function effectivePlan(profile: PlanLike): PlanId {
  const active = profile?.subscriptionStatus === "active" || profile?.subscriptionStatus === "trialing";
  const plan = profile?.subscriptionPlan;
  if (active && (PLAN_IDS as readonly string[]).includes(plan ?? "")) return plan as PlanId;
  return "free";
}

/**
 * Feature flags on the profile override the plan in both directions:
 * `{ contracts: true }` grants early access, `{ contracts: false }` kills it.
 */
export function hasFeature(profile: PlanLike, feature: ProductFeature): boolean {
  const override = profile?.featureFlags?.[feature];
  if (typeof override === "boolean") return override;
  return PLAN_FEATURES[effectivePlan(profile)].has(feature);
}

export function minimumPlanFor(feature: ProductFeature): PlanId {
  for (const plan of PLAN_IDS) if (PLAN_FEATURES[plan].has(feature)) return plan;
  return "monthly_elite";
}
