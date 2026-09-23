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

// ── Phase 90/91: subscription add-ons ───────────────────────────────────────
// Two add-ons ride on a company's own subscription as extra items:
//  - group_company: each company a group's paying company covers (Phase 90)
//  - extra_seat: each login beyond the plan's included seats (Phase 91)
// Prices are created once per Stripe mode by `pnpm --filter @workspace/scripts
// stripe-addon-prices` (owner track), one per interval because a subscription
// cannot mix monthly and yearly items. Missing = the add-on is honestly
// unavailable in the UI instead of a broken checkout.

export type AddonKind = "group_company" | "extra_seat";

/** What the add-ons cost per month (CAD cents) — for display only; must match scripts/src/stripe-addon-prices.ts. */
export const ADDON_MONTHLY_CENTS: Record<AddonKind, number> = { group_company: 2900, extra_seat: 1500 };
// Spelled out (not built from a prefix) so env:inventory can see every variable read.
const ADDON_PRICE_ENV: Record<AddonKind, Record<BillingInterval, () => string | undefined>> = {
  group_company: { month: () => process.env.STRIPE_PRICE_GROUP_COMPANY, year: () => process.env.STRIPE_PRICE_GROUP_COMPANY_YEARLY },
  extra_seat: { month: () => process.env.STRIPE_PRICE_EXTRA_SEAT, year: () => process.env.STRIPE_PRICE_EXTRA_SEAT_YEARLY },
};

export function addonPriceIdFor(kind: AddonKind, interval: BillingInterval): string | null {
  const v = ADDON_PRICE_ENV[kind][interval]()?.trim();
  return v && v.length > 0 ? v : null;
}

function addonPriceIds(kind?: AddonKind): string[] {
  const kinds: AddonKind[] = kind ? [kind] : ["group_company", "extra_seat"];
  return kinds.flatMap((k) => [addonPriceIdFor(k, "month"), addonPriceIdFor(k, "year")]).filter((x): x is string => !!x);
}

/** The subscription item that carries the plan (not an add-on). */
export function planItemOf<T extends { price?: { id?: string } | null }>(items: readonly T[]): T | undefined {
  const extra = new Set(addonPriceIds());
  return items.find((i) => !extra.has(i.price?.id ?? "")) ?? items[0];
}

/** How many units of an add-on a subscription carries. */
export function addonQuantityOf(items: readonly { price?: { id?: string } | null; quantity?: number | null }[], kind: AddonKind): number {
  const ids = new Set(addonPriceIds(kind));
  return items.filter((i) => ids.has(i.price?.id ?? "")).reduce((n, i) => n + (i.quantity ?? 1), 0);
}

export function isBillingInterval(v: unknown): v is BillingInterval {
  return v === "month" || v === "year";
}

// ── Pilot programme promo code (Phase 81) ────────────────────────────────────
// The BC/ON/QC pilot is sold with one Stripe promotion code, created by the
// owner in the Stripe dashboard and named here. The marketing page shows it,
// and Checkout applies it automatically when the visitor arrived through that
// page, so nobody has to remember to paste it into the coupon box.
//
// Unset = there is no pilot offer on this deployment: /pilot says so and
// Checkout falls back to Stripe's own "have a promo code?" field. The server
// only ever honours *this* code — a code sent by a client that does not match
// it is ignored rather than looked up, so the endpoint cannot be used to
// enumerate an account's coupons.

export function pilotPromoCode(): string | null {
  const v = process.env.PILOT_PROMO_CODE?.trim();
  return v && v.length > 0 ? v : null;
}

export function isPilotPromoCode(submitted: unknown): boolean {
  const configured = pilotPromoCode();
  if (!configured || typeof submitted !== "string") return false;
  return submitted.trim().toUpperCase() === configured.toUpperCase();
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
