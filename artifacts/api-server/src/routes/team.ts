import { Router } from "express";
import { z } from "zod";
import {
  db,
  collaboratorsTable,
  projectAssignmentsTable,
  projectsTable,
  milestonesTable,
  timeEntriesTable,
  equipmentTable,
  equipmentUsageTable,
  costEntriesTable,
  businessProfilesTable,
  hasFeature,
  minimumPlanFor,
  WORKER_TYPES,
  EQUIPMENT_OWNERSHIP,
  USAGE_UNITS,
  TIME_ENTRY_STATUSES,
  labourCostCents,
  type TimeEntry,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit } from "../lib/notifications.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { hashToken, newRawToken } from "../contracts/service.js";
import { sendWorkerInviteEmail } from "../lib/emailTeam.js";
import { parseIsoDate, toIsoDate } from "../jobs/dates.js";
import { serializeWorker, serializeEquipment, serializeTimeEntry, serializeUsage, syncLabourCost, syncEquipmentCost, nameMaps, approvedHoursByWorker } from "../costs/service.js";
import { logger } from "../lib/logger.js";

// ── Phase 3: workers, time entries, equipment ────────────────────────────────
// Workers are free on every plan (they existed as CRM collaborators); logging
// time, equipment and issuing worker links are gated on "team_time" (Elite).

const router = Router();
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
export const WORKER_LINK_DAYS = 180;

async function requireTeamFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "team_time")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("team_time") };
}

const planRequired = (res: import("express").Response, plan: string, what: string) => res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: plan, message: `${what} requires the Elite plan` });

async function ownedWorker(userId: string, id: string) {
  const [w] = await db.select().from(collaboratorsTable).where(and(eq(collaboratorsTable.id, id), eq(collaboratorsTable.userId, userId)));
  return w ?? null;
}
async function ownedProject(userId: string, id: string) {
  const [p] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  return p ?? null;
}
async function ownedEquipment(userId: string, id: string) {
  const [e] = await db.select().from(equipmentTable).where(and(eq(equipmentTable.id, id), eq(equipmentTable.userId, userId)));
  return e ?? null;
}
async function milestoneBelongs(projectId: string, milestoneId: string | null | undefined): Promise<string | null> {
  if (!milestoneId) return null;
  const [m] = await db.select({ id: milestonesTable.id }).from(milestonesTable).where(and(eq(milestonesTable.id, milestoneId), eq(milestonesTable.projectId, projectId)));
  return m?.id ?? null;
}

function monthRange(): { from: Date; to: Date } {
  const now = new Date();
  return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
}

// ── Workers ──────────────────────────────────────────────────────────────────

const WorkerBody = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(80).optional(),
  email: z.string().email().max(200).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  hourlyRateCents: z.number().int().min(0).max(100_000_00).optional(),
  workerType: z.enum(WORKER_TYPES).optional(),
  burdenPercent: z.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
  /** Phase 86b: may add tasks from the site. */
  canAddTasks: z.boolean().optional(),
});

