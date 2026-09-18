import { Router } from "express";
import { z } from "zod";
import { db, projectsTable, quotesTable, businessProfilesTable, hasFeature, minimumPlanFor } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireApiKey, publicApiLimiter } from "../../middlewares/apiKeyAuth.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { getUserId } from "../../middlewares/authMiddleware.js";
import { serializeProject } from "../jobs.js";
import { parseIsoDate } from "../../jobs/dates.js";
import { writeAudit } from "../../lib/notifications.js";

const router = Router();

async function requireJobsFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "jobs")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("jobs") };
}

// GET /api/v1/public/jobs
router.get("/jobs", requireApiKey, publicApiLimiter, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const projects = await db.select().from(projectsTable).where(and(eq(projectsTable.userId, userId), isNull(projectsTable.archivedAt))).orderBy(desc(projectsTable.createdAt)).limit(limit);
    res.json({ items: projects.map(serializeProject) });
  } catch (err) {
    req.log.error({ err }, "Public API: error listing jobs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/v1/public/jobs/:id
router.get("/jobs/:id", requireApiKey, publicApiLimiter, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, req.params.id as string), eq(projectsTable.userId, userId)));
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    res.json(serializeProject(project));
  } catch (err) {
    req.log.error({ err }, "Public API: error fetching job");
    res.status(500).json({ error: "Internal server error" });
  }
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  quoteId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  address: z.string().max(300).optional(),
  province: z.string().max(2).optional(),
  plannedStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  plannedEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  contractValueCents: z.number().int().min(0).optional(),
});

// POST /api/v1/public/jobs — manual job, mirrors the in-app "Start job" button (no contract flow)
router.post("/jobs", requireApiKey, publicApiLimiter, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireJobsFeature(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const body = createSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const d = body.data;

    if (d.quoteId) {
      const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.quoteId, d.quoteId), eq(projectsTable.userId, userId)));
      if (existing) { res.status(200).json({ job: serializeProject(existing), created: false }); return; }
    }
    const quote = d.quoteId ? (await db.select().from(quotesTable).where(and(eq(quotesTable.id, d.quoteId), eq(quotesTable.userId, userId))))[0] : undefined;

    const [project] = await db
      .insert(projectsTable)
      .values({
        userId,
        name: d.name,
        description: d.description ?? "",
        quoteId: quote?.id ?? null,
        clientId: d.clientId ?? quote?.clientId ?? null,
        address: d.address ?? (quote?.clientData as { indirizzo?: string } | null)?.indirizzo ?? "",
        province: d.province ?? quote?.province ?? null,
        status: "planning",
        setupStatus: "confirmed",
        setupConfirmedAt: new Date(),
        contractValueCents: d.contractValueCents ?? (quote ? Math.round(Number(quote.totale) * 100) : 0),
        budget: d.contractValueCents ?? (quote ? Math.round(Number(quote.totale) * 100) : 0),
        plannedStart: parseIsoDate(d.plannedStart),
        plannedEnd: parseIsoDate(d.plannedEnd),
        startDate: parseIsoDate(d.plannedStart),
        endDate: parseIsoDate(d.plannedEnd),
      })
      .returning();
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "project", entityId: project!.id, action: "created" });
    res.status(201).json({ job: serializeProject(project!), created: true });
  } catch (err) {
    req.log.error({ err }, "Public API: error creating job");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
