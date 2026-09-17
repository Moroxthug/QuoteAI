import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { randomUUID } from "node:crypto";
import {
  db,
  projectsTable,
  projectTasksTable,
  milestonesTable,
  costBudgetLinesTable,
  changeOrdersTable,
  contractsTable,
  clientsTable,
  quotesTable,
  projectAssignmentsTable,
  collaboratorsTable,
  timeEntriesTable,
  equipmentUsageTable,
  equipmentTable,
  businessProfilesTable,
  whatsappConnectionsTable,
  jobPhotosTable,
  hasFeature,
  minimumPlanFor,
  PROJECT_STATUSES,
  MILESTONE_STATUSES,
  COST_CATEGORIES,
  type Milestone,
  type ChangeOrder,
  type CostBudgetLine,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireAuth, getUserId, getUserName } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { raiseAutomation } from "../lib/automation.js";
import { writeAudit } from "../lib/notifications.js";
import { recomputeProgress, setupJobFromContract } from "../jobs/setup.js";
import { createChangeOrder, updateChangeOrder, changeOrderStatusFromDocument } from "../jobs/changeOrders.js";
import { parseIsoDate, toIsoDate } from "../jobs/dates.js";
import { costSummary, serializeCostEntry, serializeTimeEntry, serializeUsage } from "../costs/service.js";
import { invoicesForProject, projectInvoiceTotals } from "../invoices/service.js";
import { serializeInvoice } from "./invoices.js";
import { Readable } from "node:stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";
import { sendJobPhotoShare } from "../lib/jobMessaging.js";
import { syncMilestoneToCalendar, removeMilestoneFromCalendar, removeMilestonesFromCalendar } from "../calendar/sync.js";
import { logger } from "../lib/logger.js";

const router = Router();
const objectStorage = new ObjectStorageService();

