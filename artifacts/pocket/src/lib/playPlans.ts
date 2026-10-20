// Google Play Billing on Android (Phase 135): the pure parts. Which plans to show, which base plan, how server answers map to what the person sees.
// The server decides what a purchase is worth (docs/GROWTH-PLAN.md "Play Billing contract"); nothing here knows a price. Prices are Google Play strings.
export type Tier = "starter" | "pro" | "business";
export type Interval = "month" | "year";

/** GET /api/billing/play/catalog */
export type PlayCatalog = {
  products: { productId: string; basePlanId: string; tier: Tier; interval: Interval; founding: boolean }[];
  launchActive: boolean;
  /** Present only if the server one day says how many founding places are left; nothing is shown without it. */
  launchSpotsLeft?: number | null;
  current: { provider: "stripe" | "play" | null; plan: string | null; status: string | null; expiresAt: string | null; autoRenewing: boolean | null };
};

/** One purchasable base plan as Google Play describes it. `price` is the formatted string from Play ("$29.00"). */
export type PlayOfferDetails = { productId: string; basePlanId: string; offerToken: string; price: string };

export type PlanOffer = { tier: Tier; interval: Interval; founding: boolean; productId: string; basePlanId: string; offerToken: string; price: string };

export const TIERS: Tier[] = ["starter", "pro", "business"];
export const PLAY_SUBSCRIPTIONS_URL = "https://play.google.com/store/account/subscriptions";

export const productIds = (c: PlayCatalog): string[] => [...new Set(c.products.map((p) => p.productId))];

/**
 * One offer per tier for the chosen interval. The founding `launch` base plan (monthly) replaces Starter's normal monthly price while the server says it is active;
 * it never shows when the server's catalog does not list it. A plan Google Play did not return (no price) is left out: never a price we made up.
 */
export function offersFor(catalog: PlayCatalog, details: PlayOfferDetails[], interval: Interval): PlanOffer[] {
  const out: PlanOffer[] = [];
  for (const tier of TIERS) {
    const rows = catalog.products.filter((p) => p.tier === tier && p.interval === interval);
    const pick = (catalog.launchActive ? rows.find((r) => r.founding) : undefined) ?? rows.find((r) => !r.founding);
    if (!pick) continue;
    const d = details.find((x) => x.productId === pick.productId && x.basePlanId === pick.basePlanId);
    if (!d || !d.price || !d.offerToken) continue;
    out.push({ tier, interval, founding: pick.founding, productId: pick.productId, basePlanId: pick.basePlanId, offerToken: d.offerToken, price: d.price });
  }
  return out;
}

/** Whether a year choice exists at all (the toggle is hidden otherwise). */
export const hasInterval = (catalog: PlayCatalog, interval: Interval): boolean => catalog.products.some((p) => p.interval === interval && !p.founding);

const ENDED = new Set(["expired", "canceled", "cancelled", "refunded", "revoked", "none", "inactive"]);
/** A Play subscription that still counts (active, in grace, on hold, cancelled but not yet ended): it is changed in Google Play, not bought again here. */
export function isPlaySubscriber(c: PlayCatalog | null | undefined): boolean {
  const cur = c?.current;
  if (!cur || cur.provider !== "play") return false;
  if (cur.status && ENDED.has(cur.status.toLowerCase())) return false;
  return true;
}
/** A Stripe subscriber is managed on the website. The server also refuses a Play purchase (ALREADY_STRIPE_SUBSCRIBER). */
export const isStripeSubscriber = (c: PlayCatalog | null | undefined): boolean => c?.current?.provider === "stripe" && !(c.current.status && ENDED.has(c.current.status.toLowerCase()));

/** The wording key for a price's term, under `pp.term`. */
export const termKey = (o: { interval: Interval; founding: boolean }): "founding" | "month" | "year" => (o.founding ? "founding" : o.interval === "year" ? "year" : "month");

export type ErrorKind = "pending" | "stripe" | "invalid" | "unavailable" | "offline" | "generic";
/** The server `code` (or no signal) as the state the person sees. PURCHASE_PENDING is a wait, not a failure. */
export function errorKind(status: number, code: string | undefined): ErrorKind {
  if (status === 0) return "offline";
  if (code === "PURCHASE_PENDING") return "pending";
  if (code === "ALREADY_STRIPE_SUBSCRIBER") return "stripe";
  if (code === "PURCHASE_NOT_VALID") return "invalid";
  if (code === "PLAY_NOT_CONFIGURED") return "unavailable";
  return "generic";
}

/** The base plan own offer among a product offers: the one without a promotional offer id, else the one with the fewest pricing phases. The price is the last (regular) phase. */
export type RawOffer = { basePlanId?: string | null; offerId?: string | null; offerToken?: string | null; phases?: { formattedPrice: string }[] | null; displayPrice?: string | null };
export function baseOffer(offers: RawOffer[], basePlanId: string): { offerToken: string; price: string } | null {
  const mine = offers.filter((o) => o.basePlanId === basePlanId && o.offerToken);
  if (!mine.length) return null;
  const plain = mine.find((o) => !o.offerId || o.offerId === basePlanId) ?? [...mine].sort((a, b) => (a.phases?.length ?? 9) - (b.phases?.length ?? 9))[0]!;
  const price = plain.phases?.length ? plain.phases[plain.phases.length - 1]!.formattedPrice : (plain.displayPrice ?? "");
  return price ? { offerToken: plain.offerToken!, price } : null;
}

/** The tier in a plan key ("monthly_pro", "yearly_business"), or null when it is not one of the three. */
export function tierOfPlan(plan: string | null | undefined): Tier | null {
  const p = (plan ?? "").toLowerCase();
  return TIERS.find((t) => p.includes(t)) ?? null;
}
