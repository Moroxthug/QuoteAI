import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool, TAX_PROFILES } from "@workspace/db";
import { opsHealth } from "../lib/ops.js";
import { ipRateLimiter } from "../lib/rateLimit.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/db", async (_req, res) => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    res.json({ status: "ok", db: "connected" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ status: "error", db: msg });
  }
});

// Phase 69: the endpoint an external uptime monitor polls. 503 when the cron
// tick is stale (Vercel Cron does not tell anyone when a schedule stops
// firing) or when automation runs are dead — so the monitor's own alerting
// becomes the alert. Public by design; it reveals counts and timestamps only.
const opsLimiter = ipRateLimiter({ windowMs: 60_000, max: 30, message: "Too many requests" });
router.get("/healthz/ops", opsLimiter, async (_req, res) => {
  try {
    const health = await opsHealth();
    res.status(health.status === "ok" ? 200 : 503).json(health);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ status: "error", error: msg });
  }
});


// Phase 71: static, public — the dashboard's manual-quote builder needs every
// province's components to show "GST 5 % + QST 9.975 %" as the user picks a
// province, and the rates live in lib/db so no client-side copy can drift.
router.get("/tax-profiles", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.json({ profiles: Object.values(TAX_PROFILES) });
});
export default router;
