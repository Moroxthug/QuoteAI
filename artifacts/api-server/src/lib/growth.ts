import { eq } from "drizzle-orm";
import { db, billingEventsTable, businessProfilesTable, growthEventsTable, signupAttributionTable, type BillingEventType } from "@workspace/db";
import { logger } from "./logger.js";

// Growth and owner analytics (docs/GROWTH-PLAN.md, Phase 131): where people come from, what they do before and after signing up, and the real money.

// ── Channels ──────────────────────────────────────────────────────────────────

/** The channels the owner sees in the HQ. Anything unknown stays what it was called (lower-cased, short) so a new campaign still shows up. */
const CHANNELS: Array<[RegExp, string]> = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)(bing|duckduckgo|yahoo)\./, "search_other"],
  [/(^|\.)(facebook|fb|m\.facebook|l\.facebook)\.com$|^facebook$|^fb$/, "facebook"],
  [/(^|\.)instagram\.com$|^instagram$|^ig$/, "instagram"],
  [/(^|\.)(linkedin|lnkd)\./, "linkedin"],
  [/(^|\.)(youtube|youtu)\./, "youtube"],
  [/(^|\.)(reddit)\./, "reddit"],
  [/(^|\.)(tiktok)\./, "tiktok"],
  [/^play$|^play_store$|play\.google\.com/, "play_store"],
];

const clean = (v: unknown, max = 120): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
};

const hostOf = (referrer: string | null): string | null => {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return referrer.toLowerCase();
  }
};

export type AttributionInput = {
  source?: unknown;
  medium?: unknown;
  campaign?: unknown;
  referrer?: unknown;
  landingPath?: unknown;
  platform?: unknown;
  referralCode?: unknown;
};

export type Attribution = { source: string; medium: string | null; campaign: string | null; referrer: string | null; landingPath: string | null; platform: "web" | "android" | "ios"; referralCode: string | null };

/** One channel name for a sign-up: a referral code wins, then utm_source, then the referrer's site, else direct. */
export function normalizeAttribution(input: AttributionInput, ownHost = "quoteai.ca"): Attribution {
  const utm = clean(input.source, 60)?.toLowerCase() ?? null;
  const referrer = clean(input.referrer, 300);
  const host = hostOf(referrer);
  const referralCode = clean(input.referralCode, 40);
  let source = "direct";
  if (referralCode) source = "referral";
  else if (utm) source = CHANNELS.find(([re]) => re.test(utm))?.[1] ?? utm.replace(/[^a-z0-9_-]+/g, "_").slice(0, 40);
  else if (host && !host.endsWith(ownHost)) source = CHANNELS.find(([re]) => re.test(host))?.[1] ?? "referral_site";
  const p = input.platform === "android" || input.platform === "ios" ? input.platform : "web";
  return { source, medium: clean(input.medium, 60), campaign: clean(input.campaign, 80), referrer, landingPath: clean(input.landingPath, 200), platform: p, referralCode };
}

/** Written once, the first time: a later visit with different tags must not rewrite where someone came from. */
export async function recordAttribution(userId: string, input: AttributionInput): Promise<Attribution> {
  const a = normalizeAttribution(input);
  await db.insert(signupAttributionTable).values({ userId, ...a }).onConflictDoNothing({ target: signupAttributionTable.userId });
  return a;
}

// ── Events ────────────────────────────────────────────────────────────────────

/** The events the apps and the website may report. A fixed list keeps the table clean and stops anyone filling it with junk. */
export const TRACKED_EVENTS = [
  "landing_view", "signup_started", "signup_completed", "app_install", "app_open", "paywall_view", "checkout_started", "quote_tool_used",
  "referral_link_opened", "outreach_link_opened", "email_opened", "email_clicked",
] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];
export const isTrackedEvent = (e: unknown): e is TrackedEvent => typeof e === "string" && (TRACKED_EVENTS as readonly string[]).includes(e);

/** Never throws and never waits for the caller: analytics must not slow down or break the product. */
export function trackGrowth(e: { event: string; userId?: string | null; anonId?: string | null; source?: string | null; platform?: string | null; props?: Record<string, unknown> }): void {
  const props = JSON.stringify(e.props ?? {}).length > 2000 ? {} : (e.props ?? {});
  void db.insert(growthEventsTable).values({ event: e.event.slice(0, 60), userId: e.userId ?? null, anonId: clean(e.anonId, 80), source: clean(e.source, 60), platform: clean(e.platform, 20), props })
    .catch((err) => logger.warn({ err, event: e.event }, "growth event not saved"));
}

