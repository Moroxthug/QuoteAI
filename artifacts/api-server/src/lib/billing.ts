// Phase 73 (docs/PILOT-LAUNCH-PLAN.md): annual billing + the Stripe Connect
// application fee. Pure config/maths — no Stripe calls — so it is unit-testable
// (tests stub process.env) and the routes stay thin.

export type BillingInterval = "month" | "year";
export type SubscriptionTier = "monthly_starter" | "monthly_pro" | "monthly_elite";

/** Annual = 10 × monthly ("2 months free"). */
const ANNUAL_MONTHS_CHARGED = 10;

/**
 * Yearly Stripe prices are created once per Stripe account by
 * `pnpm --filter @workspace/scripts stripe-annual-prices` (owner track O9)
 * and pasted into these env vars. Missing = annual billing is honestly
 * "coming soon" in the UI rather than a broken checkout.
 */
function yearlyPriceIds(): Record<SubscriptionTier, string | undefined> {
  return {
    monthly_starter: process.env.STRIPE_PRICE_YEARLY_STARTER,
    monthly_pro: process.env.STRIPE_PRICE_YEARLY_PRO,
    monthly_elite: process.env.STRIPE_PRICE_YEARLY_ELITE,
  };
}

export function yearlyPriceIdFor(tier: SubscriptionTier): string | null {
  const v = yearlyPriceIds()[tier]?.trim();
  return v && v.length > 0 ? v : null;
}

export function annualBillingAvailable(): boolean {
  const ids = yearlyPriceIds();
  return (Object.keys(ids) as SubscriptionTier[]).every((t) => yearlyPriceIdFor(t) !== null);
}

export function yearlyPriceFor(monthlyPrice: number): number {
  return monthlyPrice * ANNUAL_MONTHS_CHARGED;
}

/** Maps any known Stripe price id (monthly or yearly) back to { tier, interval }. */
export function resolvePrice(
  priceId: string | undefined | null,
  monthlyPriceToTier: Record<string, string>,
): { tier: SubscriptionTier; interval: BillingInterval } | null {
  if (!priceId) return null;
  const yearly = yearlyPriceIds();
  for (const tier of Object.keys(yearly) as SubscriptionTier[]) {
    if (yearlyPriceIdFor(tier) === priceId) return { tier, interval: "year" };
  }
  const tier = monthlyPriceToTier[priceId];
  if (tier === "monthly_starter" || tier === "monthly_pro" || tier === "monthly_elite") return { tier, interval: "month" };
  return null;
}

export function isBillingInterval(v: unknown): v is BillingInterval {
  return v === "month" || v === "year";
}

// ── Stripe Connect application fee ───────────────────────────────────────────
// Charged on every card payment collected through a contractor's connected
// account, in basis points. 50 = 0.5 %. Shown on the contractor's "Get paid
// online" card; Stripe's own processing fee is separate and theirs.

const DEFAULT_CONNECT_FEE_BPS = 50;
const MAX_CONNECT_FEE_BPS = 500; // 5 % — a typo in the env var must not eat a contractor's invoice

export function connectFeeBps(): number {
  const raw = process.env.STRIPE_CONNECT_FEE_BPS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_CONNECT_FEE_BPS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_CONNECT_FEE_BPS;
  return Math.min(Math.round(n), MAX_CONNECT_FEE_BPS);
}

/** e.g. 50 bps → "0.5" (for "QuoteAI keeps 0.5 % of each card payment"). */
export function connectFeePercentLabel(bps: number = connectFeeBps()): string {
  return (bps / 100).toFixed(bps % 100 === 0 ? 0 : bps % 10 === 0 ? 1 : 2);
}

/** Fee in cents on a charge of `amountCents`, rounded half-up, never above the charge. */
export function applicationFeeCents(amountCents: number, bps: number = connectFeeBps()): number {
  if (amountCents <= 0 || bps <= 0) return 0;
  return Math.min(amountCents, Math.round((amountCents * bps) / 10000));
}