const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (PHOTO_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}. Use a JPG, PNG, WEBP or HEIC photo.`));
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function requireJobsFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "jobs")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("jobs") };
}

async function ownedProject(userId: string, id: string) {
  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  return project ?? null;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

function serializeMilestone(m: Milestone, tasks: (typeof projectTasksTable.$inferSelect)[] = []) {
  return {
    id: m.id,
    key: m.key,
    title: m.title,
    description: m.description,
    sortOrder: m.sortOrder,
    plannedStart: toIsoDate(m.plannedStart),
    plannedEnd: toIsoDate(m.plannedEnd),
    actualStart: iso(m.actualStart),
    actualEnd: iso(m.actualEnd),
    status: m.status,
    paymentTermId: m.paymentTermId,
    paymentTermLabel: m.paymentTermLabel,
    paymentAmountCents: m.paymentAmountCents,
    sourceChapter: m.sourceChapter,
    valueCents: m.valueCents,
    tasks: tasks.filter((t) => t.milestoneId === m.id).map(serializeTask),
  };
}

function serializeTask(t: typeof projectTasksTable.$inferSelect) {
  return { id: t.id, milestoneId: t.milestoneId, title: t.title, description: t.description, status: t.status, dueDate: toIsoDate(t.dueDate), sortOrder: t.sortOrder };
}

function serializeBudgetLine(b: CostBudgetLine) {
  return { id: b.id, category: b.category, chapterRef: b.chapterRef, label: b.label, plannedCents: b.plannedCents, sortOrder: b.sortOrder };
}

function serializeChangeOrder(co: ChangeOrder, docStatus: string | null | undefined) {
  return {
    id: co.id,
    number: co.number,
    title: co.title,
    description: co.description,
    items: co.items,
    subtotalCents: co.subtotalCents,
    taxCents: co.taxCents,
    totalCents: co.totalCents,
    scheduleDeltaDays: co.scheduleDeltaDays,
    status: changeOrderStatusFromDocument(co, docStatus),
    documentContractId: co.documentContractId,
    signedAt: iso(co.signedAt),
    appliedAt: iso(co.appliedAt),
    createdAt: co.createdAt.toISOString(),
  };
}

export function serializeProject(p: typeof projectsTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    setupStatus: p.setupStatus,
    setupProposal: p.setupProposal,
    setupConfirmedAt: iso(p.setupConfirmedAt),
    quoteId: p.quoteId,
    clientId: p.clientId,
    contractId: p.contractId,
    address: p.address,
    province: p.province,
    latitude: p.latitude ? Number(p.latitude) : null,
    longitude: p.longitude ? Number(p.longitude) : null,
    geofenceRadiusMeters: p.geofenceRadiusMeters,
    contractValueCents: p.contractValueCents,
    changeOrdersCents: p.changeOrdersCents,
    totalValueCents: p.contractValueCents + p.changeOrdersCents,
    plannedStart: toIsoDate(p.plannedStart ?? p.startDate),
    plannedEnd: toIsoDate(p.plannedEnd ?? p.endDate),
    progressPercent: p.progressPercent,
    completedAt: iso(p.completedAt),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    archivedAt: iso(p.archivedAt),
  };
}

// ── List ─────────────────────────────────────────────────────────────────────

// GET /api/jobs
router.get("/jobs", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const projects = await db.select().from(projectsTable).where(and(eq(projectsTable.userId, userId), isNull(projectsTable.archivedAt))).orderBy(desc(projectsTable.createdAt)).limit(300);
    const ids = projects.map((p) => p.id);
    const clientIds = [...new Set(projects.map((p) => p.clientId).filter((x): x is string => !!x))];
    const clients: { id: string; name: string }[] = clientIds.length ? await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(inArray(clientsTable.id, clientIds)) : [];
    const milestones: Milestone[] = ids.length ? await db.select().from(milestonesTable).where(inArray(milestonesTable.projectId, ids)).orderBy(asc(milestonesTable.sortOrder)) : [];
    const assignments: { projectId: string }[] = ids.length ? await db.select({ projectId: projectAssignmentsTable.projectId }).from(projectAssignmentsTable).where(inArray(projectAssignmentsTable.projectId, ids)) : [];
    const clientName = new Map(clients.map((c) => [c.id, c.name]));
    const items = projects.map((p) => {
      const ms = milestones.filter((m) => m.projectId === p.id);
      const next = ms.find((m) => m.status === "planned" || m.status === "in_progress");
      return {
        ...serializeProject(p),
        clientName: p.clientId ? (clientName.get(p.clientId) ?? null) : null,
        milestoneCount: ms.length,
        milestonesDone: ms.filter((m) => m.status === "completed").length,
        nextMilestone: next ? { id: next.id, title: next.title, plannedEnd: toIsoDate(next.plannedEnd) } : null,
        crewCount: assignments.filter((a) => a.projectId === p.id).length,
      };
    });
    res.json({ items });
  } catch (err) {
    req.log.error({ err }, "Error listing jobs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs — manual job (no contract). Used by the quote page "Start job" button.
router.post("/jobs", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireJobsFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Jobs require the Pro plan" });
      return;
    }
    const body = z
      .object({
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        quoteId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        address: z.string().max(300).optional(),
        province: z.string().max(2).optional(),
        plannedStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        plannedEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        contractValueCents: z.number().int().min(0).optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    if (d.quoteId) {
      const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.quoteId, d.quoteId), eq(projectsTable.userId, userId)));
      if (existing) {
        res.status(200).json({ job: serializeProject(existing), created: false });
        return;
      }
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
    req.log.error({ err }, "Error creating job");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Detail ───────────────────────────────────────────────────────────────────

async function loadJobDetail(userId: string, id: string) {
  const project = await ownedProject(userId, id);
  if (!project) return null;
  const [milestones, tasks, budget, changeOrders, costs, assignments, client, contract, quote, timeEntries, usage, invoices] = await Promise.all([
    db.select().from(milestonesTable).where(eq(milestonesTable.projectId, id)).orderBy(asc(milestonesTable.sortOrder)),
    db.select().from(projectTasksTable).where(eq(projectTasksTable.projectId, id)).orderBy(asc(projectTasksTable.sortOrder), asc(projectTasksTable.createdAt)),
    db.select().from(costBudgetLinesTable).where(eq(costBudgetLinesTable.projectId, id)).orderBy(asc(costBudgetLinesTable.sortOrder)),
    db
      .select({ co: changeOrdersTable, docStatus: contractsTable.status })
      .from(changeOrdersTable)
      .leftJoin(contractsTable, eq(contractsTable.id, changeOrdersTable.documentContractId))
      .where(eq(changeOrdersTable.projectId, id))
      .orderBy(asc(changeOrdersTable.createdAt)),
    costSummary(id),
    db
      .select({
        id: projectAssignmentsTable.id,
        collaboratorId: projectAssignmentsTable.collaboratorId,
        roleInProject: projectAssignmentsTable.roleInProject,
        collaboratorName: collaboratorsTable.name,
        collaboratorRole: collaboratorsTable.role,
        collaboratorHourlyRate: collaboratorsTable.hourlyRate,
        workerType: collaboratorsTable.workerType,
        active: collaboratorsTable.active,
      })
      .from(projectAssignmentsTable)
      .innerJoin(collaboratorsTable, eq(projectAssignmentsTable.collaboratorId, collaboratorsTable.id))
      .where(eq(projectAssignmentsTable.projectId, id)),
    project.clientId ? db.select().from(clientsTable).where(eq(clientsTable.id, project.clientId)).then((r) => r[0] ?? null) : Promise.resolve(null),
    project.contractId ? db.select().from(contractsTable).where(eq(contractsTable.id, project.contractId)).then((r) => r[0] ?? null) : Promise.resolve(null),
    project.quoteId ? db.select({ id: quotesTable.id, number: quotesTable.numeroPreventivoData, status: quotesTable.status }).from(quotesTable).where(eq(quotesTable.id, project.quoteId)).then((r) => r[0] ?? null) : Promise.resolve(null),
    db
      .select({ e: timeEntriesTable, workerName: collaboratorsTable.name })
      .from(timeEntriesTable)
      .innerJoin(collaboratorsTable, eq(collaboratorsTable.id, timeEntriesTable.workerId))
      .where(eq(timeEntriesTable.projectId, id))
      .orderBy(desc(timeEntriesTable.date), desc(timeEntriesTable.createdAt))
      .limit(200),
    db
      .select({ u: equipmentUsageTable, equipmentName: equipmentTable.name })
      .from(equipmentUsageTable)
      .innerJoin(equipmentTable, eq(equipmentTable.id, equipmentUsageTable.equipmentId))
      .where(eq(equipmentUsageTable.projectId, id))
      .orderBy(desc(equipmentUsageTable.date), desc(equipmentUsageTable.createdAt))
      .limit(200),
    invoicesForProject(id),
  ]);
  const milestoneTitle = new Map(milestones.map((m) => [m.id, m.title]));

  return {
    job: {
      ...serializeProject(project),
      client: client ? { id: client.id, name: client.name, email: client.email, phone: client.phone } : null,
      contract: contract
        ? {
            id: contract.id,
            contractNumber: contract.contractNumber,
            status: contract.status,
            signedAt: iso(contract.signedAt),
            hasSignedPdf: !!contract.signedPdfUrl,
            language: contract.language,
            paymentSchedule: contract.variables.paymentSchedule,
            total: contract.variables.total,
            subtotal: contract.variables.subtotal,
            customerName: contract.variables.customer.name,
          }
        : null,
      quote: quote ? { id: quote.id, number: quote.number, status: quote.status } : null,
    },
    milestones: milestones.map((m) => serializeMilestone(m, tasks)),
    unassignedTasks: tasks.filter((t) => !t.milestoneId).map(serializeTask),
    budget: budget.map(serializeBudgetLine),
    budgetTotalCents: budget.reduce((s, b) => s + b.plannedCents, 0),
    changeOrders: changeOrders.map((r) => serializeChangeOrder(r.co, r.docStatus)),
    costs: {
      totalCents: costs.confirmedCents,
      pendingCents: costs.pendingCents,
      pendingCount: costs.pendingCount,
      byCategory: costs.byCategory,
      entries: costs.entries.map((c) => serializeCostEntry(c, { milestoneTitle: c.milestoneId ? (milestoneTitle.get(c.milestoneId) ?? null) : null })),
    },
    timeEntries: timeEntries.map((r) => serializeTimeEntry(r.e, { workerName: r.workerName, projectName: project.name, milestoneTitle: r.e.milestoneId ? (milestoneTitle.get(r.e.milestoneId) ?? null) : null })),
    equipmentUsage: usage.map((r) => serializeUsage(r.u, { equipmentName: r.equipmentName, projectName: project.name })),
    assignments,
    invoices: invoices.map((i) => serializeInvoice(i, { projectName: project.name })),
    invoiceTotals: projectInvoiceTotals(invoices),
  };
}

// GET /api/jobs/:id
router.get("/jobs/:id", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const detail = await loadJobDetail(getUserId(res), req.params.id as string);
    if (!detail) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Error fetching job");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/jobs/:id
router.put("/jobs/:id", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = z
      .object({
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(4000).optional(),
        status: z.enum(PROJECT_STATUSES).optional(),
        address: z.string().max(300).optional(),
        plannedStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        plannedEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        contractValueCents: z.number().int().min(0).optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        geofenceRadiusMeters: z.number().int().min(50).max(5000).nullable().optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const updates: Partial<typeof projectsTable.$inferInsert> = {};
    if (d.name !== undefined) updates.name = d.name;
    if (d.description !== undefined) updates.description = d.description;
    if (d.address !== undefined) updates.address = d.address;
    if (d.latitude !== undefined) updates.latitude = d.latitude === null ? null : d.latitude.toFixed(6);
    if (d.longitude !== undefined) updates.longitude = d.longitude === null ? null : d.longitude.toFixed(6);
    if (d.geofenceRadiusMeters !== undefined) updates.geofenceRadiusMeters = d.geofenceRadiusMeters;
    if (d.status !== undefined) {
      updates.status = d.status;
      updates.completedAt = d.status === "completed" ? (project.completedAt ?? new Date()) : null;
    }
    if (d.plannedStart !== undefined) { updates.plannedStart = parseIsoDate(d.plannedStart); updates.startDate = updates.plannedStart; }
    if (d.plannedEnd !== undefined) { updates.plannedEnd = parseIsoDate(d.plannedEnd); updates.endDate = updates.plannedEnd; }
    // Contract value is locked once a signed contract backs the job.
    if (d.contractValueCents !== undefined && !project.contractId) { updates.contractValueCents = d.contractValueCents; updates.budget = d.contractValueCents; }

    const [updated] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, project.id)).returning();
    if (d.status === "completed" && project.status !== "completed") {
      await raiseAutomation({ event: "job.completed", userId, entityType: "project", entityId: project.id });
    }
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "project", entityId: project.id, action: "updated", diff: d });
    res.json({ job: serializeProject(updated!) });
  } catch (err) {
    req.log.error({ err }, "Error updating job");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/jobs/:id — only jobs without a signed contract behind them
router.delete("/jobs/:id", requireAuth, requirePermission("jobs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (project.contractId) {
      res.status(409).json({ error: "LOCKED", message: "Jobs created from a signed contract cannot be deleted. Mark the job as completed or suspended instead." });
      return;
    }
    const projectMilestoneIds = (await db.select({ id: milestonesTable.id }).from(milestonesTable).where(eq(milestonesTable.projectId, project.id))).map((m) => m.id);
    await removeMilestonesFromCalendar(userId, projectMilestoneIds).catch((err) => req.log.error({ err }, "Calendar cleanup failed for deleted job"));
    await db.delete(projectsTable).where(eq(projectsTable.id, project.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting job");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs/:id/archive
router.post("/jobs/:id/archive", requireAuth, requirePermission("jobs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    const [updated] = await db
      .update(projectsTable)
      .set({ archivedAt: new Date(), archivedByName: getUserName(res) })
      .where(eq(projectsTable.id, project.id))
      .returning();
    res.json({ job: serializeProject(updated!) });
  } catch (err) {
    req.log.error({ err }, "Error archiving job");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs/:id/restore
router.post("/jobs/:id/restore", requireAuth, requirePermission("jobs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    const [updated] = await db
      .update(projectsTable)
      .set({ archivedAt: null, archivedByName: null })
      .where(eq(projectsTable.id, project.id))
      .returning();
    res.json({ job: serializeProject(updated!) });
  } catch (err) {
    req.log.error({ err }, "Error restoring job");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Setup review ─────────────────────────────────────────────────────────────

const MilestoneEditSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  plannedStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  plannedEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  paymentTermId: z.string().max(100).nullable().optional(),
  valueCents: z.number().int().min(0).optional(),
});

const BudgetEditSchema = z.object({
  category: z.enum(COST_CATEGORIES),
  label: z.string().max(200).optional(),
  plannedCents: z.number().int().min(0),
});

/**
 * Replaces the milestone list with the edited one (keeps ids where given so
 * tasks stay attached), rewrites the budget, and optionally confirms setup.
 */
async function applySetupEdits(userId: string, project: typeof projectsTable.$inferSelect, edits: { milestones?: z.infer<typeof MilestoneEditSchema>[]; budget?: z.infer<typeof BudgetEditSchema>[]; name?: string; plannedStart?: string | null }) {
  const contract = project.contractId ? (await db.select().from(contractsTable).where(eq(contractsTable.id, project.contractId)))[0] : undefined;
  const terms = contract?.variables.paymentSchedule.terms ?? [];
  const total = contract?.variables.total ?? project.contractValueCents / 100;

  // Calendar cleanup for milestones about to be dropped has to happen before the delete below,
  // since `calendar_synced_events` rows cascade-delete with their milestone.
  if (edits.milestones) {
    const existingBefore = await db.select().from(milestonesTable).where(eq(milestonesTable.projectId, project.id));
    const keepIdsBefore = new Set(edits.milestones.map((m) => m.id).filter((x): x is string => !!x));
    const toDeleteBefore = existingBefore.filter((m) => !keepIdsBefore.has(m.id)).map((m) => m.id);
    if (toDeleteBefore.length) {
      await removeMilestonesFromCalendar(userId, toDeleteBefore).catch((err) => logger.error({ err }, "Calendar cleanup failed for dropped milestones"));
    }
  }

  await db.transaction(async (tx) => {
    if (edits.milestones) {
      const existing = await tx.select().from(milestonesTable).where(eq(milestonesTable.projectId, project.id));
      const keepIds = new Set(edits.milestones.map((m) => m.id).filter((x): x is string => !!x));
      const toDelete = existing.filter((m) => !keepIds.has(m.id)).map((m) => m.id);
      if (toDelete.length) {
        await tx.update(projectTasksTable).set({ milestoneId: null }).where(inArray(projectTasksTable.milestoneId, toDelete));
        await tx.delete(milestonesTable).where(inArray(milestonesTable.id, toDelete));
      }
      const usedKeys = new Set<string>();
      for (let i = 0; i < edits.milestones.length; i++) {
        const m = edits.milestones[i]!;
        const prev = m.id ? existing.find((e) => e.id === m.id) : undefined;
        const term = m.paymentTermId ? terms.find((t) => t.id === m.paymentTermId) : undefined;
        let key = m.key ?? prev?.key ?? `m-${i + 1}`;
        while (usedKeys.has(key)) key = `${key}-${i + 1}`;
        usedKeys.add(key);
        const values = {
          projectId: project.id,
          userId,
          key,
          title: m.title,
          description: m.description ?? prev?.description ?? "",
          sortOrder: i,
          plannedStart: m.plannedStart !== undefined ? parseIsoDate(m.plannedStart) : (prev?.plannedStart ?? null),
          plannedEnd: m.plannedEnd !== undefined ? parseIsoDate(m.plannedEnd) : (prev?.plannedEnd ?? null),
          paymentTermId: m.paymentTermId === undefined ? (prev?.paymentTermId ?? null) : (term?.id ?? null),
          paymentTermLabel: m.paymentTermId === undefined ? (prev?.paymentTermLabel ?? null) : (term?.label ?? null),
          paymentAmountCents: m.paymentTermId === undefined ? (prev?.paymentAmountCents ?? null) : term ? Math.round((term.amountType === "percent" ? (total * term.value) / 100 : term.value) * 100) : null,
          valueCents: m.valueCents ?? prev?.valueCents ?? 0,
          sourceChapter: prev?.sourceChapter ?? null,
        };
        if (prev) await tx.update(milestonesTable).set(values).where(eq(milestonesTable.id, prev.id));
        else await tx.insert(milestonesTable).values(values);
      }
    }
    if (edits.budget) {
      await tx.delete(costBudgetLinesTable).where(eq(costBudgetLinesTable.projectId, project.id));
      if (edits.budget.length) {
        await tx.insert(costBudgetLinesTable).values(edits.budget.map((b, i) => ({ projectId: project.id, category: b.category, label: b.label ?? "", plannedCents: b.plannedCents, sortOrder: i, chapterRef: null })));
      }
    }
    const projectUpdates: Partial<typeof projectsTable.$inferInsert> = {};
    if (edits.name) projectUpdates.name = edits.name;
    if (edits.plannedStart !== undefined) { projectUpdates.plannedStart = parseIsoDate(edits.plannedStart); projectUpdates.startDate = projectUpdates.plannedStart; }
    if (edits.milestones) {
      const ends = edits.milestones.map((m) => parseIsoDate(m.plannedEnd ?? null)).filter((d): d is Date => !!d);
      const starts = edits.milestones.map((m) => parseIsoDate(m.plannedStart ?? null)).filter((d): d is Date => !!d);
      if (ends.length) { projectUpdates.plannedEnd = new Date(Math.max(...ends.map((d) => d.getTime()))); projectUpdates.endDate = projectUpdates.plannedEnd; }
      if (starts.length && edits.plannedStart === undefined) { projectUpdates.plannedStart = new Date(Math.min(...starts.map((d) => d.getTime()))); projectUpdates.startDate = projectUpdates.plannedStart; }
    }
    if (Object.keys(projectUpdates).length) await tx.update(projectsTable).set(projectUpdates).where(eq(projectsTable.id, project.id));
  });

  if (edits.milestones) {
    const jobName = edits.name ?? project.name;
    const current = await db.select().from(milestonesTable).where(eq(milestonesTable.projectId, project.id));
    for (const m of current) {
      syncMilestoneToCalendar(userId, m, jobName).catch((err) => logger.error({ err }, "Calendar sync failed for milestone setup edit"));
    }
  }
}

const SetupBody = z.object({
  name: z.string().min(1).max(200).optional(),
  plannedStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  milestones: z.array(MilestoneEditSchema).max(40).optional(),
  budget: z.array(BudgetEditSchema).max(40).optional(),
});

// PUT /api/jobs/:id/setup — save edits on the review screen without confirming
router.put("/jobs/:id/setup", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = SetupBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    await applySetupEdits(userId, project, body.data);
    res.json(await loadJobDetail(userId, project.id));
  } catch (err) {
    req.log.error({ err }, "Error saving job setup");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs/:id/setup/confirm — "Looks good, start the job"
router.post("/jobs/:id/setup/confirm", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = SetupBody.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    await applySetupEdits(userId, project, body.data);
    await db.update(projectsTable).set({ setupStatus: "confirmed", setupConfirmedAt: new Date(), status: project.status === "planning" ? "active" : project.status }).where(eq(projectsTable.id, project.id));
    await recomputeProgress(project.id);
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "project", entityId: project.id, action: "setup_confirmed" });
    res.json(await loadJobDetail(userId, project.id));
  } catch (err) {
    req.log.error({ err }, "Error confirming job setup");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs/:id/setup/regenerate — rebuild the proposal from the contract (discards edits)
router.post("/jobs/:id/setup/regenerate", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!project.contractId) {
      res.status(409).json({ error: "NO_CONTRACT", message: "Only jobs created from a signed contract can be regenerated." });
      return;
    }
    if (project.setupStatus === "confirmed") {
      res.status(409).json({ error: "CONFIRMED", message: "The setup has already been confirmed." });
      return;
    }
    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, project.contractId));
    if (!contract || contract.status !== "signed") {
      res.status(409).json({ error: "NO_CONTRACT" });
      return;
    }
    // Force a rebuild: wiping the milestones makes setupJobFromContract regenerate.
    const staleMilestoneIds = (await db.select({ id: milestonesTable.id }).from(milestonesTable).where(eq(milestonesTable.projectId, project.id))).map((m) => m.id);
    await removeMilestonesFromCalendar(userId, staleMilestoneIds).catch((err) => req.log.error({ err }, "Calendar cleanup failed for regenerated setup"));
    await db.delete(milestonesTable).where(eq(milestonesTable.projectId, project.id));
    await setupJobFromContract(contract);
    const rebuilt = await db.select().from(milestonesTable).where(eq(milestonesTable.projectId, project.id));
    for (const m of rebuilt) {
      syncMilestoneToCalendar(userId, m, project.name).catch((err) => req.log.error({ err }, "Calendar sync failed for regenerated milestone"));
    }
    res.json(await loadJobDetail(userId, project.id));
  } catch (err) {
    req.log.error({ err }, "Error regenerating job setup");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Milestones ───────────────────────────────────────────────────────────────

async function ownedMilestone(userId: string, projectId: string, milestoneId: string) {
  const project = await ownedProject(userId, projectId);
  if (!project) return null;
  const [m] = await db.select().from(milestonesTable).where(and(eq(milestonesTable.id, milestoneId), eq(milestonesTable.projectId, projectId)));
  return m ? { project, milestone: m } : null;
}

// POST /api/jobs/:id/milestones
router.post("/jobs/:id/milestones", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = MilestoneEditSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(milestonesTable).where(eq(milestonesTable.projectId, project.id));
    const [m] = await db
      .insert(milestonesTable)
      .values({
        projectId: project.id,
        userId,
        key: body.data.key ?? `m-${Date.now().toString(36)}`,
        title: body.data.title,
        description: body.data.description ?? "",
        sortOrder: Number(count ?? 0),
        plannedStart: parseIsoDate(body.data.plannedStart ?? null),
        plannedEnd: parseIsoDate(body.data.plannedEnd ?? null),
        valueCents: body.data.valueCents ?? 0,
      })
      .returning();
    syncMilestoneToCalendar(userId, m!, project.name).catch((err) => req.log.error({ err }, "Calendar sync failed for new milestone"));
    res.status(201).json({ milestone: serializeMilestone(m!) });
  } catch (err) {
    req.log.error({ err }, "Error creating milestone");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/jobs/:id/milestones/:mid
router.put("/jobs/:id/milestones/:mid", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const owned = await ownedMilestone(userId, req.params.id as string, req.params.mid as string);
    if (!owned) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = MilestoneEditSchema.partial().extend({ status: z.enum(MILESTONE_STATUSES).optional(), sortOrder: z.number().int().min(0).optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const updates: Partial<typeof milestonesTable.$inferInsert> = {};
    if (d.title !== undefined) updates.title = d.title;
    if (d.description !== undefined) updates.description = d.description;
    if (d.plannedStart !== undefined) updates.plannedStart = parseIsoDate(d.plannedStart);
    if (d.plannedEnd !== undefined) updates.plannedEnd = parseIsoDate(d.plannedEnd);
    if (d.valueCents !== undefined) updates.valueCents = d.valueCents;
    if (d.sortOrder !== undefined) updates.sortOrder = d.sortOrder;
    if (d.status !== undefined) {
      updates.status = d.status;
      if (d.status === "in_progress" && !owned.milestone.actualStart) updates.actualStart = new Date();
      if (d.status === "completed") { updates.actualEnd = owned.milestone.actualEnd ?? new Date(); if (!owned.milestone.actualStart) updates.actualStart = new Date(); }
      if (d.status === "planned") { updates.actualStart = null; updates.actualEnd = null; }
    }
    const [m] = await db.update(milestonesTable).set(updates).where(eq(milestonesTable.id, owned.milestone.id)).returning();
    const progress = await recomputeProgress(owned.project.id);
    if (d.status === "completed" && owned.milestone.status !== "completed") {
      await raiseAutomation({ event: "milestone.completed", userId, entityType: "milestone", entityId: m!.id, payload: { projectId: owned.project.id } });
    }
    syncMilestoneToCalendar(userId, m!, owned.project.name).catch((err) => req.log.error({ err }, "Calendar sync failed for updated milestone"));
    const tasks = await db.select().from(projectTasksTable).where(eq(projectTasksTable.milestoneId, m!.id));
    res.json({ milestone: serializeMilestone(m!, tasks), progressPercent: progress });
  } catch (err) {
    req.log.error({ err }, "Error updating milestone");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/jobs/:id/milestones/:mid
router.delete("/jobs/:id/milestones/:mid", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const owned = await ownedMilestone(userId, req.params.id as string, req.params.mid as string);
    if (!owned) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await removeMilestoneFromCalendar(userId, owned.milestone.id).catch((err) => req.log.error({ err }, "Calendar cleanup failed for deleted milestone"));
    await db.update(projectTasksTable).set({ milestoneId: null }).where(eq(projectTasksTable.milestoneId, owned.milestone.id));
    await db.delete(milestonesTable).where(eq(milestonesTable.id, owned.milestone.id));
    await recomputeProgress(owned.project.id);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting milestone");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Tasks ────────────────────────────────────────────────────────────────────

router.post("/jobs/:id/tasks", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = z.object({ title: z.string().min(1).max(300), milestoneId: z.string().uuid().nullable().optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const [t] = await db.insert(projectTasksTable).values({ projectId: project.id, title: body.data.title, milestoneId: body.data.milestoneId ?? null, dueDate: parseIsoDate(body.data.dueDate ?? null), status: "todo" }).returning();
    res.status(201).json({ task: serializeTask(t!) });
  } catch (err) {
    req.log.error({ err }, "Error creating task");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/jobs/:id/tasks/:tid", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = z.object({ title: z.string().min(1).max(300).optional(), status: z.enum(["todo", "in_progress", "done"]).optional(), milestoneId: z.string().uuid().nullable().optional(), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const updates: Partial<typeof projectTasksTable.$inferInsert> = {};
    if (body.data.title !== undefined) updates.title = body.data.title;
    if (body.data.status !== undefined) updates.status = body.data.status;
    if (body.data.milestoneId !== undefined) updates.milestoneId = body.data.milestoneId;
    if (body.data.dueDate !== undefined) updates.dueDate = parseIsoDate(body.data.dueDate);
    const [t] = await db.update(projectTasksTable).set(updates).where(and(eq(projectTasksTable.id, req.params.tid as string), eq(projectTasksTable.projectId, project.id))).returning();
    if (!t) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json({ task: serializeTask(t) });
  } catch (err) {
    req.log.error({ err }, "Error updating task");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/jobs/:id/tasks/:tid", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db.delete(projectTasksTable).where(and(eq(projectTasksTable.id, req.params.tid as string), eq(projectTasksTable.projectId, project.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting task");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Budget ───────────────────────────────────────────────────────────────────

router.put("/jobs/:id/budget", requireAuth, requirePermission("jobs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = z.object({ lines: z.array(BudgetEditSchema).max(40) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    await applySetupEdits(userId, project, { budget: body.data.lines });
    const lines = await db.select().from(costBudgetLinesTable).where(eq(costBudgetLinesTable.projectId, project.id)).orderBy(asc(costBudgetLinesTable.sortOrder));
    res.json({ budget: lines.map(serializeBudgetLine), budgetTotalCents: lines.reduce((s, b) => s + b.plannedCents, 0) });
  } catch (err) {
    req.log.error({ err }, "Error saving budget");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Change orders ────────────────────────────────────────────────────────────

// zod v3 mirror of changeOrderItemSchema (the db package uses zod/v4).
const ChangeOrderItemBody = z.object({
  descrizione: z.string().min(1).max(500),
  um: z.string().max(20).default(""),
  quantita: z.number().default(1),
  prezzoUnitario: z.number(),
  totale: z.number(),
});

const ChangeOrderBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(6000).default(""),
  items: z.array(ChangeOrderItemBody).min(1).max(50),
  scheduleDeltaDays: z.number().int().min(-365).max(365).default(0),
});

router.post("/jobs/:id/change-orders", requireAuth, requirePermission("jobs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireJobsFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Change orders require the Pro plan" });
      return;
    }
    const body = ChangeOrderBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const { changeOrder, documentContractId } = await createChangeOrder({ userId, projectId: req.params.id as string, ...body.data });
    res.status(201).json({ changeOrder: serializeChangeOrder(changeOrder, "draft"), documentContractId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    if (message === "Job not found") { res.status(404).json({ error: message }); return; }
    if (message === "NO_CONTRACT") { res.status(409).json({ error: "NO_CONTRACT", message: "Change orders need a signed contract behind the job." }); return; }
    req.log.error({ err }, "Error creating change order");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/jobs/:id/change-orders/:coId", requireAuth, requirePermission("jobs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = ChangeOrderBody.partial().safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const co = await updateChangeOrder({ userId, changeOrderId: req.params.coId as string, ...body.data });
    res.json({ changeOrder: serializeChangeOrder(co, "draft") });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    if (message === "LOCKED") { res.status(409).json({ error: "LOCKED", message: "Only draft change orders can be edited." }); return; }
    if (message === "Change order not found") { res.status(404).json({ error: message }); return; }
    req.log.error({ err }, "Error updating change order");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE — drafts only (sent/signed ones are voided through the contract)
router.delete("/jobs/:id/change-orders/:coId", requireAuth, requirePermission("jobs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [co] = await db.select().from(changeOrdersTable).where(and(eq(changeOrdersTable.id, req.params.coId as string), eq(changeOrdersTable.projectId, project.id)));
    if (!co) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [doc] = co.documentContractId ? await db.select().from(contractsTable).where(eq(contractsTable.id, co.documentContractId)) : [];
    if (doc && doc.status !== "draft") {
      res.status(409).json({ error: "LOCKED", message: "Only draft change orders can be deleted. Void the sent one instead." });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.delete(changeOrdersTable).where(eq(changeOrdersTable.id, co.id));
      if (doc) await tx.delete(contractsTable).where(eq(contractsTable.id, doc.id));
    });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting change order");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Costs, time entries and equipment usage live in routes/costs.ts and routes/team.ts (Phase 3).

// ── Photos (Phase 10) ─────────────────────────────────────────────────────────
// Job photo gallery: upload tied to a job and optionally a milestone, stored
// privately in Supabase Storage exactly like receipts (routes/costs.ts). A
// "share" send emails/WhatsApps time-limited signed links to the customer —
// it doesn't change where the file lives or make it public.

function serializePhoto(p: typeof jobPhotosTable.$inferSelect) {
  return {
    id: p.id,
    projectId: p.projectId,
    milestoneId: p.milestoneId,
    fileName: p.fileName,
    fileSize: p.fileSize,
    mimeType: p.mimeType,
    caption: p.caption,
    sortOrder: p.sortOrder,
    sharedAt: p.sharedAt ? p.sharedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/jobs/:id/photos", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const photos = await db.select().from(jobPhotosTable).where(eq(jobPhotosTable.projectId, project.id)).orderBy(asc(jobPhotosTable.sortOrder), asc(jobPhotosTable.createdAt));
    res.json({ photos: photos.map(serializePhoto) });
  } catch (err) {
    req.log.error({ err }, "Error listing job photos");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/jobs/:id/photos",
  requireAuth,
  requirePermission("jobs", "edit"),
  (req, res, next) => {
    photoUpload.single("file")(req, res, (err) => {
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
      const project = await ownedProject(userId, req.params.id as string);
      if (!project) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }
      const milestoneIdRaw = typeof req.body?.milestoneId === "string" && req.body.milestoneId ? req.body.milestoneId : null;
      if (milestoneIdRaw) {
        const [m] = await db.select().from(milestonesTable).where(and(eq(milestonesTable.id, milestoneIdRaw), eq(milestonesTable.projectId, project.id)));
        if (!m) {
          res.status(404).json({ error: "Milestone not found" });
          return;
        }
      }
      const caption = typeof req.body?.caption === "string" ? req.body.caption.slice(0, 500) : "";
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" }[file.mimetype] ?? "bin";
      const subPath = `job-photos/${userId}/${project.id}/${randomUUID()}.${ext}`;
      const fileUrl = await objectStorage.uploadObjectBuffer({ subPath, buffer: file.buffer, contentType: file.mimetype });
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(jobPhotosTable).where(eq(jobPhotosTable.projectId, project.id));
      const [photo] = await db
        .insert(jobPhotosTable)
        .values({
          userId,
          projectId: project.id,
          milestoneId: milestoneIdRaw,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileUrl,
          caption,
          sortOrder: Number(count ?? 0),
        })
        .returning();
      res.status(201).json({ photo: serializePhoto(photo!) });
    } catch (err) {
      req.log.error({ err }, "Error uploading job photo");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.get("/jobs/:id/photos/:photoId/file", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [photo] = await db.select().from(jobPhotosTable).where(and(eq(jobPhotosTable.id, req.params.photoId as string), eq(jobPhotosTable.projectId, project.id)));
    if (!photo) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const file = await objectStorage.downloadPrivateObject(photo.fileUrl.replace(/^\/objects\//, ""));
    res.status(file.status);
    file.headers.forEach((v, k) => res.setHeader(k, v));
    if (file.body) Readable.fromWeb(file.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    req.log.error({ err }, "Error fetching job photo");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/jobs/:id/photos/:photoId", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = z.object({ caption: z.string().max(500).optional(), milestoneId: z.string().uuid().nullable().optional(), sortOrder: z.number().int().min(0).optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const [existing] = await db.select().from(jobPhotosTable).where(and(eq(jobPhotosTable.id, req.params.photoId as string), eq(jobPhotosTable.projectId, project.id)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [photo] = await db
      .update(jobPhotosTable)
      .set({
        ...(body.data.caption !== undefined && { caption: body.data.caption }),
        ...(body.data.milestoneId !== undefined && { milestoneId: body.data.milestoneId }),
        ...(body.data.sortOrder !== undefined && { sortOrder: body.data.sortOrder }),
      })
      .where(eq(jobPhotosTable.id, existing.id))
      .returning();
    res.json({ photo: serializePhoto(photo!) });
  } catch (err) {
    req.log.error({ err }, "Error updating job photo");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/jobs/:id/photos/:photoId", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [photo] = await db.select().from(jobPhotosTable).where(and(eq(jobPhotosTable.id, req.params.photoId as string), eq(jobPhotosTable.projectId, project.id)));
    if (!photo) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await objectStorage.deleteObjectBuffer(photo.fileUrl.replace(/^\/objects\//, ""));
    await db.delete(jobPhotosTable).where(eq(jobPhotosTable.id, photo.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting job photo");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs/:id/photos/share — email/WhatsApp signed links to a set of
// photos to the job's client. Doesn't publish the photos; links expire.
router.post("/jobs/:id/photos/share", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!project.clientId) {
      res.status(409).json({ error: "NO_CLIENT", message: "This job has no client to share photos with." });
      return;
    }
    const body = z.object({ photoIds: z.array(z.string().uuid()).min(1).max(20) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const photos = await db.select().from(jobPhotosTable).where(and(inArray(jobPhotosTable.id, body.data.photoIds), eq(jobPhotosTable.projectId, project.id)));
    if (photos.length === 0) {
      res.status(404).json({ error: "No matching photos" });
      return;
    }
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, project.clientId));
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    if (client.marketingUnsubscribedAt) {
      res.status(409).json({ error: "UNSUBSCRIBED", message: "This client has unsubscribed from these messages." });
      return;
    }
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    if (!profile) {
      res.status(500).json({ error: "Business profile not found" });
      return;
    }
    const photoUrls = await Promise.all(
      photos.map((p) => objectStorage.getPresignedGetURL(p.fileUrl.replace(/^\/objects\//, ""), 30 * 24 * 60 * 60)),
    );
    const [wa] = await db.select().from(whatsappConnectionsTable).where(eq(whatsappConnectionsTable.userId, userId));
    const whatsappTemplateName = wa?.isEnabled ? (process.env.WHATSAPP_PHOTO_SHARE_TEMPLATE ?? null) : null;

    const result = await sendJobPhotoShare({ client, profile, photoUrls, whatsappTemplateName });
    if (!result.ok) {
      res.status(502).json({ error: "SEND_FAILED", reason: result.reason });
      return;
    }
    await db.update(jobPhotosTable).set({ sharedAt: new Date() }).where(inArray(jobPhotosTable.id, photos.map((p) => p.id)));
    await writeAudit({ userId, actorType: "user", entityType: "project", entityId: project.id, action: "photos_shared", diff: { channel: result.channel, photoIds: photos.map((p) => p.id) } });
    res.json({ success: true, channel: result.channel, count: photos.length });
  } catch (err) {
    req.log.error({ err }, "Error sharing job photos");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
