import { Router } from "express";
import { z } from "zod";
import { db, businessProfilesTable, fieldReportsTable, projectsTable, hasFeature, minimumPlanFor } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth, getUserId, getUserName } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit } from "../lib/notifications.js";
import { crewToday, serializeReports } from "../crew/service.js";

// ── Phase 86: the office side of the crew's app ─────────────────────────────
// What the field sent, and the foreman's day: who is where, who is clocked
// in, what is waiting for approval, what is blocked. Everything here is read
// from rows the worker page and the schedule board already write; the only
// write is answering a blocker.

const router = Router();

// GET /api/crew/today
router.get("/crew/today", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    // Crews, clocks and approvals are the time-tracking tier; say so rather than show an empty day.
    if (!hasFeature(profile, "team_time")) {
      res.json({ enabled: false, requiredPlan: minimumPlanFor("team_time") });
      return;
    }
    res.json({ enabled: true, ...(await crewToday(userId, profile?.province ?? null)) });
  } catch (err) {
    req.log.error({ err }, "Error loading the crew's day");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs/:id/field-reports
router.get("/jobs/:id/field-reports", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = z.string().uuid().safeParse(req.params.id);
    const [project] = id.success ? await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.id, id.data), eq(projectsTable.userId, userId))) : [];
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const rows = await db.select().from(fieldReportsTable).where(and(eq(fieldReportsTable.userId, userId), eq(fieldReportsTable.projectId, project.id))).orderBy(desc(fieldReportsTable.createdAt)).limit(100);
    res.json({ reports: await serializeReports(rows) });
  } catch (err) {
    req.log.error({ err }, "Error listing field reports");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/field-reports/:id/resolve — { note? } — answers a blocker (or clears any report from the open list).
router.post("/field-reports/:id/resolve", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = z.string().uuid().safeParse(req.params.id);
    const body = z.object({ note: z.string().max(500).optional() }).safeParse(req.body ?? {});
    if (!id.success || !body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const [report] = await db.select().from(fieldReportsTable).where(and(eq(fieldReportsTable.id, id.data), eq(fieldReportsTable.userId, userId)));
    if (!report) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (report.resolvedAt) {
      res.json({ report: (await serializeReports([report]))[0] });
      return;
    }
    const [updated] = await db
      .update(fieldReportsTable)
      .set({ resolvedAt: new Date(), resolvedByName: getUserName(res) || null, resolutionNote: body.data.note?.trim() || null })
      .where(eq(fieldReportsTable.id, report.id))
      .returning();
    await writeAudit({ userId, actorType: "user", entityType: "field_report", entityId: report.id, action: "field_report_resolved", diff: { kind: report.kind, note: body.data.note ?? null } });
    res.json({ report: (await serializeReports([updated!]))[0] });
  } catch (err) {
    req.log.error({ err }, "Error resolving field report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
