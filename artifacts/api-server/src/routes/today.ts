import { Router } from "express";
import { z } from "zod";
import { db, businessProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId, getActorRole } from "../middlewares/authMiddleware.js";
import { needsYou, todayStats } from "../today/service.js";

// ── Phase 104: the dashboard home ───────────────────────────────────────────
// Two reads for the home page: what needs the person now, and the period's
// numbers. Every role may ask; each part is filtered by what the role can see
// (the service checks the permission matrix per area), so a viewer gets a
// shorter list rather than a 403.

const router = Router();

// GET /api/today/needs-you
router.get("/today/needs-you", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    res.json({ items: await needsYou(userId, getActorRole(res), profile) });
  } catch (err) {
    req.log.error({ err }, "Error loading needs-you");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** A year and a bit: the longest period the home offers is a year, and the one before it. */
const MAX_SPAN_DAYS = 800;

// GET /api/today/stats?from&to&prevFrom — the period is the browser's (its months, its zone).
router.get("/today/stats", requireAuth, async (req, res) => {
  try {
    const q = z.object({ from: z.string().datetime(), to: z.string().datetime(), prevFrom: z.string().datetime() }).safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const from = new Date(q.data.from);
    const to = new Date(q.data.to);
    const prevFrom = new Date(q.data.prevFrom);
    if (!(prevFrom < from && from < to) || to.getTime() - prevFrom.getTime() > MAX_SPAN_DAYS * 86_400_000) {
      res.status(400).json({ error: "Invalid window" });
      return;
    }
    res.json(await todayStats(getUserId(res), getActorRole(res), from, to, prevFrom));
  } catch (err) {
    req.log.error({ err }, "Error loading today's stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
