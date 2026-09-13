import { Router } from "express";
import { z } from "zod";
import {
  db,
  collaboratorsTable,
  projectsTable,
  projectAssignmentsTable,
  milestonesTable,
  timeEntriesTable,
  businessProfilesTable,
  hasFeature,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { hashToken } from "../contracts/service.js";
import { parseIsoDate, toIsoDate } from "../jobs/dates.js";
import { createNotification } from "../lib/notifications.js";

// ── Public worker time-entry endpoints (/t/:token) ───────────────────────────
// No login: the magic-link token identifies the worker (hashed before
// lookup, expiring, revocable from the Team page). Workers see only their
// company's open jobs and their own entries; nothing money-related leaks.

const router = Router();
const viewLimiter = ipRateLimiter({ windowMs: 60_000, max: 60, message: "Too many requests" });
const writeLimiter = ipRateLimiter({ windowMs: 15 * 60_000, max: 60, message: "Too many requests. Try again in a few minutes." });

async function resolveWorker(rawToken: string) {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 200) return null;
  const [worker] = await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.timeTokenHash, hashToken(rawToken)));
  if (!worker || !worker.active) return null;
  if (worker.timeTokenExpiresAt && worker.timeTokenExpiresAt < new Date()) return { expired: true as const, worker };
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, worker.userId));
  // The company must still be on a plan with time tracking.
  if (!hasFeature(profile, "team_time")) return { expired: true as const, worker };
  return { expired: false as const, worker, companyName: profile?.companyName ?? "", language: profile?.province === "QC" ? "fr" : "en" };
}

/** Jobs the worker may log time on: assigned ones, else every open job of the company. */
async function workerJobs(worker: { id: string; userId: string }) {
  const assigned = await db.select({ projectId: projectAssignmentsTable.projectId }).from(projectAssignmentsTable).where(eq(projectAssignmentsTable.collaboratorId, worker.id));
  const conds = [eq(projectsTable.userId, worker.userId), inArray(projectsTable.status, ["planning", "active"])];
  if (assigned.length) conds.push(inArray(projectsTable.id, assigned.map((a) => a.projectId)));
  const jobs = await db.select({ id: projectsTable.id, name: projectsTable.name, address: projectsTable.address }).from(projectsTable).where(and(...conds)).orderBy(asc(projectsTable.name)).limit(50);
  const milestones = jobs.length ? await db.select({ id: milestonesTable.id, projectId: milestonesTable.projectId, title: milestonesTable.title, status: milestonesTable.status, sortOrder: milestonesTable.sortOrder }).from(milestonesTable).where(and(inArray(milestonesTable.projectId, jobs.map((j) => j.id)), inArray(milestonesTable.status, ["planned", "in_progress"]))).orderBy(asc(milestonesTable.sortOrder)) : [];
  return jobs.map((j) => ({ ...j, milestones: milestones.filter((m) => m.projectId === j.id).map((m) => ({ id: m.id, title: m.title, status: m.status })) }));
}

const serializeOwnEntry = (e: typeof timeEntriesTable.$inferSelect, jobName: string | null, milestoneTitle: string | null) => ({
  id: e.id,
  projectId: e.projectId,
  projectName: jobName,
  milestoneId: e.milestoneId,
  milestoneTitle,
  date: toIsoDate(e.date),
  hours: Number(e.hours),
  note: e.note,
  status: e.status,
  rejectedReason: e.rejectedReason,
  createdAt: e.createdAt.toISOString(),
});

async function ownEntries(worker: { id: string }, jobs: { id: string; name: string; milestones: { id: string; title: string }[] }[]) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.workerId, worker.id), gte(timeEntriesTable.date, since))).orderBy(desc(timeEntriesTable.date), desc(timeEntriesTable.createdAt)).limit(120);
  const jobName = new Map(jobs.map((j) => [j.id, j.name]));
  const msTitle = new Map(jobs.flatMap((j) => j.milestones.map((m) => [m.id, m.title] as const)));
  // Entries on jobs no longer open still show up (name resolved separately).
  const missing = rows.map((r) => r.projectId).filter((id) => !jobName.has(id));
  if (missing.length) for (const p of await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(inArray(projectsTable.id, [...new Set(missing)]))) jobName.set(p.id, p.name);
  return rows.map((r) => serializeOwnEntry(r, jobName.get(r.projectId) ?? null, r.milestoneId ? (msTitle.get(r.milestoneId) ?? null) : null));
}

