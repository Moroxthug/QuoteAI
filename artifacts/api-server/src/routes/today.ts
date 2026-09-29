import { Router } from "express";
import { z } from "zod";
import { db, businessProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId, getActorRole, getActorUserId } from "../middlewares/authMiddleware.js";
import { needsYou, todayStats } from "../today/service.js";
import { businessCard } from "../today/business.js";
import { checklist, setChecked } from "../today/checklist.js";

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

// GET /api/today/checklist — Pocket's "Today" list on Home (today/checklist.ts).
router.get("/today/checklist", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    res.json(await checklist(userId, getActorUserId(res), getActorRole(res), profile));
  } catch (err) {
    req.log.error({ err }, "Error loading the checklist");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/today/checklist/:itemId { done } — tick an item for today (a job task: complete it).
router.put("/today/checklist/:itemId", requireAuth, async (req, res) => {
  try {
    const body = z.object({ done: z.boolean() }).safeParse(req.body);
    const itemId = String(req.params.itemId ?? "");
    if (!body.success || !/^[a-z]+(:[A-Za-z0-9-]+)?$/.test(itemId) || itemId.length > 80) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const userId = getUserId(res);
    const [profile] = await db.select({ province: businessProfilesTable.province }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    const r = await setChecked(userId, getActorUserId(res), getActorRole(res), profile?.province ?? null, itemId, body.data.done);
    if (r === "forbidden") { res.status(403).json({ error: "Forbidden" }); return; }
    if (r === "not_found") { res.status(404).json({ error: "Not found" }); return; }
    res.json({ itemId, done: body.data.done });
  } catch (err) {
    req.log.error({ err }, "Error ticking a checklist item");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/today/business?period=W|M|Q — Pocket's Business card on Home (today/business.ts).
router.get("/today/business", requireAuth, async (req, res) => {
  try {
    const q = z.object({ period: z.enum(["W", "M", "Q"]).default("M") }).safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const userId = getUserId(res);
    const [profile] = await db.select({ province: businessProfilesTable.province }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    res.json(await businessCard(userId, getActorRole(res), profile?.province ?? null, q.data.period));
  } catch (err) {
    req.log.error({ err }, "Error loading the business card");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
