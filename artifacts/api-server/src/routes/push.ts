import { Router } from "express";
import { z } from "zod";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId } from "../middlewares/authMiddleware";
import { ipRateLimiter } from "../lib/rateLimit";
import { isPushConfigured, pushPublicKey, saveSubscription, removeSubscription, sendPushToCompany } from "../lib/push";

// ── Phase 77: Web Push subscriptions ─────────────────────────────────────────
// The browser subscribes with the VAPID public key it fetches here, then hands
// us the PushSubscription. Rows are per browser and per acting company: a
// team member's phone receives the org they were acting as when they enabled it.

const router = Router();
const testLimiter = ipRateLimiter({ windowMs: 15 * 60_000, max: 10, message: "Too many test pushes. Try again in a few minutes." });

const SubscriptionBody = z.object({
  endpoint: z.string().url().max(2000).refine((u) => u.startsWith("https://"), "endpoint must be https"),
  keys: z.object({ p256dh: z.string().min(80).max(120), auth: z.string().min(16).max(32) }),
  language: z.enum(["en", "fr"]).optional(),
});

// GET /api/push/config — is push set up server-side, the key to subscribe with, and whether this browser is already known.
router.get("/push/config", requireAuth, async (req, res) => {
  try {
    const endpoint = typeof req.query.endpoint === "string" ? req.query.endpoint : null;
    let subscribed = false;
    if (endpoint) {
      const [row] = await db.select({ id: pushSubscriptionsTable.id }).from(pushSubscriptionsTable).where(and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.memberUserId, getActorUserId(res))));
      subscribed = !!row;
    }
    res.json({ configured: isPushConfigured(), publicKey: pushPublicKey(), subscribed });
  } catch (err) {
    req.log.error({ err }, "Error reading push config");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/push/subscriptions — register (or refresh) this browser.
router.post("/push/subscriptions", requireAuth, async (req, res) => {
  try {
    if (!isPushConfigured()) {
      res.status(503).json({ error: "NOT_CONFIGURED", message: "Push notifications are not set up on this server yet." });
      return;
    }
    const body = SubscriptionBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const row = await saveSubscription({ userId: getUserId(res), memberUserId: getActorUserId(res), subscription: { endpoint: body.data.endpoint, keys: body.data.keys }, userAgent: req.get("user-agent")?.slice(0, 300) ?? null, language: body.data.language });
    res.status(201).json({ id: row.id, createdAt: row.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Error saving push subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/push/subscriptions — body { endpoint }: forget this browser.
router.delete("/push/subscriptions", requireAuth, async (req, res) => {
  try {
    const body = z.object({ endpoint: z.string().url().max(2000) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const removed = await removeSubscription({ memberUserId: getActorUserId(res), endpoint: body.data.endpoint });
    res.json({ success: true, removed });
  } catch (err) {
    req.log.error({ err }, "Error removing push subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/push/test — a sample notification to the caller's own browsers.
router.post("/push/test", requireAuth, testLimiter, async (req, res) => {
  try {
    if (!isPushConfigured()) {
      res.status(503).json({ error: "NOT_CONFIGURED", message: "Push notifications are not set up on this server yet." });
      return;
    }
    const body = z.object({ language: z.enum(["en", "fr"]).optional() }).safeParse(req.body ?? {});
    const lang = body.success && body.data.language === "fr" ? "fr" : "en";
    const summary = await sendPushToCompany(
      getUserId(res),
      { title: lang === "fr" ? "QuoteAI — notification test" : "QuoteAI — test notification", body: lang === "fr" ? "Les notifications fonctionnent sur cet appareil." : "Notifications are working on this device.", link: "/dashboard/notifications", tag: "push-test" },
      { memberUserId: getActorUserId(res) },
    );
    res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Error sending test push");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
