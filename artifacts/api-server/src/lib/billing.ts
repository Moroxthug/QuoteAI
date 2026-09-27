// Phase 73 (docs/PILOT-LAUNCH-PLAN.md): annual billing + the Stripe Connect
// application fee. Pure config/maths — no Stripe calls — so it is unit-testable
// (tests stub process.env) and the routes stay thin.
//
// Phase 99 (2026-09-26): every Stripe price id comes from the environment.
// They used to be hard-coded in routes/payments.ts and belonged to a Stripe
// account the business no longer had, so checkout failed. The whole catalog is
// created by `pnpm --filter @workspace/scripts stripe-catalog [-- --live]`,
// which prints these variables.

export type BillingInterval = "month" | "year";
export type SubscriptionTier = "monthly_starter" | "monthly_pro" | "monthly_business" | "monthly_elite";
/** The plans with a published price and a checkout. Elite is custom: sold by the owner, one price per customer. */
export type SelfServeTier = Exclude<SubscriptionTier, "monthly_elite">;
export type OneShotPlan = "oneshot_watermark" | "oneshot_clean";

export const SUBSCRIPTION_TIERS: readonly SubscriptionTier[] = ["monthly_starter", "monthly_pro", "monthly_business", "monthly_elite"];
export const SELF_SERVE_TIERS: readonly SelfServeTier[] = ["monthly_starter", "monthly_pro", "monthly_business"];

export function isSubscriptionTier(id: unknown): id is SubscriptionTier {
  return typeof id === "string" && (SUBSCRIPTION_TIERS as readonly string[]).includes(id);
}
export function isSelfServeTier(id: unknown): id is SelfServeTier {
  return typeof id === "string" && (SELF_SERVE_TIERS as readonly string[]).includes(id);
}

/** Annual = 10 × monthly ("2 months free"). */
const ANNUAL_MONTHS_CHARGED = 10;

const clean = (v: string | undefined): string | null => {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
};

// Spelled out (not built from a prefix) so env:inventory can see every variable read.
function monthlyPriceIds(): Record<SelfServeTier | OneShotPlan, string | undefined> {
  return {
    monthly_starter: process.env.STRIPE_PRICE_STARTER,
    monthly_pro: process.env.STRIPE_PRICE_PRO,
    monthly_business: process.env.STRIPE_PRICE_BUSINESS,
    oneshot_watermark: process.env.STRIPE_PRICE_ONESHOT_WATERMARK,
    oneshot_clean: process.env.STRIPE_PRICE_ONESHOT_CLEAN,
  };
}

function yearlyPriceIds(): Record<SelfServeTier, string | undefined> {
  return {
    monthly_starter: process.env.STRIPE_PRICE_YEARLY_STARTER,
    monthly_pro: process.env.STRIPE_PRICE_YEARLY_PRO,
    monthly_business: process.env.STRIPE_PRICE_YEARLY_BUSINESS,
  };
}

/** The monthly (or one-off) Stripe price for a plan; null = not configured on this deployment (or Elite). */
export function planPriceIdFor(planId: string): string | null {
  return clean((monthlyPriceIds() as Record<string, string | undefined>)[planId]);
}

export function yearlyPriceIdFor(tier: SubscriptionTier): string | null {
  return isSelfServeTier(tier) ? clean(yearlyPriceIds()[tier]) : null;
}

export function annualBillingAvailable(): boolean {
  return SELF_SERVE_TIERS.every((t) => yearlyPriceIdFor(t) !== null);
}

export function yearlyPriceFor(monthlyPrice: number): number {
  return monthlyPrice * ANNUAL_MONTHS_CHARGED;
}

type PriceLike = { id?: string | null; metadata?: Record<string, string> | null; recurring?: { interval?: string | null } | null } | string | null | undefined;

/**
 * Maps a Stripe price (monthly or yearly) back to { tier, interval }: first the
 * configured ids, then the price's `quoteai_plan` metadata — how a custom Elite
 * price made for one customer in the dashboard unlocks Elite.
 */
export function resolvePrice(price: PriceLike): { tier: SubscriptionTier; interval: BillingInterval } | null {
  if (!price) return null;
  const id = typeof price === "string" ? price : price.id;
  if (id) {
    for (const tier of SELF_SERVE_TIERS) {
      if (yearlyPriceIdFor(tier) === id) return { tier, interval: "year" };
      if (planPriceIdFor(tier) === id) return { tier, interval: "month" };
    }
  }
  if (typeof price !== "string") {
    const tagged = price.metadata?.quoteai_plan;
    if (isSubscriptionTier(tagged)) return { tier: tagged, interval: price.recurring?.interval === "year" ? "year" : "month" };
  }
  return null;
}

/** Any known price id → plan id, including the one-off quotes (admin tools). */
export function planForPrice(price: PriceLike): string | null {
  const sub = resolvePrice(price);
  if (sub) return sub.tier;
  const id = typeof price === "string" ? price : price?.id;
  if (!id) return null;
  for (const p of ["oneshot_watermark", "oneshot_clean"] as const) if (planPriceIdFor(p) === id) return p;
  return null;
}

// ── Phase 90/91: subscription add-ons ───────────────────────────────────────
// Two add-ons ride on a company's own subscription as extra items:
//  - group_company: each company a group's paying company covers (Phase 90)
//  - extra_seat: each login beyond the plan's included seats (Phase 91)
// Prices are created once per Stripe mode by `pnpm --filter @workspace/scripts
// stripe-catalog` (owner track), one per interval because a subscription
// cannot mix monthly and yearly items. Missing = the add-on is honestly
// unavailable in the UI instead of a broken checkout.

export type AddonKind = "group_company" | "extra_seat";

/** What the add-ons cost per month (CAD cents) — for display only; must match scripts/src/stripe-catalog.ts. */
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
