// Mirror of lib/db/src/schema/plans.ts — keep the two in sync. The server
// is the authority (it returns `features` on /api/business-profile); this
// copy only exists so the UI can gate before the profile has loaded.

export const PLAN_IDS = ["free", "monthly_starter", "monthly_pro", "monthly_elite"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type ProductFeature =
  | "quotes"
  | "quote_email"
  | "acceptance_notifications"
  | "catalog"
  | "contracts"
  | "jobs"
  | "costs"
  | "invoicing"
  | "team_time"
  | "assistant"
  | "analytics_pro"
  | "team_accounts";

const STARTER: ProductFeature[] = ["quotes", "quote_email", "acceptance_notifications"];
const PRO: ProductFeature[] = [...STARTER, "catalog", "contracts", "jobs", "costs", "invoicing", "team_accounts"];
const ELITE: ProductFeature[] = [...PRO, "team_time", "assistant", "analytics_pro"];

export const SEATS_INCLUDED: Record<PlanId, number> = {
  free: 1,
  monthly_starter: 1,
  monthly_pro: 2,
  monthly_elite: 5,
};

export const PLAN_FEATURES: Record<PlanId, ReadonlySet<ProductFeature>> = {
  free: new Set<ProductFeature>(["quotes"]),
  monthly_starter: new Set(STARTER),
  monthly_pro: new Set(PRO),
  monthly_elite: new Set(ELITE),
};

export type ProfileLike = {
  plan?: string | null;
  features?: Record<string, boolean> | null;
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
} | null | undefined;

/** Prefer the server-computed `features` map; fall back to the plan table. */
export function hasFeature(profile: ProfileLike, feature: ProductFeature): boolean {
  const fromServer = profile?.features?.[feature];
  if (typeof fromServer === "boolean") return fromServer;
  const plan = (profile?.plan ?? profile?.subscriptionPlan ?? "free") as PlanId;
  return (PLAN_FEATURES[plan] ?? PLAN_FEATURES.free).has(feature);
}

export function minimumPlanFor(feature: ProductFeature): PlanId {
  for (const plan of PLAN_IDS) if (PLAN_FEATURES[plan].has(feature)) return plan;
  return "monthly_elite";
}
