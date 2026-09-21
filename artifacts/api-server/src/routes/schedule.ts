import { Router } from "express";
import { z } from "zod";
import { db, scheduleBlocksTable, projectsTable, milestonesTable, collaboratorsTable, businessProfilesTable, hasFeature, minimumPlanFor, type ScheduleBlock } from "@workspace/db";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit } from "../lib/notifications.js";
import { syncBlockToCalendar, removeBlockFromCalendar } from "../calendar/sync.js";
import { findConflicts } from "../schedule/service.js";

const router = Router();

// ── Phase 75: schedule board ────────────────────────────────────────────────
// One window of blocks at a time (a day or a week), with the workers, the
// open jobs (+ their dated milestones, drawn as the overlay) and the conflict
// map computed server-side so every client — board, job page, worker page —
// agrees on what "double-booked" means. Gated on the Jobs feature (Pro+);
// workers only exist on Elite, so a Pro board is the "Unassigned" lane plus
// per-job blocks, which is still a calendar.

const MAX_WINDOW_DAYS = 62;
const MAX_BLOCK_HOURS = 24 * 14;

async function requireJobsFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "jobs")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("jobs") };
}

const isoInstant = z.string().datetime({ offset: true });

const BlockFields = z.object({
    projectId: z.string().uuid().nullable().optional(),
    milestoneId: z.string().uuid().nullable().optional(),
    collaboratorId: z.string().uuid().nullable().optional(),
    title: z.string().max(120).optional(),
    startsAt: isoInstant,
    endsAt: isoInstant,
    allDay: z.boolean().optional(),
    notes: z.string().max(2000).optional(),
});

const BlockBody = BlockFields
  .refine((b) => new Date(b.endsAt) > new Date(b.startsAt), { message: "endsAt must be after startsAt" })
  .refine((b) => new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime() <= MAX_BLOCK_HOURS * 3_600_000, { message: "A block cannot span more than two weeks" });

type BlockContext = {
  projects: Map<string, { id: string; name: string; address: string }>;
  milestones: Map<string, { id: string; title: string }>;
  workers: Map<string, { id: string; name: string }>;
};

function serializeBlock(b: ScheduleBlock, ctx: BlockContext, conflicts: Map<string, string[]>) {
  const project = b.projectId ? ctx.projects.get(b.projectId) : undefined;
  const worker = b.collaboratorId ? ctx.workers.get(b.collaboratorId) : undefined;
  const milestone = b.milestoneId ? ctx.milestones.get(b.milestoneId) : undefined;
  return {
    id: b.id,
    projectId: b.projectId,
    projectName: project?.name ?? null,
    projectAddress: project?.address ?? null,
    milestoneId: b.milestoneId,
    milestoneTitle: milestone?.title ?? null,
    collaboratorId: b.collaboratorId,
    collaboratorName: worker?.name ?? null,
    title: b.title,
    label: b.title || project?.name || null,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    allDay: b.allDay,
    notes: b.notes,
    reminderSentAt: b.reminderSentAt ? b.reminderSentAt.toISOString() : null,
    conflicts: conflicts.get(b.id) ?? [],
    updatedAt: b.updatedAt.toISOString(),
  };
}

/** Names for whatever a set of blocks references (jobs may be closed, workers deactivated — they still get a label). */
async function blockContext(userId: string, blocks: ScheduleBlock[]): Promise<BlockContext> {
  const ctx: BlockContext = { projects: new Map(), milestones: new Map(), workers: new Map() };
  const projectIds = [...new Set(blocks.map((b) => b.projectId).filter((x): x is string => !!x))];
  const milestoneIds = [...new Set(blocks.map((b) => b.milestoneId).filter((x): x is string => !!x))];
  const workerIds = [...new Set(blocks.map((b) => b.collaboratorId).filter((x): x is string => !!x))];
  if (projectIds.length) for (const p of await db.select({ id: projectsTable.id, name: projectsTable.name, address: projectsTable.address }).from(projectsTable).where(and(eq(projectsTable.userId, userId), inArray(projectsTable.id, projectIds)))) ctx.projects.set(p.id, p);
  if (milestoneIds.length) for (const m of await db.select({ id: milestonesTable.id, title: milestonesTable.title }).from(milestonesTable).where(and(eq(milestonesTable.userId, userId), inArray(milestonesTable.id, milestoneIds)))) ctx.milestones.set(m.id, m);
  if (workerIds.length) for (const w of await db.select({ id: collaboratorsTable.id, name: collaboratorsTable.name }).from(collaboratorsTable).where(and(eq(collaboratorsTable.userId, userId), inArray(collaboratorsTable.id, workerIds)))) ctx.workers.set(w.id, w);
  return ctx;
}

/** Blocks of one company overlapping [from, to), optionally on one job. */
async function blocksInWindow(userId: string, from: Date, to: Date, projectId?: string): Promise<ScheduleBlock[]> {
  const conds = [eq(scheduleBlocksTable.userId, userId), lt(scheduleBlocksTable.startsAt, to), gt(scheduleBlocksTable.endsAt, from)];
  if (projectId) conds.push(eq(scheduleBlocksTable.projectId, projectId));
  return db.select().from(scheduleBlocksTable).where(and(...conds)).orderBy(asc(scheduleBlocksTable.startsAt)).limit(2000);
}

