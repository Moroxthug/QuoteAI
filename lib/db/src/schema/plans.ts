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
  "quickbooks_sync", // Phase 11: one-way sync of paid invoices/confirmed costs to QuickBooks Online
  "calendar_sync", // Phase 12: one-way push of job milestones to Google Calendar / Outlook
  "invoice_card_payments", // Phase 15: online card/ACH payment on invoices via the company's own Stripe Connect account
  "financeit", // Phase 16: point-of-sale financing on quotes via Financeit's hosted application flow
  "public_api", // Phase 19: versioned public API (API keys + webhooks) for Zapier/Make and direct integrations
  "gmail_send", // Phase 20: send customer-facing emails from the company's own connected Gmail account
  "wave_sync", // Phase 25: one-way sync of paid invoices/confirmed costs to Wave accounting
  "flinks_bank_feed", // Phase 27: bank-feed reconciliation via Flinks (auto-match bank transactions to cost entries)
  "meta_lead_ads", // Phase 28: import Facebook/Instagram Lead Ads submissions straight into the leads pipeline
  "multi_entity", // Phase 90: company groups — consolidated view, shared catalog, crew on both payrolls, one bill
  "google_lsa", // Phase 29: import Google Local Services Ads leads straight into the leads pipeline (engineering track, gated on Google developer-token approval)
] as const;
export type ProductFeature = (typeof PRODUCT_FEATURES)[number];

const STARTER: ProductFeature[] = ["quotes", "quote_email", "acceptance_notifications"];
const PRO: ProductFeature[] = [...STARTER, "catalog", "contracts", "jobs", "costs", "invoicing", "team_accounts"];
const ELITE: ProductFeature[] = [...PRO, "team_time", "assistant", "analytics_pro", "quickbooks_sync", "calendar_sync", "invoice_card_payments", "financeit", "public_api", "gmail_send", "wave_sync", "flinks_bank_feed", "meta_lead_ads", "google_lsa", "multi_entity"];

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

/**
 * Monthly allowance for the two metered, cost-bearing features (Phase 8 §3.5/§4a)
 * — receipt AI (gpt-4o vision) scans, WhatsApp outbound sends and (Phase 74)
 * SMS segments through the platform's Twilio number. Everything
 * else (quotes, contracts, invoicing, PDFs) has no real marginal cost and
 * stays unmetered. `null` = unlimited. Usage past the allowance is currently
 * observability-only (surfaced in the Settings usage panel) — hard overage
 * billing is not wired up yet.
 */
export const MONTHLY_USAGE_ALLOWANCE: Record<PlanId, { receiptScans: number | null; whatsappMessages: number | null; smsMessages: number | null }> = {
  free: { receiptScans: 0, whatsappMessages: 0, smsMessages: 0 },
  monthly_starter: { receiptScans: 20, whatsappMessages: 0, smsMessages: 50 },
  monthly_pro: { receiptScans: 100, whatsappMessages: 200, smsMessages: 300 },
  monthly_elite: { receiptScans: 300, whatsappMessages: 1000, smsMessages: 1000 },
};

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

/** Phase 91: the seats a company may fill — its plan's included seats plus the extra seats it pays for. */
export function seatLimit(profile: (PlanLike & { extraSeats?: number | null }) | null | undefined): number {
  return seatsIncluded(effectivePlan(profile)) + Math.max(0, profile?.extraSeats ?? 0);
}