// GET /api/team/workers
router.get("/team/workers", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const workers = await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.userId, userId)).orderBy(desc(collaboratorsTable.active), asc(collaboratorsTable.name));
    const { from, to } = monthRange();
    const hours = await approvedHoursByWorker(userId, from, to);
    const pending = await db
      .select({ workerId: timeEntriesTable.workerId, n: sql<number>`count(*)::int` })
      .from(timeEntriesTable)
      .where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.status, "submitted")))
      .groupBy(timeEntriesTable.workerId);
    const pendingMap = new Map(pending.map((p) => [p.workerId, p.n]));
    res.json({ items: workers.map((w) => serializeWorker(w, { hoursThisMonth: hours.get(w.id) ?? 0, pendingCount: pendingMap.get(w.id) ?? 0 })) });
  } catch (err) {
    req.log.error({ err }, "Error listing workers");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/team/workers
router.post("/team/workers", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireTeamFeature(userId);
    if (!gate.ok) { planRequired(res, gate.plan, "Worker time tracking"); return; }
    const body = WorkerBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const type = d.workerType ?? "employee";
    const [w] = await db
      .insert(collaboratorsTable)
      .values({
        userId,
        name: d.name,
        role: d.role ?? "worker",
        email: d.email ?? null,
        phone: d.phone ?? null,
        hourlyRate: d.hourlyRateCents ?? 0,
        workerType: type,
        burdenPercent: String(d.burdenPercent ?? (type === "subcontractor" ? 0 : 15)),
        active: d.active ?? true,
        canAddTasks: d.canAddTasks ?? false,
      })
      .returning();
    res.status(201).json({ worker: serializeWorker(w!) });
  } catch (err) {
    req.log.error({ err }, "Error creating worker");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/team/workers/:wid
router.put("/team/workers/:wid", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const w = await ownedWorker(userId, req.params.wid as string);
    if (!w) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = WorkerBody.partial().safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const updates: Partial<typeof collaboratorsTable.$inferInsert> = {};
    if (d.name !== undefined) updates.name = d.name;
    if (d.role !== undefined) updates.role = d.role;
    if (d.email !== undefined) updates.email = d.email;
    if (d.phone !== undefined) updates.phone = d.phone;
    if (d.hourlyRateCents !== undefined) updates.hourlyRate = d.hourlyRateCents;
    if (d.workerType !== undefined) updates.workerType = d.workerType;
    if (d.burdenPercent !== undefined) updates.burdenPercent = String(d.burdenPercent);
    if (d.canAddTasks !== undefined) updates.canAddTasks = d.canAddTasks;
    if (d.active !== undefined) {
      updates.active = d.active;
      if (!d.active) { updates.timeTokenHash = null; updates.timeTokenExpiresAt = null; }
    }
    const [updated] = await db.update(collaboratorsTable).set(updates).where(eq(collaboratorsTable.id, w.id)).returning();
    res.json({ worker: serializeWorker(updated!) });
  } catch (err) {
    req.log.error({ err }, "Error updating worker");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/team/workers/:wid — hard delete only when no hours were ever logged; otherwise deactivate
router.delete("/team/workers/:wid", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const w = await ownedWorker(userId, req.params.wid as string);
    if (!w) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(timeEntriesTable).where(eq(timeEntriesTable.workerId, w.id));
    if (Number(n) > 0) {
      await db.update(collaboratorsTable).set({ active: false, timeTokenHash: null, timeTokenExpiresAt: null }).where(eq(collaboratorsTable.id, w.id));
      res.json({ success: true, deactivated: true });
      return;
    }
    await db.delete(collaboratorsTable).where(eq(collaboratorsTable.id, w.id));
    res.json({ success: true, deactivated: false });
  } catch (err) {
    req.log.error({ err }, "Error deleting worker");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/team/workers/:wid/invite — (re)issue the magic link; emails it when the worker has an email
router.post("/team/workers/:wid/invite", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireTeamFeature(userId);
    if (!gate.ok) { planRequired(res, gate.plan, "Worker time tracking"); return; }
    const w = await ownedWorker(userId, req.params.wid as string);
    if (!w) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!w.active) {
      res.status(409).json({ error: "INACTIVE", message: "Reactivate the worker first." });
      return;
    }
    const body = z.object({ send: z.boolean().optional() }).safeParse(req.body ?? {});
    const raw = newRawToken();
    const expiresAt = new Date(Date.now() + WORKER_LINK_DAYS * 86_400_000);
    await db.update(collaboratorsTable).set({ timeTokenHash: hashToken(raw), timeTokenExpiresAt: expiresAt }).where(eq(collaboratorsTable.id, w.id));
    const url = `${getBaseUrl()}/t/${raw}`;
    let emailed = false;
    if (body.success && body.data.send !== false && w.email) {
      const [profile] = await db.select({ companyName: businessProfilesTable.companyName, province: businessProfilesTable.province }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
      try {
        await sendWorkerInviteEmail({ toEmail: w.email, workerName: w.name, companyName: profile?.companyName || "your contractor", url, language: profile?.province === "QC" ? "fr" : "en" });
        emailed = true;
      } catch (err) {
        logger.warn({ err, workerId: w.id }, "Worker invite email failed; link returned to the dashboard");
      }
    }
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "worker", entityId: w.id, action: "invite_issued", diff: { emailed } });
    res.json({ url, expiresAt: expiresAt.toISOString(), emailed });
  } catch (err) {
    req.log.error({ err }, "Error issuing worker link");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/team/workers/:wid/invite — revoke
router.delete("/team/workers/:wid/invite", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const w = await ownedWorker(userId, req.params.wid as string);
    if (!w) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db.update(collaboratorsTable).set({ timeTokenHash: null, timeTokenExpiresAt: null }).where(eq(collaboratorsTable.id, w.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error revoking worker link");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Time entries ─────────────────────────────────────────────────────────────

const TimeEntryBody = z.object({
  workerId: z.string().uuid(),
  date: z.string().regex(dateRe),
  hours: z.number().min(0.25).max(24),
  milestoneId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).optional(),
  /** Company-entered hours can be approved in the same step. */
  approve: z.boolean().optional(),
  /** Phase 77: id of the offline outbox op — a replay returns the entry it already created. */
  clientRef: z.string().uuid().optional(),
});

async function loadTimeEntries(userId: string, where: ReturnType<typeof and>) {
  const rows = await db.select().from(timeEntriesTable).where(where).orderBy(desc(timeEntriesTable.date), desc(timeEntriesTable.createdAt)).limit(500);
  const names = await nameMaps({ projectIds: rows.map((r) => r.projectId), milestoneIds: rows.map((r) => r.milestoneId), workerIds: rows.map((r) => r.workerId) });
  return rows.map((r) => serializeTimeEntry(r, { workerName: names.worker.get(r.workerId), projectName: names.project.get(r.projectId) ?? null, milestoneTitle: r.milestoneId ? (names.milestone.get(r.milestoneId) ?? null) : null }));
}

// GET /api/team/time-entries?status=&workerId=&projectId=&from=&to=
router.get("/team/time-entries", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const q = z.object({ status: z.enum(TIME_ENTRY_STATUSES).optional(), workerId: z.string().uuid().optional(), projectId: z.string().uuid().optional(), from: z.string().regex(dateRe).optional(), to: z.string().regex(dateRe).optional() }).safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const conds = [eq(timeEntriesTable.userId, userId)];
    if (q.data.status) conds.push(eq(timeEntriesTable.status, q.data.status));
    if (q.data.workerId) conds.push(eq(timeEntriesTable.workerId, q.data.workerId));
    if (q.data.projectId) conds.push(eq(timeEntriesTable.projectId, q.data.projectId));
    if (q.data.from) conds.push(gte(timeEntriesTable.date, parseIsoDate(q.data.from)!));
    if (q.data.to) conds.push(lt(timeEntriesTable.date, new Date(parseIsoDate(q.data.to)!.getTime() + 86_400_000)));
    res.json({ items: await loadTimeEntries(userId, and(...conds)) });
  } catch (err) {
    req.log.error({ err }, "Error listing time entries");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs/:id/time-entries — company logs hours for a worker
router.post("/jobs/:id/time-entries", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireTeamFeature(userId);
    if (!gate.ok) { planRequired(res, gate.plan, "Time tracking"); return; }
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = TimeEntryBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const worker = await ownedWorker(userId, d.workerId);
    if (!worker) {
      res.status(400).json({ error: "Invalid worker" });
      return;
    }
    const approve = d.approve ?? true;
    if (d.clientRef) {
      const [replayed] = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.workerId, worker.id), eq(timeEntriesTable.clientRef, d.clientRef)));
      if (replayed) {
        res.json({ entry: serializeTimeEntry(replayed, { workerName: worker.name, projectName: project.name }), replayed: true });
        return;
      }
    }
    const [entry] = await db
      .insert(timeEntriesTable)
      .values({
        userId,
        workerId: worker.id,
        projectId: project.id,
        milestoneId: await milestoneBelongs(project.id, d.milestoneId),
        clientRef: d.clientRef ?? null,
        date: parseIsoDate(d.date)!,
        hours: d.hours.toFixed(2),
        rateCentsSnapshot: worker.hourlyRate,
        burdenPercentSnapshot: String(Number(worker.burdenPercent)),
        note: d.note ?? "",
        status: approve ? "approved" : "submitted",
        enteredBy: "company",
        approvedAt: approve ? new Date() : null,
      })
      .returning();
    if (approve) await syncLabourCost(entry!, worker);
    await db.update(collaboratorsTable).set({ lastTimeEntryAt: new Date() }).where(eq(collaboratorsTable.id, worker.id));
    const [fresh] = await db.select().from(timeEntriesTable).where(eq(timeEntriesTable.id, entry!.id));
    res.status(201).json({ entry: serializeTimeEntry(fresh!, { workerName: worker.name, projectName: project.name }) });
  } catch (err) {
    req.log.error({ err }, "Error adding time entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function applyTimeEntryUpdate(userId: string, entry: TimeEntry, d: { status?: "submitted" | "approved" | "rejected"; hours?: number; date?: string; note?: string; milestoneId?: string | null; rejectedReason?: string | null }) {
  const worker = await ownedWorker(userId, entry.workerId);
  if (!worker) throw new Error("Worker not found");
  const updates: Partial<typeof timeEntriesTable.$inferInsert> = {};
  if (d.hours !== undefined) updates.hours = d.hours.toFixed(2);
  if (d.date !== undefined) updates.date = parseIsoDate(d.date) ?? entry.date;
  if (d.note !== undefined) updates.note = d.note;
  if (d.milestoneId !== undefined) updates.milestoneId = await milestoneBelongs(entry.projectId, d.milestoneId);
  if (d.status !== undefined) {
    updates.status = d.status;
    if (d.status === "approved") {
      updates.approvedAt = entry.approvedAt ?? new Date();
      updates.rejectedReason = null;
      // Approval freezes the current rate/burden (an entry submitted weeks ago still pays today's rate).
      if (entry.status !== "approved") { updates.rateCentsSnapshot = worker.hourlyRate; updates.burdenPercentSnapshot = String(Number(worker.burdenPercent)); }
    } else {
      updates.approvedAt = null;
      updates.rejectedReason = d.status === "rejected" ? (d.rejectedReason ?? entry.rejectedReason ?? "") : null;
    }
  }
  const [updated] = await db.update(timeEntriesTable).set(updates).where(eq(timeEntriesTable.id, entry.id)).returning();
  await syncLabourCost(updated!, worker);
  if (d.status && d.status !== entry.status) await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "time_entry", entityId: entry.id, action: d.status, diff: { hours: Number(updated!.hours) } });
  const [fresh] = await db.select().from(timeEntriesTable).where(eq(timeEntriesTable.id, entry.id));
  return { entry: fresh!, worker };
}

const TimeEntryUpdateBody = z.object({
  status: z.enum(TIME_ENTRY_STATUSES).optional(),
  hours: z.number().min(0.25).max(24).optional(),
  date: z.string().regex(dateRe).optional(),
  note: z.string().max(500).optional(),
  milestoneId: z.string().uuid().nullable().optional(),
  rejectedReason: z.string().max(300).nullable().optional(),
});

// PUT /api/team/time-entries/:tid — edit / approve / reject
router.put("/team/time-entries/:tid", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [entry] = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.id, req.params.tid as string), eq(timeEntriesTable.userId, userId)));
    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = TimeEntryUpdateBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    if (body.data.status === "approved" && entry.status !== "approved") {
      const gate = await requireTeamFeature(userId);
      if (!gate.ok) { planRequired(res, gate.plan, "Time tracking"); return; }
    }
    const r = await applyTimeEntryUpdate(userId, entry, body.data);
    const names = await nameMaps({ projectIds: [entry.projectId], milestoneIds: [r.entry.milestoneId] });
    res.json({ entry: serializeTimeEntry(r.entry, { workerName: r.worker.name, projectName: names.project.get(entry.projectId) ?? null, milestoneTitle: r.entry.milestoneId ? (names.milestone.get(r.entry.milestoneId) ?? null) : null }) });
  } catch (err) {
    req.log.error({ err }, "Error updating time entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/team/time-entries/approve — bulk approve
// Phase 86: `jobs:edit`, the same bar as approving one entry through PUT above —
// it was `jobs:full`, so a foreman could approve a week of hours one row at a
// time but not with the "approve all" button next to them.
router.post("/team/time-entries/approve", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireTeamFeature(userId);
    if (!gate.ok) { planRequired(res, gate.plan, "Time tracking"); return; }
    const body = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const entries = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.userId, userId), inArray(timeEntriesTable.id, body.data.ids), eq(timeEntriesTable.status, "submitted")));
    for (const e of entries) await applyTimeEntryUpdate(userId, e, { status: "approved" });
    res.json({ approved: entries.length });
  } catch (err) {
    req.log.error({ err }, "Error bulk-approving time entries");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/team/time-entries/:tid — removes the derived labour cost too
router.delete("/team/time-entries/:tid", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [entry] = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.id, req.params.tid as string), eq(timeEntriesTable.userId, userId)));
    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db.transaction(async (tx) => {
      if (entry.costEntryId) await tx.delete(costEntriesTable).where(eq(costEntriesTable.id, entry.costEntryId));
      await tx.delete(timeEntriesTable).where(eq(timeEntriesTable.id, entry.id));
    });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting time entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/team/payroll-summary.csv?from=&to= — approved hours per worker per job (no payroll math)
