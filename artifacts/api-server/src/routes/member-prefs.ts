import { Router } from "express";
import { z } from "zod";
import { and, eq, gte } from "drizzle-orm";
import { db, memberPreferencesTable, businessProfilesTable, quotesTable, invoicesTable, projectsTable, type MemberPrefs } from "@workspace/db";
import { localDay } from "../assistant/companyRules.js";
import { timeZoneForProvince } from "../jobs/dates.js";
import { numbersFor, periodWindow, type Period } from "../me/numbers.js";
import { localMidnight } from "../today/business.js";
import { requireAuth, getUserId, getActorUserId } from "../middlewares/authMiddleware.js";

// ── Pocket, Phase 149: a person's own app choices (Settings → Assistant) ─────
// GET /api/me/preferences · PUT /api/me/preferences { voice?, speak?, confirmSend?, language? }
// Per company and person, every device. Defaults: Ember, speak on, ask before sending on.

const router = Router();

const DEFAULTS: Required<Pick<MemberPrefs, "voice" | "speak" | "confirmSend">> & Pick<MemberPrefs, "language" | "jobTitle" | "mobile" | "signature" | "home"> = { voice: "ember", speak: true, confirmSend: true, language: undefined };

const Body = z.object({
  voice: z.enum(["ember", "tide", "stone"]).optional(),
  speak: z.boolean().optional(),
  confirmSend: z.boolean().optional(),
  language: z.enum(["en", "fr"]).optional(),
  jobTitle: z.string().trim().max(80).optional(),
  mobile: z.string().trim().max(40).optional(),
  signature: z.string().max(20_000).optional(),
  home: z.object({ order: z.array(z.string().max(30)).max(40).optional(), on: z.record(z.string().max(30), z.boolean()).optional(), tabs: z.array(z.string().max(20)).max(4).optional(), density: z.union([z.literal(0), z.literal(1)]).optional() }).strict().optional(),
});

async function read(userId: string, memberUserId: string): Promise<MemberPrefs> {
  const [row] = await db.select({ prefs: memberPreferencesTable.prefs }).from(memberPreferencesTable).where(and(eq(memberPreferencesTable.userId, userId), eq(memberPreferencesTable.memberUserId, memberUserId)));
  return { ...DEFAULTS, ...(row?.prefs ?? {}) };
}

router.get("/me/preferences", requireAuth, async (req, res) => {
  try {
    res.json({ preferences: await read(getUserId(res), getActorUserId(res)) });
  } catch (err) {
    req.log.error({ err }, "Error reading preferences");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/me/preferences", requireAuth, async (req, res) => {
  try {
    const body = Body.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const userId = getUserId(res), memberUserId = getActorUserId(res);
    const prefs = { ...(await read(userId, memberUserId)), ...body.data };
    await db.insert(memberPreferencesTable).values({ userId, memberUserId, prefs })
      .onConflictDoUpdate({ target: [memberPreferencesTable.userId, memberPreferencesTable.memberUserId], set: { prefs, updatedAt: new Date() } });
    res.json({ preferences: prefs });
  } catch (err) {
    req.log.error({ err }, "Error saving preferences");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/me/numbers?period=month|quarter|year — what this person did: quotes made and sent, how many sent were won, what they invoiced, jobs; with the period
// before it for the arrows, and the last three months one by one.
router.get("/me/numbers", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res), me = getActorUserId(res);
    const period = (["month", "quarter", "year"] as const).includes(req.query.period as Period) ? (req.query.period as Period) : "month";
    const [profile] = await db.select({ province: businessProfilesTable.province }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    const zone = timeZoneForProvince(profile?.province);
    const today = localDay(new Date(), zone);
    const at = (day: string) => localMidnight(day, zone);
    const win = (back: number, p: Period = period) => { const w = periodWindow(p, today, back); return { from: at(w.start), to: at(w.end) }; };
    const since = at(periodWindow("year", today, 1).start);
    const [qs, ivs, js] = await Promise.all([
      db.select({ createdAt: quotesTable.createdAt, sentAt: quotesTable.sentAt, acceptedAt: quotesTable.acceptedAt, status: quotesTable.status }).from(quotesTable).where(and(eq(quotesTable.userId, userId), eq(quotesTable.createdByUserId, me), gte(quotesTable.createdAt, new Date(since.getTime() - 120 * 86_400_000)))).limit(5000),
      db.select({ issueDate: invoicesTable.issueDate, totalCents: invoicesTable.totalCents, status: invoicesTable.status }).from(invoicesTable).where(and(eq(invoicesTable.userId, userId), eq(invoicesTable.createdByUserId, me), gte(invoicesTable.issueDate, since))).limit(5000),
      db.select({ createdAt: projectsTable.createdAt, status: projectsTable.status }).from(projectsTable).where(and(eq(projectsTable.userId, userId), eq(projectsTable.createdByUserId, me))).limit(5000),
    ]);
    const quotes = qs.map((q) => ({ createdAt: q.createdAt, sentAt: q.sentAt, acceptedAt: q.acceptedAt, accepted: q.status === "accepted" || !!q.acceptedAt }));
    const months = [0, 1, 2].map((b) => { const w = win(b, "month"); const n = numbersFor(w, quotes, ivs, js); return { month: periodWindow("month", today, b).start.slice(0, 7), sent: n.sent, won: n.won, invoicedCents: n.invoicedCents }; });
    res.json({ period, now: numbersFor(win(0), quotes, ivs, js), before: numbersFor(win(1), quotes, ivs, js), months });
  } catch (err) {
    req.log.error({ err }, "Error reading a person's numbers");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
