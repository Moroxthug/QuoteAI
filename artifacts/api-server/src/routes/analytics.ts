import { Router } from "express";
import { db, projectsTable, businessProfilesTable, hasFeature, minimumPlanFor } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { companyAnalytics, jobAnalytics } from "../analytics/service.js";

// ── Phase 5: dashboards ──────────────────────────────────────────────────────
// Job charts ride on the "jobs" feature (Pro); the company margin / AR /
// cash-flow page is "analytics_pro" (Elite).

const router = Router();

// GET /api/jobs/:id/analytics
router.get("/jobs/:id/analytics", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, req.params.id as string), eq(projectsTable.userId, userId)));
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await jobAnalytics(project));
  } catch (err) {
    req.log.error({ err }, "Error computing job analytics");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/analytics/company?months=6
router.get("/analytics/company", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    if (!hasFeature(profile, "analytics_pro")) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("analytics_pro"), message: "Business analytics require the Elite plan" });
      return;
    }
    const months = Number.parseInt(String(req.query.months ?? "6"), 10);
    res.json(await companyAnalytics(userId, { months: Number.isFinite(months) ? months : 6 }));
  } catch (err) {
    req.log.error({ err }, "Error computing company analytics");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
