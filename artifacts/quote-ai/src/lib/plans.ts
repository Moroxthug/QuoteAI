// Mirror of lib/db/src/schema/plans.ts — keep the two in sync (the api-server
// unit test `pricing-parity.test.ts` compares them). The server is the
// authority (it returns `features` on /api/business-profile); this copy only
// exists so the UI can gate before the profile has loaded, and so the pricing
// page answers from the same table the server gates on.

export const PLAN_IDS = ["free", "monthly_starter", "monthly_pro", "monthly_business", "monthly_elite"] as const;
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
  | "team_accounts"
  | "quickbooks_sync"
  | "calendar_sync"
  | "invoice_card_payments"
  | "financeit"
  | "public_api"
  | "gmail_send"
  | "wave_sync"
  | "flinks_bank_feed"
  | "meta_lead_ads"
  | "multi_entity"
  | "google_lsa";

const STARTER: ProductFeature[] = ["quotes", "quote_email", "acceptance_notifications"];
const PRO: ProductFeature[] = [...STARTER, "catalog", "contracts", "jobs", "costs", "invoicing", "team_accounts"];
const BUSINESS: ProductFeature[] = [...PRO, "team_time", "assistant", "analytics_pro", "quickbooks_sync", "calendar_sync", "invoice_card_payments", "gmail_send", "wave_sync"];
const ELITE: ProductFeature[] = [...BUSINESS, "financeit", "public_api", "flinks_bank_feed", "meta_lead_ads", "google_lsa", "multi_entity"];

export const SEATS_INCLUDED: Record<PlanId, number> = {
  free: 1,
  monthly_starter: 1,
  monthly_pro: 2,
  monthly_business: 5,
  monthly_elite: 10,
};

/** Jobs open at once; null = no cap. Mirror of ACTIVE_JOB_LIMIT on the server. */
export const ACTIVE_JOB_LIMIT: Record<PlanId, number | null> = {
  free: null,
  monthly_starter: null,
  monthly_pro: 3,
  monthly_business: null,
  monthly_elite: null,
};

export const PLAN_FEATURES: Record<PlanId, ReadonlySet<ProductFeature>> = {
  free: new Set<ProductFeature>(["quotes"]),
  monthly_starter: new Set(STARTER),
  monthly_pro: new Set(PRO),
  monthly_business: new Set(BUSINESS),
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