router.get("/team/payroll-summary.csv", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const q = z.object({ from: z.string().regex(dateRe), to: z.string().regex(dateRe) }).safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "from and to (YYYY-MM-DD) are required" });
      return;
    }
    const from = parseIsoDate(q.data.from)!;
    const to = new Date(parseIsoDate(q.data.to)!.getTime() + 86_400_000);
    const rows = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.status, "approved"), gte(timeEntriesTable.date, from), lt(timeEntriesTable.date, to))).orderBy(asc(timeEntriesTable.workerId), asc(timeEntriesTable.date));
    const names = await nameMaps({ projectIds: rows.map((r) => r.projectId), workerIds: rows.map((r) => r.workerId) });
    const workers = await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.userId, userId));
    const wtype = new Map(workers.map((w) => [w.id, w.workerType]));
    const esc = (v: string | number) => (typeof v === "number" ? v.toString() : `"${v.replace(/"/g, '""')}"`);
    const money = (c: number) => (c / 100).toFixed(2);
    const lines: string[] = [["Worker", "Type", "Job", "Date", "Hours", "Rate (CAD/h)", "Gross (CAD)", "Burden %", "Burden (CAD)", "Labour cost (CAD)", "Note"].map(esc).join(",")];
    const totals = new Map<string, { hours: number; gross: number; burden: number; total: number }>();
    for (const r of rows) {
      const hours = Number(r.hours);
      const gross = Math.round(hours * r.rateCentsSnapshot);
      const total = labourCostCents(hours, r.rateCentsSnapshot, Number(r.burdenPercentSnapshot));
      const burden = total - gross;
      lines.push([names.worker.get(r.workerId) ?? "", wtype.get(r.workerId) ?? "", names.project.get(r.projectId) ?? "", toIsoDate(r.date) ?? "", hours.toFixed(2), money(r.rateCentsSnapshot), money(gross), Number(r.burdenPercentSnapshot).toFixed(2), money(burden), money(total), r.note].map(esc).join(","));
      const t = totals.get(r.workerId) ?? { hours: 0, gross: 0, burden: 0, total: 0 };
      t.hours += hours; t.gross += gross; t.burden += burden; t.total += total;
      totals.set(r.workerId, t);
    }
    lines.push("");
    lines.push(["Worker totals", "", "", "", "Hours", "", "Gross (CAD)", "", "Burden (CAD)", "Labour cost (CAD)", ""].map(esc).join(","));
    for (const [wid, t] of totals) lines.push([names.worker.get(wid) ?? "", wtype.get(wid) ?? "", "", "", t.hours.toFixed(2), "", money(t.gross), "", money(t.burden), money(t.total), ""].map(esc).join(","));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="payroll-summary-${q.data.from}-${q.data.to}.csv"`);
    res.send(`\uFEFF${lines.join("\r\n")}`);
  } catch (err) {
    req.log.error({ err }, "Error exporting payroll summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Equipment ────────────────────────────────────────────────────────────────

const EquipmentBody = z.object({
  name: z.string().min(1).max(120),
  ownership: z.enum(EQUIPMENT_OWNERSHIP).optional(),
  purchaseCents: z.number().int().min(0).optional(),
  financing: z.object({ lender: z.string().max(120).optional(), monthlyPaymentCents: z.number().int().min(0).optional(), remainingMonths: z.number().int().min(0).max(600).optional() }).optional(),
  usageRateCents: z.number().int().min(0).optional(),
  usageUnit: z.enum(USAGE_UNITS).optional(),
  notes: z.string().max(1000).optional(),
  active: z.boolean().optional(),
});

// GET /api/team/equipment
router.get("/team/equipment", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const items = await db.select().from(equipmentTable).where(eq(equipmentTable.userId, userId)).orderBy(desc(equipmentTable.active), asc(equipmentTable.name));
    const { from, to } = monthRange();
    const usage = await db
      .select({ equipmentId: equipmentUsageTable.equipmentId, cents: sql<string>`coalesce(sum(${equipmentUsageTable.quantity} * ${equipmentUsageTable.rateCentsSnapshot}), 0)` })
      .from(equipmentUsageTable)
      .where(and(eq(equipmentUsageTable.userId, userId), gte(equipmentUsageTable.date, from), lt(equipmentUsageTable.date, to)))
      .groupBy(equipmentUsageTable.equipmentId);
    const usageMap = new Map(usage.map((u) => [u.equipmentId, Math.round(Number(u.cents))]));
    res.json({ items: items.map((e) => serializeEquipment(e, { usageCentsThisMonth: usageMap.get(e.id) ?? 0 })) });
  } catch (err) {
    req.log.error({ err }, "Error listing equipment");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/team/equipment
router.post("/team/equipment", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireTeamFeature(userId);
    if (!gate.ok) { planRequired(res, gate.plan, "The equipment register"); return; }
    const body = EquipmentBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const [e] = await db.insert(equipmentTable).values({ userId, name: d.name, ownership: d.ownership ?? "owned", purchaseCents: d.purchaseCents ?? 0, financing: d.financing ?? {}, usageRateCents: d.usageRateCents ?? 0, usageUnit: d.usageUnit ?? "day", notes: d.notes ?? "", active: d.active ?? true }).returning();
    res.status(201).json({ equipment: serializeEquipment(e!) });
  } catch (err) {
    req.log.error({ err }, "Error creating equipment");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/team/equipment/:eid
router.put("/team/equipment/:eid", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const e = await ownedEquipment(userId, req.params.eid as string);
    if (!e) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = EquipmentBody.partial().safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const updates: Partial<typeof equipmentTable.$inferInsert> = {};
    for (const k of ["name", "ownership", "purchaseCents", "financing", "usageRateCents", "usageUnit", "notes", "active"] as const) if (d[k] !== undefined) (updates as Record<string, unknown>)[k] = d[k];
    const [updated] = await db.update(equipmentTable).set(updates).where(eq(equipmentTable.id, e.id)).returning();
    res.json({ equipment: serializeEquipment(updated!) });
  } catch (err) {
    req.log.error({ err }, "Error updating equipment");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/team/equipment/:eid — deactivate when usage exists (usage rows carry the job costs)
router.delete("/team/equipment/:eid", requireAuth, requirePermission("team", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const e = await ownedEquipment(userId, req.params.eid as string);
    if (!e) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(equipmentUsageTable).where(eq(equipmentUsageTable.equipmentId, e.id));
    if (Number(n) > 0) {
      await db.update(equipmentTable).set({ active: false }).where(eq(equipmentTable.id, e.id));
      res.json({ success: true, deactivated: true });
      return;
    }
    await db.delete(equipmentTable).where(eq(equipmentTable.id, e.id));
    res.json({ success: true, deactivated: false });
  } catch (err) {
    req.log.error({ err }, "Error deleting equipment");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs/:id/equipment-usage — log usage → equipment cost entry
router.post("/jobs/:id/equipment-usage", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireTeamFeature(userId);
    if (!gate.ok) { planRequired(res, gate.plan, "Equipment tracking"); return; }
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = z.object({ equipmentId: z.string().uuid(), date: z.string().regex(dateRe), quantity: z.number().min(0.25).max(1000), unit: z.enum(USAGE_UNITS).optional(), milestoneId: z.string().uuid().nullable().optional(), note: z.string().max(300).optional(), rateCents: z.number().int().min(0).optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const equipment = await ownedEquipment(userId, d.equipmentId);
    if (!equipment) {
      res.status(400).json({ error: "Invalid equipment" });
      return;
    }
    const [usage] = await db
      .insert(equipmentUsageTable)
      .values({ userId, equipmentId: equipment.id, projectId: project.id, milestoneId: await milestoneBelongs(project.id, d.milestoneId), date: parseIsoDate(d.date)!, quantity: d.quantity.toFixed(2), unit: d.unit ?? equipment.usageUnit, rateCentsSnapshot: d.rateCents ?? equipment.usageRateCents, note: d.note ?? "" })
      .returning();
    await syncEquipmentCost(usage!, equipment);
    const [fresh] = await db.select().from(equipmentUsageTable).where(eq(equipmentUsageTable.id, usage!.id));
    res.status(201).json({ usage: serializeUsage(fresh!, { equipmentName: equipment.name, projectName: project.name }) });
  } catch (err) {
    req.log.error({ err }, "Error logging equipment usage");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/jobs/:id/equipment-usage/:uid
router.delete("/jobs/:id/equipment-usage/:uid", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [usage] = await db.select().from(equipmentUsageTable).where(and(eq(equipmentUsageTable.id, req.params.uid as string), eq(equipmentUsageTable.userId, userId), eq(equipmentUsageTable.projectId, req.params.id as string)));
    if (!usage) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db.transaction(async (tx) => {
      if (usage.costEntryId) await tx.delete(costEntriesTable).where(eq(costEntriesTable.id, usage.costEntryId));
      await tx.delete(equipmentUsageTable).where(eq(equipmentUsageTable.id, usage.id));
    });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting equipment usage");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Assignments (moved here from the legacy CRM router) ──────────────────────

router.post("/jobs/:id/assignments", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = z.object({ workerId: z.string().uuid(), roleInProject: z.string().max(80).optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const worker = await ownedWorker(userId, body.data.workerId);
    if (!worker) {
      res.status(400).json({ error: "Invalid worker" });
      return;
    }
    const [existing] = await db.select().from(projectAssignmentsTable).where(and(eq(projectAssignmentsTable.projectId, project.id), eq(projectAssignmentsTable.collaboratorId, worker.id)));
    if (existing) {
      res.json({ assignment: { id: existing.id, workerId: worker.id, roleInProject: existing.roleInProject } });
      return;
    }
    const [a] = await db.insert(projectAssignmentsTable).values({ projectId: project.id, collaboratorId: worker.id, roleInProject: body.data.roleInProject ?? "" }).returning();
    res.status(201).json({ assignment: { id: a!.id, workerId: worker.id, roleInProject: a!.roleInProject } });
  } catch (err) {
    req.log.error({ err }, "Error assigning worker");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/jobs/:id/assignments/:aid", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const project = await ownedProject(userId, req.params.id as string);
    if (!project) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db.delete(projectAssignmentsTable).where(and(eq(projectAssignmentsTable.id, req.params.aid as string), eq(projectAssignmentsTable.projectId, project.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error removing assignment");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
