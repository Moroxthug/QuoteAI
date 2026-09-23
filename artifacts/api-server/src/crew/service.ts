// Phase 86 (docs/OPERATIONS-PLATFORM-PLAN.md): the crew's app.
//
// Two audiences read the same facts. The worker on /t/:token needs *their*
// day — the jobs they are booked on, the tasks under each, where the site is
// and who to call there — and a way to report back without an account. The
// foreman needs *everyone's* day — who is where, who is clocked in, what is
// waiting for approval, what is blocked. Both are derived from rows that
// already exist (schedule blocks, tasks, time entries); the only new source of
// truth is `field_reports`.

import {
  db,
  clientsTable,
  collaboratorsTable,
  costEntriesTable,
  fieldReportsTable,
  milestonesTable,
  projectTasksTable,
  projectsTable,
  scheduleBlocksTable,
  timeEntriesTable,
  type FieldReport,
  type FieldReportKind,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, or, type SQL } from "drizzle-orm";
import { localParts } from "../schedule/service.js";
import { toIsoDate } from "../jobs/dates.js";
import { createNotification } from "../lib/notifications.js";
import { storeJobPhoto } from "../jobs/photos.js";

const DAY_MS = 86_400_000;

/** Tasks shown per job on the worker page — a crew needs today's list, not the whole backlog. */
const TASKS_PER_JOB = 25;

/** "YYYY-MM-DD" of now in the company's zone. */
export function localToday(province: string | null | undefined, now = new Date()): string {
  return localParts(now, province).day;
}

/** Whether a block covers any part of a local day. The end is exclusive: a block ending at local midnight is not on the next day. */
export function touchesLocalDay(block: { startsAt: Date; endsAt: Date }, day: string, province: string | null | undefined): boolean {
  return localParts(block.startsAt, province).day <= day && localParts(new Date(block.endsAt.getTime() - 1), province).day >= day;
}

/**
 * Schedule blocks that touch a local day. Blocks are stored as instants, so
 * the query takes a generous UTC window and the local-day test is done here —
 * a 5 pm Vancouver block is already "tomorrow" in UTC.
 */
export async function blocksOnDay(where: SQL, day: string, province: string | null | undefined) {
  const anchor = new Date(`${day}T00:00:00Z`);
  const rows = await db
    .select()
    .from(scheduleBlocksTable)
    .where(and(where, lt(scheduleBlocksTable.startsAt, new Date(anchor.getTime() + 2 * DAY_MS)), gte(scheduleBlocksTable.endsAt, new Date(anchor.getTime() - DAY_MS))))
    .orderBy(asc(scheduleBlocksTable.startsAt))
    .limit(300);
  return rows.filter((b) => touchesLocalDay(b, day, province));
}

export type SiteContact = { name: string; phone: string | null };

/** The client on each job, as the person on site to call. Email is left out on purpose — a crew calls or texts. */
export async function siteContacts(projectIds: string[]): Promise<Map<string, SiteContact>> {
  const out = new Map<string, SiteContact>();
  if (!projectIds.length) return out;
  const rows = await db
    .select({ projectId: projectsTable.id, name: clientsTable.name, phone: clientsTable.phone })
    .from(projectsTable)
    .innerJoin(clientsTable, eq(clientsTable.id, projectsTable.clientId))
    .where(inArray(projectsTable.id, projectIds));
  for (const r of rows) out.set(r.projectId, { name: r.name, phone: r.phone || null });
  return out;
}

export type CrewTask = { id: string; title: string; status: string; milestoneTitle: string | null; dueDate: string | null };