/** One block + its conflicts, after a write: the conflict set is the blocks on the same worker overlapping it. */
async function respondWithBlock(userId: string, block: ScheduleBlock) {
  const neighbours = block.collaboratorId
    ? await db.select().from(scheduleBlocksTable).where(and(eq(scheduleBlocksTable.userId, userId), eq(scheduleBlocksTable.collaboratorId, block.collaboratorId), lt(scheduleBlocksTable.startsAt, block.endsAt), gt(scheduleBlocksTable.endsAt, block.startsAt)))
    : [block];
  const all = neighbours.some((n) => n.id === block.id) ? neighbours : [...neighbours, block];
  const ctx = await blockContext(userId, [block]);
  return serializeBlock(block, ctx, findConflicts(all));
}

/** Validates that the referenced job / milestone / worker belong to this company (and that the milestone is on that job). */
async function validateRefs(userId: string, body: { projectId?: string | null; milestoneId?: string | null; collaboratorId?: string | null }): Promise<string | null> {
  if (body.projectId) {
    const [p] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.id, body.projectId), eq(projectsTable.userId, userId)));
    if (!p) return "Unknown job";
  }
  if (body.milestoneId) {
    const [m] = await db.select({ id: milestonesTable.id, projectId: milestonesTable.projectId }).from(milestonesTable).where(and(eq(milestonesTable.id, body.milestoneId), eq(milestonesTable.userId, userId)));
    if (!m) return "Unknown milestone";
    if (body.projectId && m.projectId !== body.projectId) return "Milestone belongs to another job";
  }
  if (body.collaboratorId) {
    const [w] = await db.select({ id: collaboratorsTable.id }).from(collaboratorsTable).where(and(eq(collaboratorsTable.id, body.collaboratorId), eq(collaboratorsTable.userId, userId)));
    if (!w) return "Unknown worker";
  }
  return null;
}

function syncInBackground(userId: string, block: ScheduleBlock, ctx: BlockContext) {
  const jobName = block.projectId ? (ctx.projects.get(block.projectId)?.name ?? null) : null;
  const workerName = block.collaboratorId ? (ctx.workers.get(block.collaboratorId)?.name ?? null) : null;
  syncBlockToCalendar(userId, block, jobName, workerName).catch(() => undefined);
}

// GET /api/schedule?from=&to=&projectId=
router.get("/schedule", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireJobsFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "The schedule board requires the Pro plan" });
      return;
    }
    const q = z.object({ from: isoInstant, to: isoInstant, projectId: z.string().uuid().optional() }).safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "Invalid parameters", details: q.error });
      return;
    }
    const from = new Date(q.data.from);
    const to = new Date(q.data.to);
    if (to <= from || to.getTime() - from.getTime() > MAX_WINDOW_DAYS * 86_400_000) {
      res.status(400).json({ error: "Invalid window", message: `Ask for at most ${MAX_WINDOW_DAYS} days at a time.` });
      return;
    }

    const blocks = await blocksInWindow(userId, from, to, q.data.projectId);
    const ctx = await blockContext(userId, blocks);
    const conflicts = findConflicts(blocks);

    const workers = await db
      .select({ id: collaboratorsTable.id, name: collaboratorsTable.name, role: collaboratorsTable.role, hasPhone: collaboratorsTable.phone, hasEmail: collaboratorsTable.email })
      .from(collaboratorsTable)
      .where(and(eq(collaboratorsTable.userId, userId), eq(collaboratorsTable.active, true)))
      .orderBy(asc(collaboratorsTable.name));
    const jobs = await db
      .select({ id: projectsTable.id, name: projectsTable.name, address: projectsTable.address, status: projectsTable.status })
      .from(projectsTable)
      .where(and(eq(projectsTable.userId, userId), inArray(projectsTable.status, ["planning", "active"])))
      .orderBy(asc(projectsTable.name))
      .limit(200);
    const milestones = jobs.length
      ? await db
          .select({ id: milestonesTable.id, projectId: milestonesTable.projectId, title: milestonesTable.title, status: milestonesTable.status, plannedStart: milestonesTable.plannedStart, plannedEnd: milestonesTable.plannedEnd, sortOrder: milestonesTable.sortOrder })
          .from(milestonesTable)
          .where(inArray(milestonesTable.projectId, jobs.map((j) => j.id)))
          .orderBy(asc(milestonesTable.sortOrder))
      : [];

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      blocks: blocks.map((b) => serializeBlock(b, ctx, conflicts)),
      workers: workers.map((w) => ({ id: w.id, name: w.name, role: w.role, hasPhone: !!w.hasPhone, hasEmail: !!w.hasEmail })),
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        address: j.address,
        status: j.status,
        milestones: milestones.filter((m) => m.projectId === j.id).map((m) => ({ id: m.id, title: m.title, status: m.status, plannedStart: m.plannedStart ? m.plannedStart.toISOString().slice(0, 10) : null, plannedEnd: m.plannedEnd ? m.plannedEnd.toISOString().slice(0, 10) : null })),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error loading schedule");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/schedule/blocks
