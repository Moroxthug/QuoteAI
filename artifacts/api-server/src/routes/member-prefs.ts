import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, memberPreferencesTable, type MemberPrefs } from "@workspace/db";
import { requireAuth, getUserId, getActorUserId } from "../middlewares/authMiddleware.js";

// ── Pocket, Phase 149: a person's own app choices (Settings → Assistant) ─────
// GET /api/me/preferences · PUT /api/me/preferences { voice?, speak?, confirmSend?, language? }
// Per company and person, every device. Defaults: Ember, speak on, ask before sending on.

const router = Router();

const DEFAULTS: Required<Omit<MemberPrefs, "language">> & Pick<MemberPrefs, "language"> = { voice: "ember", speak: true, confirmSend: true, language: undefined };

const Body = z.object({
  voice: z.enum(["ember", "tide", "stone"]).optional(),
  speak: z.boolean().optional(),
  confirmSend: z.boolean().optional(),
  language: z.enum(["en", "fr"]).optional(),
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

export default router;