/** Open tasks per job (plus anything ticked done today, so a tick does not vanish under the worker's thumb). */
export async function tasksForJobs(projectIds: string[], since: Date): Promise<Map<string, CrewTask[]>> {
  const out = new Map<string, CrewTask[]>();
  if (!projectIds.length) return out;
  const rows = await db
    .select()
    .from(projectTasksTable)
    .where(and(inArray(projectTasksTable.projectId, projectIds), or(inArray(projectTasksTable.status, ["todo", "in_progress"]), and(eq(projectTasksTable.status, "done"), gte(projectTasksTable.updatedAt, since)))))
    .orderBy(asc(projectTasksTable.sortOrder), asc(projectTasksTable.createdAt));
  const milestoneIds = [...new Set(rows.map((r) => r.milestoneId).filter((x): x is string => !!x))];
  const titles = new Map<string, string>();
  if (milestoneIds.length) for (const m of await db.select({ id: milestonesTable.id, title: milestonesTable.title }).from(milestonesTable).where(inArray(milestonesTable.id, milestoneIds))) titles.set(m.id, m.title);
  for (const r of rows) {
    const list = out.get(r.projectId) ?? [];
    if (list.length >= TASKS_PER_JOB) continue;
    list.push({ id: r.id, title: r.title, status: r.status, milestoneTitle: r.milestoneId ? (titles.get(r.milestoneId) ?? null) : null, dueDate: toIsoDate(r.dueDate) });
    out.set(r.projectId, list);
  }
  return out;
}

