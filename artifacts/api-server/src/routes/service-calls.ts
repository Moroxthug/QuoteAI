import { Router } from "express";
import { z } from "zod";
import { db, clientsTable, collaboratorsTable, projectsTable, scheduleBlocksTable, serviceCallsTable, SERVICE_CALL_BILLING, SERVICE_CALL_CHANNELS, SERVICE_CALL_STATUSES, type ServiceCall } from "@workspace/db";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit } from "../lib/notifications.js";

// ── Pocket 126: warranty and service calls (ServiceCalls) ──────────────────────
// A call or visit on a finished job: what the client reported, whether it is under warranty (no charge) or billable, and the visit booked for it
// (a block on the schedule, so the crew sees it). Warranty is 12 months from the day the job finished until a job carries its own term.

const router = Router();
export const WARRANTY_MONTHS = 12;

function warrantyEnd(completedAt: Date): Date {
  const d = new Date(completedAt);
  d.setMonth(d.getMonth() + WARRANTY_MONTHS);
  return d;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

async function serialize(userId: string, rows: ServiceCall[]) {
  const projectIds = [...new Set(rows.map((r) => r.projectId))];
  const jobs = new Map<string, { name: string; clientName: string | null; completedAt: Date | null }>();
  if (projectIds.length) {
    for (const p of await db
      .select({ id: projectsTable.id, name: projectsTable.name, completedAt: projectsTable.completedAt, clientName: clientsTable.name })
      .from(projectsTable)
      .leftJoin(clientsTable, eq(clientsTable.id, projectsTable.clientId))
      .where(and(eq(projectsTable.userId, userId), inArray(projectsTable.id, projectIds)))) jobs.set(p.id, { name: p.name, clientName: p.clientName, completedAt: p.completedAt });
  }
  const workerIds = [...new Set(rows.map((r) => r.workerId).filter((x): x is string => !!x))];
  const workers = new Map<string, string>();
  if (workerIds.length) for (const w of await db.select({ id: collaboratorsTable.id, name: collaboratorsTable.name }).from(collaboratorsTable).where(and(eq(collaboratorsTable.userId, userId), inArray(collaboratorsTable.id, workerIds)))) workers.set(w.id, w.name);
  const now = Date.now();
  return rows.map((r) => {
    const j = jobs.get(r.projectId);
    const end = j?.completedAt ? warrantyEnd(j.completedAt) : null;
    return {
      id: r.id,
      projectId: r.projectId,
      jobName: j?.name ?? null,
      clientName: j?.clientName ?? null,
      jobDoneAt: iso(j?.completedAt ?? null),
      warrantyEndsAt: iso(end),
      underWarranty: !!end && end.getTime() >= now,
      issue: r.issue,
      note: r.note,
      reportedBy: r.reportedBy,
      channel: r.channel,
      status: r.status,
      billing: r.billing,
      amountCents: r.amountCents,
      visitStartsAt: iso(r.visitStartsAt),
      visitEndsAt: iso(r.visitEndsAt),
      workerId: r.workerId,
      workerName: r.workerId ? (workers.get(r.workerId) ?? null) : null,
      reportedAt: r.reportedAt.toISOString(),
      doneAt: iso(r.doneAt),
    };
  });
}

// GET /api/service-calls — the calls, the warranty on each finished job, and the figures.
router.get("/service-calls", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db.select().from(serviceCallsTable).where(eq(serviceCallsTable.userId, userId)).orderBy(desc(serviceCallsTable.reportedAt)).limit(200);
    const calls = await serialize(userId, rows);
    const finished = await db
      .select({ id: projectsTable.id, name: projectsTable.name, completedAt: projectsTable.completedAt, clientName: clientsTable.name })
      .from(projectsTable)
      .leftJoin(clientsTable, eq(clientsTable.id, projectsTable.clientId))
      .where(and(eq(projectsTable.userId, userId), isNotNull(projectsTable.completedAt)))
      .orderBy(desc(projectsTable.completedAt))
      .limit(100);
    const now = Date.now();
    const warranty = finished.map((p) => {
      const done = p.completedAt!;
      const end = warrantyEnd(done);
      const span = end.getTime() - done.getTime();
      return { projectId: p.id, jobName: p.name, clientName: p.clientName, completedAt: done.toISOString(), endsAt: end.toISOString(), covered: end.getTime() >= now, elapsedPercent: Math.max(0, Math.min(100, Math.round(((now - done.getTime()) / span) * 100))) };
    });
    const visits = rows.filter((r) => r.firstVisitAt).map((r) => (r.firstVisitAt!.getTime() - r.reportedAt.getTime()) / 86_400_000);
    res.json({
      calls,
      warranty,
      warrantyMonths: WARRANTY_MONTHS,
      kpis: {
        open: rows.filter((r) => r.status !== "done").length,
        booked: rows.filter((r) => r.status === "booked").length,
        underWarranty: warranty.filter((w) => w.covered).length,
        firstVisitDays: visits.length ? Math.round((visits.reduce((s, d) => s + d, 0) / visits.length) * 10) / 10 : null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error listing service calls");
    res.status(500).json({ error: "Internal server error" });
  }
});

const CreateBody = z.object({
  projectId: z.string().uuid(),
  issue: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2000).optional(),
  reportedBy: z.string().trim().max(120).optional(),
  channel: z.enum(SERVICE_CALL_CHANNELS).optional(),
});

// POST /api/service-calls
router.post("/service-calls", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = CreateBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters" }); return; }
    const [project] = await db.select({ id: projectsTable.id, completedAt: projectsTable.completedAt }).from(projectsTable).where(and(eq(projectsTable.id, body.data.projectId), eq(projectsTable.userId, userId)));
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    const covered = !!project.completedAt && warrantyEnd(project.completedAt).getTime() >= Date.now();
    const [row] = await db.insert(serviceCallsTable).values({ userId, projectId: project.id, issue: body.data.issue, note: body.data.note ?? "", reportedBy: body.data.reportedBy ?? "", channel: body.data.channel ?? "phone", billing: covered ? "warranty" : "billable" }).returning();
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "service_call", entityId: row!.id, action: "service_call_logged" });
    res.status(201).json({ call: (await serialize(userId, [row!]))[0] });
  } catch (err) {
    req.log.error({ err }, "Error logging a service call");
    res.status(500).json({ error: "Internal server error" });
  }
});

