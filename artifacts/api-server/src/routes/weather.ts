import { Router } from "express";
import { z } from "zod";
import { db, businessProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { siteFor, weatherAt, zoneOf } from "../weather/service.js";

// ── Pocket, Phase 145: the weather line on the phone's Home ─────────────────
// GET /api/weather/today[?lat&lon] — the company's forecast site from its
// address, else from the phone's position. `{ weather: null }` when neither
// finds one or ECCC is unreachable: the header then shows the date alone.

const router = Router();

router.get("/weather/today", requireAuth, async (req, res) => {
  try {
    const q = z.object({ lat: z.coerce.number().min(41).max(84).optional(), lon: z.coerce.number().min(-142).max(-52).optional() }).safeParse(req.query);
    const pos = q.success && q.data.lat != null && q.data.lon != null ? { lat: q.data.lat, lon: q.data.lon } : undefined;
    const [profile] = await db.select({ address: businessProfilesTable.address, province: businessProfilesTable.province }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, getUserId(res)));
    const site = await siteFor(profile?.address ?? null, profile?.province ?? null, pos).catch(() => null);
    const weather = site ? await weatherAt(site, zoneOf(profile?.province ?? null)).catch(() => null) : null;
    res.setHeader("Cache-Control", "private, max-age=900");
    res.json({ weather });
  } catch (err) {
    req.log.error({ err }, "Error loading weather");
    res.json({ weather: null });
  }
});

export default router;
