import { Router } from "express";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { z } from "zod";
import {
  db,
  costEntriesTable,
  projectsTable,
  milestonesTable,
  clientsTable,
  uploadedDocumentsTable,
  businessProfilesTable,
  hasFeature,
  minimumPlanFor,
  COST_CATEGORIES,
  COST_ENTRY_STATUSES,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";
import { writeAudit } from "../lib/notifications.js";
import { raiseAutomation } from "../lib/automation.js";
import { logger } from "../lib/logger.js";
import { parseIsoDate } from "../jobs/dates.js";
import { readReceipt, normalizeReceipt, receiptDescription, RECEIPT_MIME_TYPES, type JobCandidate } from "../costs/receiptAi.js";
import { costSummary, serializeCostEntry, nameMaps } from "../costs/service.js";

// ── Phase 3: cost entries + receipt AI ───────────────────────────────────────
// Gate: "costs" (Pro). Every cost of a job lives in cost_entries; receipts
// arrive as pending_review rows the company confirms after a glance.

const router = Router();
const objectStorage = new ObjectStorageService();

const receiptLimiter = userRateLimiter({ windowMs: 60 * 60 * 1000, max: 60, message: "Hourly receipt-scanning limit reached. Try again later." });

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if ((RECEIPT_MIME_TYPES as readonly string[]).includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}. Use a JPG, PNG, WEBP photo or a PDF.`));
  },
});

async function requireCostsFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "costs")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("costs") };
}

async function ownedProject(userId: string, id: string) {
  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  return project ?? null;
}

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const TaxBreakdownBody = z.object({ GST: z.number().int().min(0).optional(), HST: z.number().int().min(0).optional(), PST: z.number().int().min(0).optional(), QST: z.number().int().min(0).optional() });

const CostBody = z.object({
  category: z.enum(COST_CATEGORIES),
  vendor: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  date: z.string().regex(dateRe).optional(),
  milestoneId: z.string().uuid().nullable().optional(),
  subtotalCents: z.number().int().optional(),
  taxCents: z.number().int().min(0).optional(),
  taxBreakdown: TaxBreakdownBody.optional(),
  totalCents: z.number().int(),
});

function amounts(d: { subtotalCents?: number; taxCents?: number; taxBreakdown?: z.infer<typeof TaxBreakdownBody>; totalCents: number }) {
  const breakdown = d.taxBreakdown ?? {};
  const bdSum = Object.values(breakdown).reduce((s, v) => s + (v ?? 0), 0);
  const taxCents = d.taxCents ?? bdSum;
  const subtotalCents = d.subtotalCents ?? d.totalCents - taxCents;
  return { subtotalCents, taxCents, taxBreakdown: breakdown, totalCents: d.totalCents };
}

async function milestoneBelongs(projectId: string, milestoneId: string | null | undefined): Promise<string | null> {
  if (!milestoneId) return null;
  const [m] = await db.select({ id: milestonesTable.id }).from(milestonesTable).where(and(eq(milestonesTable.id, milestoneId), eq(milestonesTable.projectId, projectId)));
  return m?.id ?? null;
}

// ── Per-job entries ──────────────────────────────────────────────────────────

// GET /api/jobs/:id/costs
router.get("/jobs/:id/costs", requireAuth, async (req, res) => {
  try {
    const project = await ownedProject(getUserId(res), req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const s = await costSummary(project.id);
    const names = await nameMaps({ milestoneIds: s.entries.map((e) => e.milestoneId) });
    res.json({ ...s, entries: s.entries.map((e) => serializeCostEntry(e, { milestoneTitle: e.milestoneId ? names.milestone.get(e.milestoneId) : null })) });
  } catch (err) {
    req.log.error({ err }, "Error listing costs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs/:id/costs — manual entry, confirmed right away
router.post("/jobs/:id/costs", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireCostsFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Cost tracking requires the Pro plan" });
      return;
    }
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = CostBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const [entry] = await db
      .insert(costEntriesTable)
      .values({
        userId,
        projectId: project.id,
        milestoneId: await milestoneBelongs(project.id, d.milestoneId),
        category: d.category,
        vendor: d.vendor ?? "",
        description: d.description ?? "",
        date: parseIsoDate(d.date) ?? new Date(),
        ...amounts(d),
        status: "confirmed",
        source: "manual",
        createdBy: "user",
        confirmedAt: new Date(),
      })
      .returning();
    await raiseAutomation({ event: "cost.confirmed", userId, entityType: "cost_entry", entityId: entry!.id });
    res.status(201).json({ entry: serializeCostEntry(entry!) });
  } catch (err) {
    req.log.error({ err }, "Error adding cost");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/jobs/:id/costs/:cid — edit and/or confirm. Labour/equipment entries are derived: edit the time entry or usage instead.
router.put("/jobs/:id/costs/:cid", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [entry] = await db.select().from(costEntriesTable).where(and(eq(costEntriesTable.id, req.params.cid as string), eq(costEntriesTable.userId, userId), or(eq(costEntriesTable.projectId, project.id), isNull(costEntriesTable.projectId))));
    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (entry.source === "time_entry" || entry.source === "equipment") {
      res.status(409).json({ error: "DERIVED", message: "This cost comes from a time entry or equipment log — edit that instead." });
      return;
    }
    const body = CostBody.partial().extend({ status: z.enum(COST_ENTRY_STATUSES).optional(), projectId: z.string().uuid().optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const updates: Partial<typeof costEntriesTable.$inferInsert> = {};
    // A receipt that landed on the wrong job (or none) can be moved.
    let targetProjectId = entry.projectId ?? project.id;
    if (d.projectId && d.projectId !== targetProjectId) {
      const target = await ownedProject(userId, d.projectId);
      if (!target) {
        res.status(400).json({ error: "Invalid job" });
        return;
      }
      targetProjectId = target.id;
    }
    if (targetProjectId !== entry.projectId) updates.projectId = targetProjectId;
    if (d.category !== undefined) updates.category = d.category;
    if (d.vendor !== undefined) updates.vendor = d.vendor;
    if (d.description !== undefined) updates.description = d.description;
    if (d.date !== undefined) updates.date = parseIsoDate(d.date) ?? entry.date;
    if (d.milestoneId !== undefined) updates.milestoneId = await milestoneBelongs(targetProjectId, d.milestoneId);
    else if (updates.projectId) updates.milestoneId = null;
    if (d.totalCents !== undefined || d.subtotalCents !== undefined || d.taxCents !== undefined || d.taxBreakdown !== undefined) {
      const taxBreakdown = d.taxBreakdown ?? (entry.taxBreakdown as z.infer<typeof TaxBreakdownBody>);
      const totalCents = d.totalCents ?? entry.totalCents;
      const taxCents = d.taxCents ?? (d.taxBreakdown ? Object.values(d.taxBreakdown).reduce((s, v) => s + (v ?? 0), 0) : entry.taxCents);
      const subtotalCents = d.subtotalCents ?? totalCents - taxCents;
      Object.assign(updates, { totalCents, taxCents, taxBreakdown, subtotalCents });
    }
    if (d.status !== undefined) {
      updates.status = d.status;
      updates.confirmedAt = d.status === "confirmed" ? (entry.confirmedAt ?? new Date()) : null;
    }
    const [updated] = await db.update(costEntriesTable).set(updates).where(eq(costEntriesTable.id, entry.id)).returning();
    if (d.status === "confirmed" && entry.status !== "confirmed") {
      await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "cost_entry", entityId: entry.id, action: "confirmed", diff: { totalCents: updated!.totalCents, category: updated!.category } });
      await raiseAutomation({ event: "cost.confirmed", userId, entityType: "cost_entry", entityId: entry.id });
    }
    res.json({ entry: serializeCostEntry(updated!) });
  } catch (err) {
    req.log.error({ err }, "Error updating cost");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/jobs/:id/costs/:cid
router.delete("/jobs/:id/costs/:cid", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [entry] = await db.select().from(costEntriesTable).where(and(eq(costEntriesTable.id, req.params.cid as string), eq(costEntriesTable.userId, userId), or(eq(costEntriesTable.projectId, project.id), isNull(costEntriesTable.projectId))));
    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (entry.source === "time_entry" || entry.source === "equipment") {
      res.status(409).json({ error: "DERIVED", message: "Delete the time entry or equipment log instead." });
      return;
    }
    await db.delete(costEntriesTable).where(eq(costEntriesTable.id, entry.id));
    if (entry.sourceDocumentId) {
      const [doc] = await db.select().from(uploadedDocumentsTable).where(eq(uploadedDocumentsTable.id, entry.sourceDocumentId));
      if (doc && doc.purpose === "receipt") {
        await objectStorage.deleteObjectBuffer(doc.fileUrl.replace("/objects/", "")).catch(() => {});
        await db.delete(uploadedDocumentsTable).where(eq(uploadedDocumentsTable.id, doc.id));
      }
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting cost");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Receipts ─────────────────────────────────────────────────────────────────

// GET /api/costs/review — every pending entry (receipts still to confirm), incl. unmatched ones
router.get("/costs/review", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const entries = await db.select().from(costEntriesTable).where(and(eq(costEntriesTable.userId, userId), eq(costEntriesTable.status, "pending_review"))).orderBy(desc(costEntriesTable.createdAt)).limit(100);
    const names = await nameMaps({ projectIds: entries.map((e) => e.projectId) });
    res.json({ entries: entries.map((e) => serializeCostEntry(e, { projectName: e.projectId ? names.project.get(e.projectId) : null })) });
  } catch (err) {
    req.log.error({ err }, "Error listing review queue");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/costs/receipts — multipart { file, projectId? } → AI reads it → pending cost entry
router.post(
  "/costs/receipts",
  requireAuth,
  receiptLimiter,
  (req, res, next) => {
    receiptUpload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError || err instanceof Error) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    });
  },
  async (req, res) => {
    try {
      const userId = getUserId(res);
      const gate = await requireCostsFeature(userId);
      if (!gate.ok) {
        res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Receipt scanning requires the Pro plan" });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }
      const projectIdRaw = typeof req.body?.projectId === "string" && req.body.projectId ? String(req.body.projectId) : null;
      const project = projectIdRaw ? await ownedProject(userId, projectIdRaw) : null;
      if (projectIdRaw && !project) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      const [profile] = await db.select({ province: businessProfilesTable.province }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
      const openJobs = await db
        .select({ id: projectsTable.id, name: projectsTable.name, address: projectsTable.address, clientId: projectsTable.clientId })
        .from(projectsTable)
        .where(and(eq(projectsTable.userId, userId), inArray(projectsTable.status, ["planning", "active"])))
        .orderBy(asc(projectsTable.name))
        .limit(40);
      const clientIds = [...new Set(openJobs.map((j) => j.clientId).filter((x): x is string => !!x))];
      const clients = clientIds.length ? await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(inArray(clientsTable.id, clientIds)) : [];
      const clientName = new Map(clients.map((c) => [c.id, c.name]));
      const candidates: JobCandidate[] = openJobs.map((j) => ({ id: j.id, name: j.name, address: j.address, clientName: j.clientId ? (clientName.get(j.clientId) ?? null) : null }));

      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[file.mimetype] ?? "bin";
      const subPath = `receipts/${userId}/${randomUUID()}.${ext}`;
      const fileUrl = await objectStorage.uploadObjectBuffer({ subPath, buffer: file.buffer, contentType: file.mimetype });
      const [doc] = await db
        .insert(uploadedDocumentsTable)
        .values({ userId, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype, fileUrl, status: "processing", purpose: "receipt", projectId: project?.id ?? null })
        .returning();

      // AI read — a failure still leaves an empty pending entry the user can fill by hand.
      let read: ReturnType<typeof normalizeReceipt>;
      try {
        const { raw, model } = await readReceipt({ buffer: file.buffer, mimeType: file.mimetype, candidates, province: (project?.province ?? profile?.province) ?? null, userId });
        read = normalizeReceipt(raw, { model, candidateIds: candidates.map((c) => c.id), province: (project?.province ?? profile?.province) ?? null });
        await db.update(uploadedDocumentsTable).set({ status: "done", extractedData: read.extraction }).where(eq(uploadedDocumentsTable.id, doc!.id));
      } catch (err) {
        logger.warn({ err, docId: doc!.id }, "Receipt AI failed; creating a blank pending entry");
        read = normalizeReceipt({}, { model: "error", candidateIds: [], province: null });
        read.extraction.note = "Automatic reading failed — please fill in the amounts.";
        await db.update(uploadedDocumentsTable).set({ status: "error", errorMessage: err instanceof Error ? err.message : "AI error" }).where(eq(uploadedDocumentsTable.id, doc!.id));
      }

      const targetProjectId = project?.id ?? read.extraction.suggestedProjectId ?? null;
      const [entry] = await db
        .insert(costEntriesTable)
        .values({
          userId,
          projectId: targetProjectId,
          category: read.extraction.suggestedCategory ?? "materials",
          vendor: read.extraction.vendor ?? "",
          description: receiptDescription(read.extraction),
          date: read.date ?? new Date(),
          subtotalCents: read.subtotalCents,
          taxCents: read.taxCents,
          taxBreakdown: read.taxBreakdown,
          totalCents: read.totalCents,
          status: "pending_review",
          source: "receipt",
          createdBy: "ai",
          sourceDocumentId: doc!.id,
          aiExtraction: read.extraction,
        })
        .returning();
      if (targetProjectId && !project) await db.update(uploadedDocumentsTable).set({ projectId: targetProjectId }).where(eq(uploadedDocumentsTable.id, doc!.id));
      await writeAudit({ userId, actorType: "ai", entityType: "cost_entry", entityId: entry!.id, action: "receipt_read", diff: { confidence: read.extraction.confidence, totalCents: read.totalCents, projectId: targetProjectId } });
      const names = await nameMaps({ projectIds: [targetProjectId] });
      res.status(201).json({ entry: serializeCostEntry(entry!, { projectName: targetProjectId ? names.project.get(targetProjectId) : null }) });
    } catch (err) {
      req.log.error({ err }, "Error scanning receipt");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// GET /api/costs/receipts/:docId/file — the receipt image/PDF (owner only)
router.get("/costs/receipts/:docId/file", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [doc] = await db.select().from(uploadedDocumentsTable).where(and(eq(uploadedDocumentsTable.id, req.params.docId as string), eq(uploadedDocumentsTable.userId, userId)));
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const file = await objectStorage.downloadPrivateObject(doc.fileUrl.replace("/objects/", ""));
    res.status(file.status);
    file.headers.forEach((v, k) => res.setHeader(k, v));
    res.setHeader("Content-Disposition", `inline; filename="${doc.fileName.replace(/"/g, "")}"`);
    if (file.body) Readable.fromWeb(file.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    req.log.error({ err }, "Error serving receipt");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
