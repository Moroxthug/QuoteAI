import { Router, type Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, businessProfilesTable } from "@workspace/db";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/requirePermission";
import { userRateLimiter } from "../lib/rateLimit";
import { logger } from "../lib/logger";
import { launchCustomerLimit, launchOfferFor, payingCustomerCount } from "../lib/launchPrice";
import { PlayError, playClientFromEnv, type PlayClient } from "../play/client";
import { catalogProducts } from "../play/products";
import { readPurchase, type PlayPurchase } from "../play/purchase";
import { applyPlayPurchase, appliedOf, ownerOfToken } from "../play/entitlement";
import { hasActiveStripeSubscription, isPlayManaged } from "../play/provider";

// Phase 135 (docs/GROWTH-PLAN.md, "Play Billing contract"): the Android app buys with Google Play Billing, then asks the server to verify the purchase with Google. The server decides the plan from what Google
// returns (product id + base plan id), never from the app. Billing is the owner's action, like /payments/checkout (settings:full).

const router = Router();

const playRateLimiter = userRateLimiter({ windowMs: 60_000, max: 20, message: "Too many purchase checks. Please wait a minute and try again." });
const TOKEN = z.string().min(10).max(4096);
const VerifyBody = z.object({ productId: z.string().min(1).max(200), purchaseToken: TOKEN });
const RestoreBody = z.object({ purchaseTokens: z.array(TOKEN).min(1).max(10) });

type Failure = { status: number; code: string; message: string };
const NOT_CONFIGURED: Failure = { status: 503, code: "PLAY_NOT_CONFIGURED", message: "Google Play billing is not set up on this server" };
const STRIPE_SUBSCRIBER: Failure = { status: 409, code: "ALREADY_STRIPE_SUBSCRIBER", message: "This company already subscribes on the web. Manage it there." };

function fail(res: Response, f: Failure): void {
  res.status(f.status).json({ error: f.code, code: f.code, message: f.message });
}

function failureOf(err: unknown): Failure {
  if (err instanceof PlayError) {
    if (err.code === "PLAY_NOT_CONFIGURED") return NOT_CONFIGURED;
    if (err.code === "PURCHASE_NOT_VALID") return { status: 400, code: "PURCHASE_NOT_VALID", message: "Google Play does not recognise this purchase" };
    return { status: 502, code: "PLAY_UNAVAILABLE", message: "Google Play could not be reached. Try again in a moment." };
  }
  const pg = err as { code?: string; cause?: { code?: string } } | null;
  if (pg?.code === "23505" || pg?.cause?.code === "23505") {
    return { status: 409, code: "PURCHASE_NOT_VALID", message: "This purchase belongs to another company" };
  }
  logger.error({ err }, "Play billing error");
  return { status: 500, code: "INTERNAL", message: "Internal server error" };
}

async function profileOf(userId: string) {
  const [p] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return p ?? null;
}

// GET /api/billing/play/catalog: what the app may sell, and what the company has now.
router.get("/billing/play/catalog", requireAuth, async (_req, res) => {
  try {
    const userId = getUserId(res);
    const [profile, paying] = await Promise.all([profileOf(userId), payingCustomerCount()]);
    // The founding base plan exists in Play regardless of the Stripe launch price: it is offered while spots are left.
    const launchActive = launchOfferFor(paying, launchCustomerLimit(), true).active;
    const provider = profile?.subscriptionProvider ?? (profile?.stripeCustomerId && profile.subscriptionStatus === "active" ? "stripe" : null);
    res.json({
      products: catalogProducts(launchActive),
      launchActive,
      current: {
        provider,
        plan: profile?.subscriptionPlan ?? null,
        status: profile?.subscriptionStatus ?? null,
        expiresAt: profile?.subscriptionPeriodEnd?.toISOString() ?? null,
        autoRenewing: provider === "play" ? (profile?.playAutoRenewing ?? null) : null,
      },
    });
  } catch (err) {
    fail(res, failureOf(err));
  }
});

/** Asks Google, and says why a purchase cannot be used. `failure: null` = a purchase that entitles the company. */
async function checkPurchase(client: PlayClient, token: string): Promise<{ purchase: PlayPurchase; failure: null } | { purchase: PlayPurchase; failure: Failure }> {
  const purchase = readPurchase(await client.getSubscription(token));
  if (purchase.status === "pending") return { purchase, failure: { status: 409, code: "PURCHASE_PENDING", message: "The payment is not complete yet" } };
  if (!purchase.plan) return { purchase, failure: { status: 400, code: "PURCHASE_NOT_VALID", message: "This is not a quoteAI subscription" } };
  if (!purchase.entitled) return { purchase, failure: { status: 400, code: "PURCHASE_NOT_VALID", message: "This subscription is not active" } };
  return { purchase, failure: null };
}

