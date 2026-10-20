import { Router } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { eq } from "drizzle-orm";
import { db, businessProfilesTable } from "@workspace/db";
import { currentLaunchOffer } from "../lib/launchPrice.js";
import { quoteAllowance } from "../lib/freeQuotes.js";
import { isTrackedEvent, recordAttribution, trackGrowth } from "../lib/growth.js";

const router = Router();

const tags = {
  source: z.string().max(80).optional(),
  medium: z.string().max(80).optional(),
  campaign: z.string().max(100).optional(),
  referrer: z.string().max(300).optional(),
  landingPath: z.string().max(200).optional(),
  platform: z.enum(["web", "android", "ios"]).optional(),
  referralCode: z.string().max(40).optional(),
};

// POST /api/growth/track: the website and the app report a funnel event (a visit, an install, the paywall seen...). Public on purpose (the person has no account yet), so: a fixed list of events,
// small bodies, an IP rate limit, and the answer is always 204 (nothing about the data is learned from it).
router.post("/growth/track", ipRateLimiter({ windowMs: 60_000, max: 90, message: "Too many events." }), (req, res) => {
  const body = z.object({ event: z.string().max(60), anonId: z.string().max(80).optional(), props: z.record(z.string(), z.unknown()).optional(), ...tags }).safeParse(req.body);
  if (body.success && isTrackedEvent(body.data.event)) {
    const b = body.data;
    trackGrowth({ event: b.event, anonId: b.anonId, source: b.source ?? null, platform: b.platform ?? "web", props: { ...(b.props ?? {}), ...(b.campaign ? { campaign: b.campaign } : {}), ...(b.landingPath ? { landingPath: b.landingPath } : {}) } });
  }
  res.status(204).end();
});

// POST /api/growth/attribution: right after sign-up, the app or the website says where the person came from (utm tags, the referrer, a referral code). Saved once per company.
router.post("/growth/attribution", requireAuth, async (req, res) => {
  const body = z.object({ anonId: z.string().max(80).optional(), ...tags }).safeParse(req.body ?? {});
  if (!body.success) { res.status(400).json({ error: "Invalid attribution" }); return; }
  const userId = getUserId(res);
  const a = await recordAttribution(userId, body.data);
  trackGrowth({ event: "signup_completed", userId, anonId: body.data.anonId, source: a.source, platform: a.platform });
  res.status(204).end();
});

// GET /api/me/allowance: what the apps need for the free-quote counter and the launch price: quotes used and left, whether running out blocks, the launch offer and whether this company is a founding customer.
router.get("/me/allowance", requireAuth, async (_req, res) => {
  try {
    const userId = getUserId(res);
    const [freeQuotes, launch, [profile]] = await Promise.all([
      quoteAllowance(userId),
      currentLaunchOffer(),
      db.select({ founding: businessProfilesTable.foundingPrice }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId)),
    ]);
    res.json({ freeQuotes, launch, founding: profile?.founding ?? false });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