// GET /api/t/:token
router.get("/t/:token", viewLimiter, async (req, res) => {
  try {
    const r = await resolveWorker(req.params.token as string);
    if (!r) {
      res.status(404).json({ error: "INVALID" });
      return;
    }
    if (r.expired) {
      res.status(410).json({ error: "EXPIRED", workerName: r.worker.name });
      return;
    }
    const jobs = await workerJobs(r.worker);
    res.json({ worker: { name: r.worker.name, role: r.worker.role }, companyName: r.companyName, language: r.language, jobs, entries: await ownEntries(r.worker, jobs), today: toIsoDate(new Date()) });
  } catch (err) {
    req.log.error({ err }, "Error loading worker page");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/t/:token/entries
router.post("/t/:token/entries", writeLimiter, async (req, res) => {
  try {
    const r = await resolveWorker(req.params.token as string);
    if (!r || r.expired) {
      res.status(r?.expired ? 410 : 404).json({ error: r?.expired ? "EXPIRED" : "INVALID" });
      return;
    }
    const body = z.object({ projectId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hours: z.number().min(0.25).max(24), milestoneId: z.string().uuid().nullable().optional(), note: z.string().max(300).optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const date = parseIsoDate(d.date)!;
    if (date.getTime() > Date.now() + 86_400_000 || date.getTime() < Date.now() - 45 * 86_400_000) {
      res.status(400).json({ error: "DATE_RANGE", message: "Hours can be logged for the last 45 days only." });
      return;
    }
    const jobs = await workerJobs(r.worker);
    const job = jobs.find((j) => j.id === d.projectId);
    if (!job) {
      res.status(400).json({ error: "Invalid job" });
      return;
    }
    const milestoneId = d.milestoneId && job.milestones.some((m) => m.id === d.milestoneId) ? d.milestoneId : null;
    // Cap a day at 24 h across entries.
    const sameDay = await db.select({ hours: timeEntriesTable.hours }).from(timeEntriesTable).where(and(eq(timeEntriesTable.workerId, r.worker.id), eq(timeEntriesTable.date, date)));
    if (sameDay.reduce((s, x) => s + Number(x.hours), 0) + d.hours > 24) {
      res.status(400).json({ error: "TOO_MANY_HOURS", message: "More than 24 hours on one day." });
      return;
    }
    const [entry] = await db
      .insert(timeEntriesTable)
      .values({ userId: r.worker.userId, workerId: r.worker.id, projectId: job.id, milestoneId, date, hours: d.hours.toFixed(2), rateCentsSnapshot: r.worker.hourlyRate, burdenPercentSnapshot: String(Number(r.worker.burdenPercent)), note: d.note ?? "", status: "submitted", enteredBy: "worker" })
      .returning();
    await db.update(collaboratorsTable).set({ lastTimeEntryAt: new Date() }).where(eq(collaboratorsTable.id, r.worker.id));
    // One notification per worker per day keeps the bell useful.
    const dayKey = toIsoDate(new Date());
    const already = await db.select({ id: timeEntriesTable.id }).from(timeEntriesTable).where(and(eq(timeEntriesTable.workerId, r.worker.id), eq(timeEntriesTable.enteredBy, "worker"), gte(timeEntriesTable.createdAt, new Date(`${dayKey}T00:00:00Z`)))).limit(2);
    if (already.length <= 1) {
      await createNotification({ userId: r.worker.userId, type: "time_entry_submitted", title: r.language === "fr" ? `${r.worker.name} a saisi des heures` : `${r.worker.name} logged hours`, body: r.language === "fr" ? `${d.hours} h sur ${job.name} — à approuver dans Équipe.` : `${d.hours} h on ${job.name} — approve them under Team.`, link: "/dashboard/team?tab=time", entityType: "time_entry", entityId: entry!.id });
    }
    res.status(201).json({ entry: serializeOwnEntry(entry!, job.name, milestoneId ? (job.milestones.find((m) => m.id === milestoneId)?.title ?? null) : null) });
  } catch (err) {
    req.log.error({ err }, "Error saving worker time entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/t/:token/entries/:tid — only while still "submitted"
router.delete("/t/:token/entries/:tid", writeLimiter, async (req, res) => {
  try {
    const r = await resolveWorker(req.params.token as string);
    if (!r || r.expired) {
      res.status(r?.expired ? 410 : 404).json({ error: r?.expired ? "EXPIRED" : "INVALID" });
      return;
    }
    const [entry] = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.id, req.params.tid as string), eq(timeEntriesTable.workerId, r.worker.id)));
    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (entry.status !== "submitted") {
      res.status(409).json({ error: "LOCKED", message: "This entry has already been reviewed." });
      return;
    }
    await db.delete(timeEntriesTable).where(eq(timeEntriesTable.id, entry.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting worker time entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