router.post("/schedule/blocks", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireJobsFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "The schedule board requires the Pro plan" });
      return;
    }
    const body = BlockBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const refError = await validateRefs(userId, body.data);
    if (refError) {
      res.status(400).json({ error: "INVALID_REFERENCE", message: refError });
      return;
    }
    const [block] = await db
      .insert(scheduleBlocksTable)
      .values({
        userId,
        projectId: body.data.projectId ?? null,
        milestoneId: body.data.milestoneId ?? null,
        collaboratorId: body.data.collaboratorId ?? null,
        title: (body.data.title ?? "").trim(),
        startsAt: new Date(body.data.startsAt),
        endsAt: new Date(body.data.endsAt),
        allDay: body.data.allDay ?? false,
        notes: (body.data.notes ?? "").trim(),
        createdByUserId: userId,
      })
      .returning();
    await writeAudit({ userId, actorType: "user", entityType: "schedule_block", entityId: block!.id, action: "created", diff: { projectId: block!.projectId, collaboratorId: block!.collaboratorId, startsAt: block!.startsAt, endsAt: block!.endsAt } });
    const out = await respondWithBlock(userId, block!);
    syncInBackground(userId, block!, await blockContext(userId, [block!]));
    res.status(201).json({ block: out });
  } catch (err) {
    req.log.error({ err }, "Error creating schedule block");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/schedule/blocks/:id — move, resize, reassign or edit. A time change
// clears reminder_sent_at so the worker hears about the new slot.
router.put("/schedule/blocks/:id", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [existing] = await db.select().from(scheduleBlocksTable).where(and(eq(scheduleBlocksTable.id, req.params.id as string), eq(scheduleBlocksTable.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = BlockFields.partial().safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const merged = {
      projectId: body.data.projectId === undefined ? existing.projectId : body.data.projectId,
      milestoneId: body.data.milestoneId === undefined ? existing.milestoneId : body.data.milestoneId,
      collaboratorId: body.data.collaboratorId === undefined ? existing.collaboratorId : body.data.collaboratorId,
    };
    // Changing the job drops a milestone that belonged to the old one.
    if (body.data.projectId !== undefined && body.data.projectId !== existing.projectId && body.data.milestoneId === undefined) merged.milestoneId = null;
    const refError = await validateRefs(userId, merged);
    if (refError) {
      res.status(400).json({ error: "INVALID_REFERENCE", message: refError });
      return;
    }
    const startsAt = body.data.startsAt ? new Date(body.data.startsAt) : existing.startsAt;
    const endsAt = body.data.endsAt ? new Date(body.data.endsAt) : existing.endsAt;
    if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > MAX_BLOCK_HOURS * 3_600_000) {
      res.status(400).json({ error: "Invalid parameters", message: "endsAt must be after startsAt and within two weeks" });
      return;
    }
    const moved = startsAt.getTime() !== existing.startsAt.getTime() || endsAt.getTime() !== existing.endsAt.getTime() || merged.collaboratorId !== existing.collaboratorId;
    const [block] = await db
      .update(scheduleBlocksTable)
      .set({
        ...merged,
        title: body.data.title === undefined ? existing.title : body.data.title.trim(),
        notes: body.data.notes === undefined ? existing.notes : body.data.notes.trim(),
        allDay: body.data.allDay ?? existing.allDay,
        startsAt,
        endsAt,
        ...(moved ? { reminderSentAt: null } : {}),
      })
      .where(eq(scheduleBlocksTable.id, existing.id))
      .returning();
    await writeAudit({ userId, actorType: "user", entityType: "schedule_block", entityId: block!.id, action: moved ? "moved" : "updated", diff: { from: { startsAt: existing.startsAt, endsAt: existing.endsAt, collaboratorId: existing.collaboratorId }, to: { startsAt, endsAt, collaboratorId: merged.collaboratorId } } });
    const out = await respondWithBlock(userId, block!);
    syncInBackground(userId, block!, await blockContext(userId, [block!]));
    res.json({ block: out });
  } catch (err) {
    req.log.error({ err }, "Error updating schedule block");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/schedule/blocks/:id
router.delete("/schedule/blocks/:id", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [existing] = await db.select().from(scheduleBlocksTable).where(and(eq(scheduleBlocksTable.id, req.params.id as string), eq(scheduleBlocksTable.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await removeBlockFromCalendar(userId, existing.id).catch((err) => req.log.error({ err }, "Calendar cleanup failed for deleted block"));
    await db.delete(scheduleBlocksTable).where(eq(scheduleBlocksTable.id, existing.id));
    await writeAudit({ userId, actorType: "user", entityType: "schedule_block", entityId: existing.id, action: "deleted", diff: { startsAt: existing.startsAt, endsAt: existing.endsAt, collaboratorId: existing.collaboratorId } });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting schedule block");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
