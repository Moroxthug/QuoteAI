import { Router } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { weatherToday } from "../weather/today.js";

// ── Pocket 129: weather for job sites (docs/pocket-design/handoff/WEATHER.md) ───────────────────
// GET /api/v1/weather/today[?lang=en|fr] — the sites with a visit today (up to 4, busiest first; the company address when nothing is scheduled),
// each with now, the hours, seven days and the words for the day as keys the app turns into English or French. Each place is asked of the
// weather source once every 30 minutes. Any signed-in person of the company may read it.

const router = Router();

router.get("/v1/weather/today", requireAuth, async (req, res) => {
  try {
    const q = z.object({ lang: z.enum(["en", "fr"]).optional() }).safeParse(req.query);
    const header = String(req.headers["accept-language"] ?? "").toLowerCase();
    const lang = (q.success && q.data.lang) || (header.startsWith("fr") ? "fr" : "en");
    const out = await weatherToday({ userId: getUserId(res), lang });
    res.setHeader("Cache-Control", "private, max-age=300");
    res.json(out);
  } catch (err) {
    req.log.error({ err }, "Error loading the weather");
    res.status(502).json({ error: "WEATHER_UNAVAILABLE", message: "The weather could not be loaded right now." });
  }
});

export default router;
