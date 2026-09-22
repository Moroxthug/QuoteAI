import { Router } from "express";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/requirePermission";
import { getBaseUrl } from "../lib/baseUrl";
import { db, quotesTable, businessProfilesTable, authUsersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateCheckoutSessionBody } from "@workspace/api-zod";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { annualBillingAvailable, isBillingInterval, isPilotPromoCode, pilotPromoCode, resolvePrice, yearlyPriceFor, yearlyPriceIdFor, type BillingInterval, type SubscriptionTier } from "../lib/billing";
import { sendSubscriptionEmail } from "../lib/email";

const TRIAL_DAYS = 7;
const TRIAL_DOWNLOAD_LIMIT = 3;

export function getTrialStatus(profile: typeof businessProfilesTable.$inferSelect | null | undefined) {
  if (!profile?.trialStartedAt) {
    return {
      isTrialActive: false,
      trialStartedAt: null,
      trialDownloadsUsed: 0,
      trialDownloadsLimit: TRIAL_DOWNLOAD_LIMIT,
      trialDaysLeft: null,
      trialExpiresAt: null,
    };
  }
  const now = new Date();
  const started = profile.trialStartedAt;
  const expiresAt = new Date(started.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const downloadsUsed = profile.trialDownloadsUsed ?? 0;
  const isExpiredByTime = now > expiresAt;
  const isExpiredByDownloads = downloadsUsed >= TRIAL_DOWNLOAD_LIMIT;
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const isTrialActive = !isExpiredByTime && !isExpiredByDownloads;
  return {
    isTrialActive,
    trialStartedAt: started.toISOString(),
    trialDownloadsUsed: downloadsUsed,
    trialDownloadsLimit: TRIAL_DOWNLOAD_LIMIT,
    trialDaysLeft: isTrialActive ? daysLeft : 0,
    trialExpiresAt: expiresAt.toISOString(),
  };
}

const router = Router();

export const PLANS = [
  {
    id: "monthly_starter",
    stripePriceId: "price_1UEgdQEI5cvpdr6NMQIPKpao",
    name: "Starter",
    price: 19,
    currency: "cad",
    interval: "month",
    features: [
      "10 quotes per month",
      "PDF with company logo",
      "'Made with quoteai.ca' footer line",
      "Standard template included",
      "Notes upload (2 quotes/month)",
      "Voice recording (1 quote/month)",
    ],
    hasWatermark: true,
    quotaPerMonth: 10,
    tier: "starter",
  },
  {
    id: "monthly_pro",
    stripePriceId: "price_1UEgdSEI5cvpdr6Nx6dNesfl",
    name: "Pro",
    price: 49,
    currency: "cad",
    interval: "month",
    features: [
      "60 quotes per month",
      "Clean PDFs — no watermark",
      "Custom company logo",
      "All PDF templates available",
      "Notes upload (30 quotes/month)",
      "Voice recording (30 quotes/month)",
      "Priority AI generation",
    ],
    hasWatermark: false,
    quotaPerMonth: 60,
    tier: "pro",
  },
  {
    id: "monthly_elite",
    stripePriceId: "price_1UEgdVEI5cvpdr6NHbrrdO88",
    name: "Elite",
    price: 59,
    currency: "cad",
    interval: "month",
    features: [
      "Unlimited quotes",
      "Clean PDFs — no watermark",
      "Custom company logo",
      "All PDF templates available",
      "Unlimited notes upload",
      "Unlimited voice recording",
      "Maximum priority AI generation",
      "Dedicated support",
    ],
    hasWatermark: false,
    quotaPerMonth: null,
    tier: "elite",
  },
  {
    id: "oneshot_watermark",
    stripePriceId: "price_1UEgdiEI5cvpdr6NTlQf5eJK",
    name: "Single with Watermark",
    price: 5,
    currency: "cad",
    interval: null,
    features: ["1 PDF quote", "quoteai.ca footer line", "Instant download"],
    hasWatermark: true,
    quotaPerMonth: 1,
    tier: "oneshot",
  },
  {
    id: "oneshot_clean",
    stripePriceId: "price_1UEgdkEI5cvpdr6NbbRfMtsd",
    name: "Single Clean",
    price: 13,
    currency: "cad",
    interval: null,
    features: ["1 clean PDF quote", "Company logo", "No watermark", "Instant download"],
    hasWatermark: false,
    quotaPerMonth: 1,
    tier: "oneshot",
  },
];

export const PRICE_TO_PLAN = PLANS.reduce<Record<string, string>>((acc, plan) => {
  if (plan.stripePriceId) {
    acc[plan.stripePriceId] = plan.id;
  }
  return acc;
}, {});

const SUBSCRIPTION_TIERS: readonly SubscriptionTier[] = ["monthly_starter", "monthly_pro", "monthly_elite"];
const isSubscriptionTier = (id: string): id is SubscriptionTier => (SUBSCRIPTION_TIERS as readonly string[]).includes(id);

/** Phase 73: the public plan list carries the annual price (10 × monthly) and whether annual checkout is configured. */
export function publicPlans() {
  const yearly = annualBillingAvailable();
  return PLANS.map(({ stripePriceId: _priceId, ...plan }) => ({
    ...plan,
    yearlyPrice: plan.interval ? yearlyPriceFor(plan.price) : null,
    yearlyAvailable: !!plan.interval && yearly,
  }));
}

router.get("/payments/plans", (_req, res) => {
  res.json(publicPlans());
});

/**
 * Phase 81 — the BC/ON/QC pilot offer, read by the public /pilot page.
 * `enabled: false` (no PILOT_PROMO_CODE on this deployment) is a real answer:
 * the page then says the pilot intake is not open rather than showing a code
 * that would bounce at checkout.
 */
router.get("/payments/pilot", (_req, res) => {
  const code = pilotPromoCode();
  res.set("Cache-Control", "public, max-age=300");
  res.json({ enabled: code !== null, code, provinces: ["BC", "ON", "QC"] });
});

/**
 * Turns the customer-facing pilot code into the `promo_…` id Checkout wants.
 * Only the configured code is ever looked up, and a code that Stripe does not
 * recognise (typo, expired, redemption limit reached) resolves to null so the
 * session is created without a discount instead of failing — the visitor still
 * gets to Checkout, where Stripe's own promo box is waiting.
 */
async function pilotDiscount(
  stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>,
  submitted: unknown,
): Promise<{ promotion_code: string }[] | null> {
  if (!isPilotPromoCode(submitted)) return null;
  try {
    const found = await stripe.promotionCodes.list({ code: pilotPromoCode()!, active: true, limit: 1 });
    const promo = found.data[0];
    if (!promo) {
      logger.warn({ code: pilotPromoCode() }, "PILOT_PROMO_CODE is set but Stripe has no active promotion code with that code");
      return null;
    }
    return [{ promotion_code: promo.id }];
  } catch (err) {
    logger.error({ err }, "Could not resolve the pilot promotion code — continuing without a discount");
    return null;
  }
}

router.get("/payments/trial-status", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));
    res.json(getTrialStatus(profile ?? null));
  } catch (err) {
    logger.error({ err }, "Error getting trial status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments/checkout", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const parsed = CreateCheckoutSessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }

    const { quoteId, planType } = parsed.data;
    const plan = PLANS.find((p) => p.id === planType);
    if (!plan) {
      res.status(400).json({ error: "Invalid plan type" });
      return;
    }
    // Phase 73: annual cadence picks the yearly price for the same tier.
    const interval: BillingInterval = parsed.data.interval ?? "month";
    let priceId = plan.stripePriceId;
    if (interval === "year") {
      const yearlyId = isSubscriptionTier(plan.id) ? yearlyPriceIdFor(plan.id) : null;
      if (!yearlyId) {
        res.status(400).json({ error: "ANNUAL_BILLING_UNAVAILABLE", message: "Annual billing is not configured for this plan" });
        return;
      }
      priceId = yearlyId;
    }

    const stripe = await getUncachableStripeClient();

    const baseUrl = getBaseUrl();

    const successUrl = quoteId
      ? `${baseUrl}/dashboard/quotes/${quoteId}?payment=success`
      : `${baseUrl}/dashboard?payment=success`;
    const cancelUrl = quoteId
      ? `${baseUrl}/dashboard/quotes/${quoteId}?payment=cancelled`
      : `${baseUrl}/dashboard?payment=cancelled`;

    // Look up user email and existing stripeCustomerId to pre-fill checkout and avoid duplicate customers
    const [profile] = await db
      .select({ stripeCustomerId: businessProfilesTable.stripeCustomerId })
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));
    const [authUser] = await db
      .select({ email: authUsersTable.email })
      .from(authUsersTable)
      .where(eq(authUsersTable.id, userId));

    // Phase 81: Stripe refuses `allow_promotion_codes` together with an
    // applied discount, so the pilot code replaces the coupon box rather than
    // sitting next to it.
    const discounts = await pilotDiscount(stripe, parsed.data.promoCode);

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: plan.interval ? "subscription" : "payment",
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        quoteId: quoteId ?? "",
        planType,
        interval: plan.interval ? interval : "",
        hasWatermark: String(plan.hasWatermark),
        ...(discounts ? { pilotPromo: pilotPromoCode()! } : {}),
      },
    };

    // Reuse existing Stripe customer (prevents duplicate customers and ensures email match)
    if (profile?.stripeCustomerId) {
      sessionParams.customer = profile.stripeCustomerId;
    } else if (authUser?.email) {
      // Pre-fill email so the Stripe customer is created with the correct quoteai email
      sessionParams.customer_email = authUser.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (quoteId) {
      await db
        .update(quotesTable)
        .set({ status: "pending_payment", stripeSessionId: session.id })
        .where(eq(quotesTable.id, quoteId));
    }

    res.json({ url: session.url!, sessionId: session.id });
  } catch (err) {
    logger.error({ err }, "Error creating checkout session");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/payments/subscription", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    const isActive = profile?.subscriptionStatus === "active";
    const plan = PLANS.find(p => p.id === profile?.subscriptionPlan) ?? null;

    let quotaUsed: number | null = null;
    let quotaLimit: number | null = null;
    let quotaRemaining: number | null = null;
    let quotaResetDate: string | null = null;

    if (isActive && plan?.quotaPerMonth != null) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [{ count: used }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(quotesTable)
        .where(
          sql`${quotesTable.userId} = ${userId}
            AND ${quotesTable.createdAt} >= ${monthStart.toISOString()}
            AND ${quotesTable.createdAt} < ${nextMonthStart.toISOString()}`
        );

      quotaUsed = used ?? 0;
      quotaLimit = plan.quotaPerMonth;
      quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
      quotaResetDate = nextMonthStart.toISOString();
    }

    res.json({
      plan: profile?.subscriptionPlan ?? null,
      status: profile?.subscriptionStatus ?? null,
      interval: isActive ? (profile?.subscriptionInterval ?? "month") : null,
      annualAvailable: annualBillingAvailable(),
      periodEnd: profile?.subscriptionPeriodEnd?.toISOString() ?? null,
      isActive,
      quotaUsed,
      quotaLimit,
      quotaRemaining,
      quotaResetDate,
    });
  } catch (err) {
    logger.error({ err }, "Error getting subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 66: any member who can edit quotes may unlock one with the org's
// subscription (the quote page calls this on open — `settings:full` made it
// 403 for every non-owner and left their quotes un-sendable).
router.post("/payments/unlock-quote", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { quoteId } = req.body as { quoteId: string };

    if (!quoteId) {
      res.status(400).json({ error: "quoteId required" });
      return;
    }

    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    if (profile?.subscriptionStatus !== "active") {
      res.status(403).json({ error: "No active subscription" });
      return;
    }

    const [quote] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, quoteId));

    if (!quote || quote.userId !== userId) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    // Only a draft (or an abandoned one-shot checkout) is unlocked. This used
    // to be `!== "unlocked"`, which silently reverted every *accepted* quote
    // to "unlocked" the moment a subscriber opened it (Phase 66).
    if (quote.status === "draft" || quote.status === "pending_payment") {
      await db
        .update(quotesTable)
        .set({ status: "unlocked", unlockedWithPlan: profile.subscriptionPlan ?? null })
        .where(eq(quotesTable.id, quoteId));
      logger.info({ quoteId, userId, plan: profile.subscriptionPlan }, "Quote unlocked via subscription");
      res.json({ status: "unlocked" });
      return;
    }

    res.json({ status: quote.status });
  } catch (err) {
    logger.error({ err }, "Error unlocking quote with subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments/portal", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    if (!profile?.stripeCustomerId) {
      res.status(400).json({ error: "No Stripe customer found — subscribe first" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const baseUrl = getBaseUrl();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${baseUrl}/dashboard`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    logger.error({ err }, "Error creating customer portal session");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments/sync-subscription", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const stripe = await getUncachableStripeClient();

    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    let customerId = profile?.stripeCustomerId ?? null;

    if (!customerId) {
      const [authUser] = await db
        .select({ email: authUsersTable.email })
        .from(authUsersTable)
        .where(eq(authUsersTable.id, userId));
      if (authUser?.email) {
        const customers = await stripe.customers.list({ email: authUser.email, limit: 5 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }
    }

    if (!customerId) {
      res.json({ synced: false, message: "No Stripe customer found for this account" });
      return;
    }



    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 5,
    });

    if (subscriptions.data.length === 0) {
      const cancelledSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "canceled",
        limit: 1,
      });

      await db
        .insert(businessProfilesTable)
        .values({ userId, stripeCustomerId: customerId, subscriptionStatus: "cancelled", subscriptionPlan: null })
        .onConflictDoUpdate({
          target: businessProfilesTable.userId,
          set: { stripeCustomerId: customerId, subscriptionStatus: cancelledSubs.data.length > 0 ? "cancelled" : null, subscriptionPlan: null },
        });

      res.json({ synced: true, active: false, message: "No active subscription found" });
      return;
    }

    const sub = subscriptions.data[0];
    const priceId = sub.items.data[0]?.price?.id;
    const resolved = resolvePrice(priceId, PRICE_TO_PLAN);
    const planType = resolved?.tier ?? null;

    if (!planType || !resolved) {
      res.json({ synced: false, message: `Unknown price ID: ${priceId ?? "N/A"}` });
      return;
    }

    // As of Stripe SDK v22, current_period_end/start live on the individual
    // subscription item (no longer on the Subscription object): without this,
    // periodEnd always came out null and subscriptionPeriodEnd never got
    // synced correctly during a manual re-sync.
    const currentPeriodEnd = sub.items.data[0]?.current_period_end;
    const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null;

    await db
      .insert(businessProfilesTable)
      .values({
        userId,
        stripeCustomerId: customerId,
        subscriptionPlan: planType,
        subscriptionStatus: "active",
        subscriptionInterval: resolved.interval,
        subscriptionPeriodEnd: periodEnd,
      })
      .onConflictDoUpdate({
        target: businessProfilesTable.userId,
        set: {
          stripeCustomerId: customerId,
          subscriptionPlan: planType,
          subscriptionStatus: "active",
          subscriptionInterval: resolved.interval,
          subscriptionPeriodEnd: periodEnd,
        },
      });

    logger.info({ userId, planType, customerId }, "Subscription synced manually");
    res.json({ synced: true, active: true, plan: planType });
  } catch (err) {
    logger.error({ err }, "Error syncing subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 73: switch tier and/or cadence in place. An active Stripe subscription
// is updated with proration (charged or credited immediately); without one the
// caller gets a Checkout URL instead. Owner-only like /payments/checkout.
router.post("/payments/change-plan", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = (req.body ?? {}) as { planType?: unknown; interval?: unknown; promoCode?: unknown };
    const planType = typeof body.planType === "string" ? body.planType : "";
    const interval: BillingInterval = isBillingInterval(body.interval) ? body.interval : "month";
    if (!isSubscriptionTier(planType)) {
      res.status(400).json({ error: "Invalid plan type" });
      return;
    }
    const plan = PLANS.find((p) => p.id === planType)!;
    const priceId = interval === "year" ? yearlyPriceIdFor(planType) : plan.stripePriceId;
    if (!priceId) {
      res.status(400).json({ error: "ANNUAL_BILLING_UNAVAILABLE", message: "Annual billing is not configured for this plan" });
      return;
    }

    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    const stripe = await getUncachableStripeClient();

    let current: { id: string; itemId: string; priceId: string | undefined } | null = null;
    if (profile?.stripeCustomerId) {
      const subs = await stripe.subscriptions.list({ customer: profile.stripeCustomerId, status: "active", limit: 1 });
      const sub = subs.data[0];
      const item = sub?.items.data[0];
      if (sub && item) current = { id: sub.id, itemId: item.id, priceId: item.price?.id };
    }

    if (!current) {
      // No live subscription → same path as a first purchase.
      const baseUrl = getBaseUrl();
      const [authUser] = await db.select({ email: authUsersTable.email }).from(authUsersTable).where(eq(authUsersTable.id, userId));
      const discounts = await pilotDiscount(stripe, body.promoCode);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        ...(discounts ? { discounts } : { allow_promotion_codes: true }),
        success_url: `${baseUrl}/dashboard/billing?payment=success`,
        cancel_url: `${baseUrl}/dashboard/billing?payment=cancelled`,
        metadata: { userId, quoteId: "", planType, interval, hasWatermark: String(plan.hasWatermark), ...(discounts ? { pilotPromo: pilotPromoCode()! } : {}) },
        ...(profile?.stripeCustomerId ? { customer: profile.stripeCustomerId } : authUser?.email ? { customer_email: authUser.email } : {}),
      });
      res.json({ mode: "checkout", url: session.url });
      return;
    }

    if (current.priceId === priceId) {
      res.json({ mode: "unchanged", plan: planType, interval });
      return;
    }

    const updated = await stripe.subscriptions.update(current.id, {
      items: [{ id: current.itemId, price: priceId }],
      proration_behavior: "always_invoice",
      ...(interval === "year" ? { billing_cycle_anchor: "now" } : {}),
      metadata: { userId, planType, interval },
    });
    const periodEndSec = updated.items.data[0]?.current_period_end;
    await db
      .update(businessProfilesTable)
      .set({
        subscriptionPlan: planType,
        subscriptionStatus: updated.status === "active" || updated.status === "trialing" ? "active" : profile?.subscriptionStatus ?? null,
        subscriptionInterval: interval,
        subscriptionPeriodEnd: periodEndSec ? new Date(periodEndSec * 1000) : profile?.subscriptionPeriodEnd ?? null,
      })
      .where(eq(businessProfilesTable.userId, userId));
    logger.info({ userId, planType, interval, from: current.priceId }, "Subscription plan changed with proration");

    try {
      const [authUser] = await db.select({ email: authUsersTable.email, name: authUsersTable.name }).from(authUsersTable).where(eq(authUsersTable.id, userId));
      if (authUser?.email) {
        await sendSubscriptionEmail({
          toEmail: authUser.email,
          toName: authUser.name || "Customer",
          planName: plan.name,
          planPrice: interval === "year" ? yearlyPriceFor(plan.price) : plan.price,
          planInterval: interval,
        });
      }
    } catch (emailErr) {
      logger.error({ err: emailErr }, "Failed to send plan-change email (non-fatal)");
    }

    res.json({ mode: "updated", plan: planType, interval, periodEnd: periodEndSec ? new Date(periodEndSec * 1000).toISOString() : null });
  } catch (err) {
    logger.error({ err }, "Error changing plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/payments/verify/:quoteId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const quoteId = req.params["quoteId"] as string;

    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, quoteId));
    if (!quote || quote.userId !== userId) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    if (quote.status === "unlocked") {
      res.json({ status: "unlocked" });
      return;
    }

    if (!quote.stripeSessionId) {
      res.json({ status: quote.status });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(quote.stripeSessionId);

    if (session.payment_status === "paid" || session.status === "complete") {
      const planType = (session.metadata as Record<string, string> | null)?.planType ?? null;
      await db
        .update(quotesTable)
        .set({ status: "unlocked", unlockedWithPlan: planType })
        .where(eq(quotesTable.id, quoteId));
      logger.info({ quoteId, planType }, "Quote unlocked via verify endpoint");
      res.json({ status: "unlocked" });
      return;
    }

    res.json({ status: quote.status });
  } catch (err) {
    logger.error({ err }, "Error verifying payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