async function acknowledgeIfNeeded(client: PlayClient, purchase: PlayPurchase, token: string): Promise<void> {
  if (!purchase.needsAcknowledge || !purchase.productId) return;
  // Google refunds an unacknowledged purchase after 3 days. A failure here does not undo the purchase: the daily sync tries again.
  await client.acknowledge(purchase.productId, token).catch((err: unknown) => logger.warn({ err }, "Play acknowledge failed; the daily sync will retry"));
}

// POST /api/billing/play/verify
router.post("/billing/play/verify", requireAuth, requirePermission("settings", "full"), playRateLimiter, async (req, res) => {
  const parsed = VerifyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request", code: "INVALID_REQUEST" }); return; }
  try {
    const userId = getUserId(res);
    const client = playClientFromEnv();
    if (!client) { fail(res, NOT_CONFIGURED); return; }
    const { purchaseToken } = parsed.data;
    const profile = await profileOf(userId);
    if (hasActiveStripeSubscription(profile)) { fail(res, STRIPE_SUBSCRIBER); return; }
    const owner = await ownerOfToken(purchaseToken);
    if (owner && owner !== userId) { fail(res, { status: 409, code: "PURCHASE_NOT_VALID", message: "This purchase belongs to another company" }); return; }
    const checked = await checkPurchase(client, purchaseToken);
    if (checked.failure) { fail(res, checked.failure); return; }
    await acknowledgeIfNeeded(client, checked.purchase, purchaseToken);
    const applied = await applyPlayPurchase(userId, purchaseToken, checked.purchase, isPlayManaged(profile) && profile?.subscriptionStatus === "active");
    res.json({ plan: applied.plan, interval: applied.interval, founding: applied.founding, status: applied.status, expiresAt: applied.expiresAt, autoRenewing: applied.autoRenewing });
  } catch (err) {
    fail(res, failureOf(err));
  }
});

const TIER_RANK: Record<string, number> = { monthly_starter: 1, monthly_pro: 2, monthly_business: 3 };
const rankOf = (p: PlayPurchase): number => TIER_RANK[p.plan?.tier ?? ""] ?? 0;

// POST /api/billing/play/restore: a reinstalled phone sends the purchases Google Play still shows it; the best active one is applied.
router.post("/billing/play/restore", requireAuth, requirePermission("settings", "full"), playRateLimiter, async (req, res) => {
  const parsed = RestoreBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request", code: "INVALID_REQUEST" }); return; }
  try {
    const userId = getUserId(res);
    const client = playClientFromEnv();
    if (!client) { fail(res, NOT_CONFIGURED); return; }
    const profile = await profileOf(userId);
    if (hasActiveStripeSubscription(profile)) { fail(res, STRIPE_SUBSCRIBER); return; }
    let best: { token: string; purchase: PlayPurchase } | null = null;
    let lastFailure: Failure | null = null;
    for (const token of new Set(parsed.data.purchaseTokens)) {
      try {
        const owner = await ownerOfToken(token);
        if (owner && owner !== userId) continue;
        const checked = await checkPurchase(client, token);
        if (checked.failure) { lastFailure = checked.failure; continue; }
        const p = checked.purchase;
        if (!best || rankOf(p) > rankOf(best.purchase) || (rankOf(p) === rankOf(best.purchase) && (p.expiresAt?.getTime() ?? 0) > (best.purchase.expiresAt?.getTime() ?? 0))) best = { token, purchase: p };
      } catch (err) {
        if (err instanceof PlayError && err.code === "PLAY_NOT_CONFIGURED") throw err;
        lastFailure = failureOf(err);
      }
    }
    if (!best) {
      if (lastFailure && lastFailure.status >= 500) { fail(res, lastFailure); return; }
      res.json({ restored: false, plan: null, interval: null, founding: false, status: null, expiresAt: null, autoRenewing: false });
      return;
    }
    await acknowledgeIfNeeded(client, best.purchase, best.token);
    const applied = await applyPlayPurchase(userId, best.token, best.purchase, isPlayManaged(profile) && profile?.subscriptionStatus === "active");
    res.json({ restored: true, plan: applied.plan, interval: applied.interval, founding: applied.founding, status: applied.status, expiresAt: applied.expiresAt, autoRenewing: applied.autoRenewing });
  } catch (err) {
    fail(res, failureOf(err));
  }
});

export default router;
