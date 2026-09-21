import { Router } from "express";
import { z } from "zod";
import {
  db,
  collaboratorsTable,
  projectsTable,
  projectAssignmentsTable,
  milestonesTable,
  timeEntriesTable,
  scheduleBlocksTable,
  businessProfilesTable,
  hasFeature,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray, isNull, isNotNull, lt } from "drizzle-orm";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { hashToken } from "../contracts/service.js";
import { parseIsoDate, toIsoDate, localDayFor } from "../jobs/dates.js";
import { createNotification } from "../lib/notifications.js";
import { distanceMeters } from "../lib/geo.js";
import { blockLabel } from "../schedule/service.js";

/** A clock-in session longer than this is auto-capped at clock-out — a forgotten clock-out shouldn't silently log a 30h day. */
const MAX_SESSION_HOURS = 16;

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
  return { expired: false as const, worker, companyName: profile?.companyName ?? "", language: profile?.province === "QC" ? "fr" : "en", province: profile?.province ?? null };
}

/** Jobs the worker may log time on: assigned ones, else every open job of the company. */
async function workerJobs(worker: { id: string; userId: string }) {
  const assigned = await db.select({ projectId: projectAssignmentsTable.projectId }).from(projectAssignmentsTable).where(eq(projectAssignmentsTable.collaboratorId, worker.id));
  const conds = [eq(projectsTable.userId, worker.userId), inArray(projectsTable.status, ["planning", "active"])];
  if (assigned.length) conds.push(inArray(projectsTable.id, assigned.map((a) => a.projectId)));
  const jobs = await db
    .select({ id: projectsTable.id, name: projectsTable.name, address: projectsTable.address, latitude: projectsTable.latitude, longitude: projectsTable.longitude, geofenceRadiusMeters: projectsTable.geofenceRadiusMeters })
    .from(projectsTable)
    .where(and(...conds))
    .orderBy(asc(projectsTable.name))
    .limit(50);
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
  clockInAt: e.clockInAt ? e.clockInAt.toISOString() : null,
  clockOutAt: e.clockOutAt ? e.clockOutAt.toISOString() : null,
  geofenceFlagged: e.geofenceFlagged,
  createdAt: e.createdAt.toISOString(),
});

/** Distance check against a job's (optional, manually-set) geofence — flags only, never blocks. */
function geofenceFlag(job: { latitude: string | null; longitude: string | null; geofenceRadiusMeters: number | null }, lat: number | undefined, lng: number | undefined) {
  if (!job.latitude || !job.longitude || !job.geofenceRadiusMeters || lat === undefined || lng === undefined) return false;
  return distanceMeters(Number(job.latitude), Number(job.longitude), lat, lng) > job.geofenceRadiusMeters;
}

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

/** Phase 75: the worker's own blocks from the start of today (local) for two weeks — what the evening reminder pointed them at. */
async function workerSchedule(worker: { id: string }, province: string | null, language: "en" | "fr") {
  const from = localDayFor(new Date(), province);
  const to = new Date(from.getTime() + 15 * 86_400_000);
  const rows = await db
    .select()
    .from(scheduleBlocksTable)
    .where(and(eq(scheduleBlocksTable.collaboratorId, worker.id), lt(scheduleBlocksTable.startsAt, to), gte(scheduleBlocksTable.endsAt, from)))
    .orderBy(asc(scheduleBlocksTable.startsAt))
    .limit(60);
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter((x): x is string => !!x))];
  const projects = new Map<string, { name: string; address: string }>();
  if (projectIds.length) for (const p of await db.select({ id: projectsTable.id, name: projectsTable.name, address: projectsTable.address }).from(projectsTable).where(inArray(projectsTable.id, projectIds))) projects.set(p.id, p);
  const milestoneIds = [...new Set(rows.map((r) => r.milestoneId).filter((x): x is string => !!x))];
  const milestones = new Map<string, string>();
  if (milestoneIds.length) for (const m of await db.select({ id: milestonesTable.id, title: milestonesTable.title }).from(milestonesTable).where(inArray(milestonesTable.id, milestoneIds))) milestones.set(m.id, m.title);
  return rows.map((b) => {
    const project = b.projectId ? projects.get(b.projectId) : undefined;
    return {
      id: b.id,
      projectId: b.projectId,
      label: blockLabel(b, project?.name ?? null, language),
      address: project?.address || null,
      milestoneTitle: b.milestoneId ? (milestones.get(b.milestoneId) ?? null) : null,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      allDay: b.allDay,
      notes: b.notes,
    };
  });
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
    const [openEntry] = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.workerId, r.worker.id), isNotNull(timeEntriesTable.clockInAt), isNull(timeEntriesTable.clockOutAt)));
    const activeEntry = openEntry ? serializeOwnEntry(openEntry, jobs.find((j) => j.id === openEntry.projectId)?.name ?? null, null) : null;
    res.json({ worker: { name: r.worker.name, role: r.worker.role }, companyName: r.companyName, language: r.language, jobs, entries: await ownEntries(r.worker, jobs), activeEntry, today: toIsoDate(localDayFor(new Date(), r.province)), schedule: await workerSchedule(r.worker, r.province, r.language === "fr" ? "fr" : "en") });
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
    const dayKey = toIsoDate(localDayFor(new Date(), r.province));
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