const PatchBody = z.object({
  issue: z.string().trim().min(1).max(200).optional(),
  note: z.string().trim().max(2000).optional(),
  billing: z.enum(SERVICE_CALL_BILLING).optional(),
  status: z.enum(SERVICE_CALL_STATUSES).optional(),
  amountCents: z.number().int().min(0).max(10_000_000).optional(),
  visit: z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime(), workerId: z.string().uuid().nullable().optional() }).optional(),
});

// PATCH /api/service-calls/:id — the charge, the status, or a visit (which puts a block on the schedule).
router.patch("/service-calls/:id", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = z.string().uuid().safeParse(req.params.id);
    const body = PatchBody.safeParse(req.body ?? {});
    if (!id.success || !body.success) { res.status(400).json({ error: "Invalid parameters" }); return; }
    const [call] = await db.select().from(serviceCallsTable).where(and(eq(serviceCallsTable.id, id.data), eq(serviceCallsTable.userId, userId)));
    if (!call) { res.status(404).json({ error: "Not found" }); return; }
    const d = body.data;
    const set: Partial<typeof serviceCallsTable.$inferInsert> = {};
    if (d.issue !== undefined) set.issue = d.issue;
    if (d.note !== undefined) set.note = d.note;
    if (d.billing !== undefined) set.billing = d.billing;
    if (d.amountCents !== undefined) set.amountCents = d.amountCents;
    if (d.status !== undefined) { set.status = d.status; set.doneAt = d.status === "done" ? new Date() : null; }
    if (d.visit) {
      const startsAt = new Date(d.visit.startsAt);
      const endsAt = new Date(d.visit.endsAt);
      if (!(endsAt > startsAt)) { res.status(400).json({ error: "Invalid parameters" }); return; }
      let workerId: string | null = d.visit.workerId ?? null;
      if (workerId) {
        const [w] = await db.select({ id: collaboratorsTable.id }).from(collaboratorsTable).where(and(eq(collaboratorsTable.id, workerId), eq(collaboratorsTable.userId, userId)));
        workerId = w?.id ?? null;
      }
      const title = `${d.issue ?? call.issue}`;
      let blockId = call.scheduleBlockId;
      if (blockId) {
        await db.update(scheduleBlocksTable).set({ startsAt, endsAt, collaboratorId: workerId, title }).where(and(eq(scheduleBlocksTable.id, blockId), eq(scheduleBlocksTable.userId, userId)));
      } else {
        const [b] = await db.insert(scheduleBlocksTable).values({ userId, projectId: call.projectId, collaboratorId: workerId, title, startsAt, endsAt, allDay: false, notes: "Service call", createdByUserId: userId }).returning({ id: scheduleBlocksTable.id });
        blockId = b!.id;
      }
      Object.assign(set, { visitStartsAt: startsAt, visitEndsAt: endsAt, workerId, scheduleBlockId: blockId, status: "booked" as const, firstVisitAt: call.firstVisitAt ?? startsAt });
    }
    const [updated] = await db.update(serviceCallsTable).set(set).where(eq(serviceCallsTable.id, call.id)).returning();
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "service_call", entityId: call.id, action: "service_call_updated", diff: { fields: Object.keys(set) } });
    res.json({ call: (await serialize(userId, [updated!]))[0] });
  } catch (err) {
    req.log.error({ err }, "Error updating a service call");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