// ── Money ─────────────────────────────────────────────────────────────────────

type StripeLine = { price?: { id?: string; unit_amount?: number | null; recurring?: { interval?: string; interval_count?: number } | null; metadata?: Record<string, string> | null } | null; quantity?: number | null };
type StripeObject = Record<string, unknown> & { id?: string; customer?: string | null };
export type StripeEventLike = { id: string; type: string; created?: number; data: { object: StripeObject } };

export type BillingRow = {
  providerEventId: string; type: BillingEventType; customerId: string | null; plan: string | null; interval: string | null;
  amountCents: number; taxCents: number; feeCents: number; currency: string; founding: number; at: Date;
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0);
const taxOf = (o: StripeObject): number => {
  const a = o.total_taxes as Array<{ amount?: number }> | undefined;
  if (Array.isArray(a)) return a.reduce((n, t) => n + num(t.amount), 0);
  const b = o.total_tax_amounts as Array<{ amount?: number }> | undefined;
  if (Array.isArray(b)) return b.reduce((n, t) => n + num(t.amount), 0);
  return num(o.tax);
};

/** A subscription line's monthly money: yearly prices count as a twelfth, so MRR is comparable across intervals. */
export function monthlyCents(line: StripeLine | undefined): number {
  const unit = num(line?.price?.unit_amount) * Math.max(1, num(line?.quantity) || 1);
  const r = line?.price?.recurring;
  const every = Math.max(1, num(r?.interval_count) || 1);
  const months = r?.interval === "year" ? 12 * every : r?.interval === "week" ? 0.230137 * every : r?.interval === "day" ? 0.0328767 * every : every;
  return Math.round(unit / months);
}

/** What one Stripe event means for the books. Pure, so it can be tested without Stripe; `plan`/`interval` are resolved by the caller (they depend on the env's price ids). */
export function billingRowFromStripeEvent(event: StripeEventLike): BillingRow | null {
  const o = event.data.object;
  const at = new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000);
  const customerId = typeof o.customer === "string" ? o.customer : null;
  const base = { providerEventId: event.id, customerId, plan: null, interval: null, taxCents: 0, feeCents: 0, founding: 0, at };
  const lines = ((o.lines as { data?: StripeLine[] } | undefined)?.data ?? (o.items as { data?: StripeLine[] } | undefined)?.data) as StripeLine[] | undefined;
  const line = lines?.[0];
  const founding = line?.price?.metadata?.quoteai_launch === "1" ? 1 : 0;
  switch (event.type) {
    case "invoice.paid":
      return { ...base, type: "payment", amountCents: num(o.amount_paid), taxCents: taxOf(o), currency: String(o.currency ?? "cad"), founding };
    case "charge.refunded":
      return { ...base, type: "refund", amountCents: num(o.amount_refunded), currency: String(o.currency ?? "cad") };
    case "charge.dispute.created":
      return { ...base, type: "dispute", amountCents: num(o.amount), currency: String(o.currency ?? "cad") };
    case "customer.subscription.created":
      return { ...base, type: "subscription_started", amountCents: monthlyCents(line), currency: String(o.currency ?? "cad"), founding };
    case "customer.subscription.updated":
      return { ...base, type: "subscription_changed", amountCents: monthlyCents(line), currency: String(o.currency ?? "cad"), founding };
    case "customer.subscription.deleted":
      return { ...base, type: "subscription_canceled", amountCents: monthlyCents(line), currency: String(o.currency ?? "cad"), founding };
    default:
      return null;
  }
}

/** Saves the event once (a replayed webhook is ignored) with the company it belongs to. Never throws: the books must not break a subscription. */
export async function recordStripeBillingEvent(event: StripeEventLike, resolved?: { plan: string | null; interval: string | null }): Promise<void> {
  try {
    const row = billingRowFromStripeEvent(event);
    if (!row) return;
    let userId: string | null = null;
    if (row.customerId) {
      const [p] = await db.select({ userId: businessProfilesTable.userId }).from(businessProfilesTable).where(eq(businessProfilesTable.stripeCustomerId, row.customerId));
      userId = p?.userId ?? null;
    }
    await db.insert(billingEventsTable).values({ provider: "stripe", ...row, plan: resolved?.plan ?? row.plan, interval: resolved?.interval ?? row.interval, userId, raw: { type: event.type } })
      .onConflictDoNothing({ target: [billingEventsTable.provider, billingEventsTable.providerEventId] });
  } catch (err) {
    logger.warn({ err, eventId: event.id }, "billing event not saved");
  }
}