function serializeReport(r: FieldReport, projectName: string | null) {
  return {
    id: r.id,
    projectId: r.projectId,
    projectName,
    milestoneId: r.milestoneId,
    workerId: r.workerId,
    authorName: r.authorName,
    kind: r.kind,
    body: r.body,
    photoId: r.photoId,
    materialsCents: r.materialsCents,
    costEntryId: r.costEntryId,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    resolvedByName: r.resolvedByName,
    resolutionNote: r.resolutionNote,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function serializeReports(rows: FieldReport[]) {
  const ids = [...new Set(rows.map((r) => r.projectId))];
  const names = new Map<string, string>();
  if (ids.length) for (const p of await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(inArray(projectsTable.id, ids))) names.set(p.id, p.name);
  return rows.map((r) => serializeReport(r, names.get(r.projectId) ?? null));
}

export class FieldReportError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/**
 * Stores what a worker sent from the field. Order matters for a replay: the
 * report is looked up by clientRef first, and the photo and cost entry reuse
 * the same clientRef, so a request that died after the photo was stored
 * resumes rather than doubling anything.
 */
export async function createFieldReport(params: {
  worker: { id: string; userId: string; name: string };
  job: { id: string; name: string; milestones: { id: string }[] };
  kind: FieldReportKind;
  body: string;
  milestoneId: string | null;
  materialsCents: number | null;
  file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | null;
  clientRef: string | null;
  language: "en" | "fr";
}): Promise<{ report: FieldReport; replayed: boolean }> {
  const { worker, job, kind, clientRef, language } = params;
  if (clientRef) {
    const [existing] = await db.select().from(fieldReportsTable).where(and(eq(fieldReportsTable.workerId, worker.id), eq(fieldReportsTable.clientRef, clientRef)));
    if (existing) return { report: existing, replayed: true };
  }
  const body = params.body.trim();
  if (kind === "materials" && !(params.materialsCents && params.materialsCents > 0) && !body) throw new FieldReportError("EMPTY", "Say what was used, or what it cost.");
  if (kind !== "materials" && !body && !params.file) throw new FieldReportError("EMPTY", "Add a photo or a few words.");
  const milestoneId = params.milestoneId && job.milestones.some((m) => m.id === params.milestoneId) ? params.milestoneId : null;

  let photoId: string | null = null;
  if (params.file) {
    const stored = await storeJobPhoto({ userId: worker.userId, projectId: job.id, file: params.file, caption: body ? `${body} — ${worker.name}` : worker.name, milestoneId, clientRef });
    photoId = stored.photo.id;
  }

  let costEntryId: string | null = null;
  const materialsCents = kind === "materials" && params.materialsCents && params.materialsCents > 0 ? params.materialsCents : null;
  if (kind === "materials") {
    // Pending review, not confirmed: a number typed on a phone on a ladder is a
    // claim until the office matches it to a receipt. It shows up in the costs
    // review queue and only counts against the budget once confirmed.
    const [existingCost] = clientRef ? await db.select().from(costEntriesTable).where(and(eq(costEntriesTable.userId, worker.userId), eq(costEntriesTable.clientRef, clientRef))) : [];
    const cost =
      existingCost ??
      (
        await db
          .insert(costEntriesTable)
          .values({
            userId: worker.userId,
            projectId: job.id,
            milestoneId,
            category: "materials",
            description: `${body || (language === "fr" ? "Matériaux" : "Materials")} (${worker.name})`.slice(0, 500),
            subtotalCents: materialsCents ?? 0,
            totalCents: materialsCents ?? 0,
            status: "pending_review",
            source: "manual",
            createdBy: "user",
            clientRef,
          })
          .returning()
      )[0]!;
    costEntryId = cost.id;
  }

  const [report] = await db
    .insert(fieldReportsTable)
    .values({ userId: worker.userId, projectId: job.id, milestoneId, workerId: worker.id, authorName: worker.name, kind, body: body.slice(0, 1000), photoId, materialsCents, costEntryId, clientRef })
    .returning();

  const fr = language === "fr";
  if (kind === "blocker") {
    await createNotification({
      userId: worker.userId,
      type: "field_blocker",
      title: fr ? `${worker.name} est bloqué sur ${job.name}` : `${worker.name} is blocked on ${job.name}`,
      body: body || (fr ? "Photo envoyée du chantier." : "Photo sent from site."),
      link: `/dashboard/jobs/${job.id}`,
      entityType: "field_report",
      entityId: report!.id,
    });
  } else {
    // One bell entry per worker per job per day keeps the bell useful; the job's field card has every report.
    const since = new Date(Date.now() - DAY_MS);
    const recent = await db.select({ id: fieldReportsTable.id }).from(fieldReportsTable).where(and(eq(fieldReportsTable.workerId, worker.id), eq(fieldReportsTable.projectId, job.id), gte(fieldReportsTable.createdAt, since))).limit(2);
    if (recent.length <= 1) {
      await createNotification({
        userId: worker.userId,
        type: "field_report",
        title: kind === "materials" ? (fr ? `${worker.name} a noté des matériaux` : `${worker.name} logged materials`) : fr ? `${worker.name} a envoyé une mise à jour` : `${worker.name} sent an update`,
        body: `${job.name}${body ? ` — ${body.slice(0, 140)}` : ""}`,
        link: `/dashboard/jobs/${job.id}`,
        entityType: "field_report",
        entityId: report!.id,
      });
    }
  }
  return { report: report!, replayed: false };
}

/** Everything the foreman's landing page shows, for one company, for one local day. */
export async function crewToday(userId: string, province: string | null | undefined, now = new Date()) {
  const day = localToday(province, now);
  const blocks = await blocksOnDay(eq(scheduleBlocksTable.userId, userId), day, province);

  const openEntries = await db
    .select()
    .from(timeEntriesTable)
    .where(and(eq(timeEntriesTable.userId, userId), isNotNull(timeEntriesTable.clockInAt), isNull(timeEntriesTable.clockOutAt)))
    .limit(200);
  const awaiting = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.status, "submitted"), isNotNull(timeEntriesTable.clockOutAt))).orderBy(desc(timeEntriesTable.date)).limit(50);
  const manualAwaiting = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.status, "submitted"), isNull(timeEntriesTable.clockInAt))).orderBy(desc(timeEntriesTable.date)).limit(50);
  const toApprove = [...awaiting, ...manualAwaiting].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 50);

  const blockers = await db.select().from(fieldReportsTable).where(and(eq(fieldReportsTable.userId, userId), eq(fieldReportsTable.kind, "blocker"), isNull(fieldReportsTable.resolvedAt))).orderBy(desc(fieldReportsTable.createdAt)).limit(30);
  const recent = await db.select().from(fieldReportsTable).where(and(eq(fieldReportsTable.userId, userId), gte(fieldReportsTable.createdAt, new Date(now.getTime() - 2 * DAY_MS)))).orderBy(desc(fieldReportsTable.createdAt)).limit(12);

  const workerIds = [...new Set([...blocks.map((b) => b.collaboratorId), ...openEntries.map((e) => e.workerId), ...toApprove.map((e) => e.workerId)].filter((x): x is string => !!x))];
  const workers = new Map<string, string>();
  if (workerIds.length) for (const w of await db.select({ id: collaboratorsTable.id, name: collaboratorsTable.name }).from(collaboratorsTable).where(and(eq(collaboratorsTable.userId, userId), inArray(collaboratorsTable.id, workerIds)))) workers.set(w.id, w.name);

  const projectIds = [...new Set([...blocks.map((b) => b.projectId), ...openEntries.map((e) => e.projectId), ...toApprove.map((e) => e.projectId)].filter((x): x is string => !!x))];
  const projects = new Map<string, { name: string; address: string }>();
  if (projectIds.length) for (const p of await db.select({ id: projectsTable.id, name: projectsTable.name, address: projectsTable.address }).from(projectsTable).where(and(eq(projectsTable.userId, userId), inArray(projectsTable.id, projectIds)))) projects.set(p.id, p);

  const clockedIn = new Map(openEntries.map((e) => [e.workerId, e]));
  // One card per job, the crew under it. A block with no job (a day off, a yard day) goes under "other".
  const byJob = new Map<string, { jobId: string | null; jobName: string | null; address: string | null; crew: { blockId: string; workerId: string | null; workerName: string | null; startsAt: string; endsAt: string; allDay: boolean; title: string; clockedInAt: string | null; clockedInElsewhere: boolean }[] }>();
  for (const b of blocks) {
    const key = b.projectId ?? "_other";
    const job = b.projectId ? projects.get(b.projectId) : undefined;
    const group = byJob.get(key) ?? { jobId: b.projectId, jobName: job?.name ?? null, address: job?.address || null, crew: [] };
    const open = b.collaboratorId ? clockedIn.get(b.collaboratorId) : undefined;
    group.crew.push({
      blockId: b.id,
      workerId: b.collaboratorId,
      workerName: b.collaboratorId ? (workers.get(b.collaboratorId) ?? null) : null,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      allDay: b.allDay,
      title: b.title,
      clockedInAt: open && open.projectId === b.projectId ? open.clockInAt!.toISOString() : null,
      clockedInElsewhere: !!open && open.projectId !== b.projectId,
    });
    byJob.set(key, group);
  }

  return {
    day,
    jobs: [...byJob.values()].sort((a, b) => (a.jobId ? 0 : 1) - (b.jobId ? 0 : 1) || (a.jobName ?? "").localeCompare(b.jobName ?? "")),
    clockedIn: openEntries.map((e) => ({ entryId: e.id, workerId: e.workerId, workerName: workers.get(e.workerId) ?? null, projectId: e.projectId, projectName: projects.get(e.projectId)?.name ?? null, since: e.clockInAt!.toISOString(), geofenceFlagged: e.geofenceFlagged })),
    awaitingApproval: toApprove.map((e) => ({ id: e.id, workerId: e.workerId, workerName: workers.get(e.workerId) ?? null, projectId: e.projectId, projectName: projects.get(e.projectId)?.name ?? null, date: toIsoDate(e.date), hours: Number(e.hours), note: e.note, geofenceFlagged: e.geofenceFlagged, clocked: !!e.clockInAt })),
    blockers: await serializeReports(blockers),
    recentReports: await serializeReports(recent),
  };
}