// POST /api/t/:token/clock-in
router.post("/t/:token/clock-in", writeLimiter, async (req, res) => {
  try {
    const r = await resolveWorker(req.params.token as string);
    if (!r || r.expired) {
      res.status(r?.expired ? 410 : 404).json({ error: r?.expired ? "EXPIRED" : "INVALID" });
      return;
    }
    const body = z
      .object({ projectId: z.string().uuid(), milestoneId: z.string().uuid().nullable().optional(), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const [existingOpen] = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.workerId, r.worker.id), isNotNull(timeEntriesTable.clockInAt), isNull(timeEntriesTable.clockOutAt)));
    if (existingOpen) {
      res.status(409).json({ error: "ALREADY_CLOCKED_IN", entry: serializeOwnEntry(existingOpen, null, null) });
      return;
    }
    const jobs = await workerJobs(r.worker);
    const job = jobs.find((j) => j.id === d.projectId);
    if (!job) {
      res.status(400).json({ error: "Invalid job" });
      return;
    }
    const milestoneId = d.milestoneId && job.milestones.some((m) => m.id === d.milestoneId) ? d.milestoneId : null;
    const now = new Date();
    const [entry] = await db
      .insert(timeEntriesTable)
      .values({
        userId: r.worker.userId,
        workerId: r.worker.id,
        projectId: job.id,
        milestoneId,
        date: localDayFor(now, r.province),
        hours: "0.00",
        rateCentsSnapshot: r.worker.hourlyRate,
        burdenPercentSnapshot: String(Number(r.worker.burdenPercent)),
        status: "submitted",
        enteredBy: "worker",
        clockInAt: now,
        clockInLat: d.lat !== undefined ? d.lat.toFixed(6) : null,
        clockInLng: d.lng !== undefined ? d.lng.toFixed(6) : null,
        geofenceFlagged: geofenceFlag(job, d.lat, d.lng),
      })
      .returning();
    await db.update(collaboratorsTable).set({ lastTimeEntryAt: now }).where(eq(collaboratorsTable.id, r.worker.id));
    res.status(201).json({ entry: serializeOwnEntry(entry!, job.name, milestoneId ? (job.milestones.find((m) => m.id === milestoneId)?.title ?? null) : null) });
  } catch (err) {
    req.log.error({ err }, "Error clocking in");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/t/:token/entries/:tid/clock-out
router.post("/t/:token/entries/:tid/clock-out", writeLimiter, async (req, res) => {
  try {
    const r = await resolveWorker(req.params.token as string);
    if (!r || r.expired) {
      res.status(r?.expired ? 410 : 404).json({ error: r?.expired ? "EXPIRED" : "INVALID" });
      return;
    }
    const body = z.object({ lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const [entry] = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.id, req.params.tid as string), eq(timeEntriesTable.workerId, r.worker.id)));
    if (!entry) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!entry.clockInAt || entry.clockOutAt) {
      res.status(409).json({ error: "NOT_OPEN", message: "This entry isn't a currently open clock-in." });
      return;
    }
    const jobs = await workerJobs(r.worker);
    const job = jobs.find((j) => j.id === entry.projectId);
    const now = new Date();
    const rawHours = (now.getTime() - entry.clockInAt.getTime()) / 3_600_000;
    const hours = Math.min(Math.max(rawHours, 0.01), MAX_SESSION_HOURS);
    const outFlag = job ? geofenceFlag(job, d.lat, d.lng) : false;
    const [updated] = await db
      .update(timeEntriesTable)
      .set({
        hours: hours.toFixed(2),
        clockOutAt: now,
        clockOutLat: d.lat !== undefined ? d.lat.toFixed(6) : null,
        clockOutLng: d.lng !== undefined ? d.lng.toFixed(6) : null,
        geofenceFlagged: entry.geofenceFlagged || outFlag,
        note: rawHours > MAX_SESSION_HOURS ? `${entry.note} (auto-capped at ${MAX_SESSION_HOURS}h — forgot to clock out?)`.trim() : entry.note,
      })
      .where(eq(timeEntriesTable.id, entry.id))
      .returning();
    await db.update(collaboratorsTable).set({ lastTimeEntryAt: now }).where(eq(collaboratorsTable.id, r.worker.id));
    const dayKey = toIsoDate(localDayFor(new Date(), r.province));
    const already = await db.select({ id: timeEntriesTable.id }).from(timeEntriesTable).where(and(eq(timeEntriesTable.workerId, r.worker.id), eq(timeEntriesTable.enteredBy, "worker"), gte(timeEntriesTable.createdAt, new Date(`${dayKey}T00:00:00Z`)))).limit(2);
    if (already.length <= 1) {
      await createNotification({ userId: r.worker.userId, type: "time_entry_submitted", title: r.language === "fr" ? `${r.worker.name} a saisi des heures` : `${r.worker.name} logged hours`, body: r.language === "fr" ? `${hours.toFixed(2)} h sur ${job?.name ?? ""} — à approuver dans Équipe.` : `${hours.toFixed(2)} h on ${job?.name ?? ""} — approve them under Team.`, link: "/dashboard/team?tab=time", entityType: "time_entry", entityId: updated!.id });
    }
    res.json({ entry: serializeOwnEntry(updated!, job?.name ?? null, updated!.milestoneId ? (job?.milestones.find((m) => m.id === updated!.milestoneId)?.title ?? null) : null) });
  } catch (err) {
    req.log.error({ err }, "Error clocking out");
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
