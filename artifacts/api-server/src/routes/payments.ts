import { Router } from "express";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/requirePermission";
import { getBaseUrl } from "../lib/baseUrl";
import { db, quotesTable, businessProfilesTable, authUsersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateCheckoutSessionBody } from "@workspace/api-zod";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import Stripe from "stripe";

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

router.get("/payments/plans", (_req, res) => {
  res.json(PLANS);
});

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

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      payment_method_types: ["card"],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      mode: plan.interval ? "subscription" : "payment",
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        quoteId: quoteId ?? "",
        planType,
        hasWatermark: String(plan.hasWatermark),
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

router.post("/payments/unlock-quote", requireAuth, async (req, res) => {
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

    if (quote.status !== "unlocked") {
      await db
        .update(quotesTable)
        .set({ status: "unlocked", unlockedWithPlan: profile.subscriptionPlan ?? null })
        .where(eq(quotesTable.id, quoteId));
      logger.info({ quoteId, userId, plan: profile.subscriptionPlan }, "Quote unlocked via subscription");
    }

    res.json({ status: "unlocked" });
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

router.post("/payments/sync-subscription", requireAuth, async (req, res) => {
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
    const planType = priceId ? PRICE_TO_PLAN[priceId] : null;

    if (!planType) {
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
        subscriptionPeriodEnd: periodEnd,
      })
      .onConflictDoUpdate({
        target: businessProfilesTable.userId,
        set: {
          stripeCustomerId: customerId,
          subscriptionPlan: planType,
          subscriptionStatus: "active",
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
