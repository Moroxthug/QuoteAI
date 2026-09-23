// Phase 86b (docs/OPERATIONS-PLATFORM-PLAN.md): "since you last looked".
//
// The worker page always showed the current state — today's tasks, the notes
// on a shift — but a crew member who opens it at 6 am cannot tell that the
// office moved Thursday, took them off Friday, added two tasks to the kitchen
// and answered yesterday's blocker. This is that list, built from facts that
// already exist:
//   • shifts   — the schedule's own audit rows (created / moved / updated /
//                deleted). A block's updated_at is no use: the reminder cron
//                touches it, and a deleted block leaves no row at all.
//   • tasks    — project_tasks.updated_at, minus the changes this worker made
//                themselves (field_updated_by / field_updated_at).
//   • answers  — their own blockers the office has marked sorted.
// The marker is collaborators.crew_seen_at, moved forward only when the worker
// says "Got it" — reloading the page does not wipe the list.

import { db, auditLogTable, collaboratorsTable, fieldReportsTable, projectAssignmentsTable, projectTasksTable, projectsTable, scheduleBlocksTable } from "@workspace/db";
import { and, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { blockLabel } from "../schedule/service.js";

const DAY_MS = 86_400_000;
/** Older than this is not "since you last looked", it is history. */
const CHANGES_MAX_AGE_MS = 14 * DAY_MS;
const MAX_CHANGES = 30;

type ShiftChange = { kind: "shift_added" | "shift_changed" | "shift_removed"; at: string; blockId: string; projectId: string | null; label: string; startsAt: string; endsAt: string; allDay: boolean };
type TaskChange = { kind: "task_added" | "task_changed" | "task_done"; at: string; taskId: string; projectId: string; projectName: string; title: string; by: string | null };
type AnswerChange = { kind: "answer"; at: string; reportId: string; projectId: string; projectName: string | null; body: string; answer: string | null; by: string | null };
export type CrewChange = ShiftChange | TaskChange | AnswerChange;

/** One schedule audit row, as far as this worker is concerned. */
export type ShiftEvent = {
  blockId: string;
  action: string;
  at: Date;
  /** Who the block was on before the event (moved/updated) or at the time (created/deleted). */
  fromWorker: string | null;
  toWorker: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

type ShiftVerdict = { kind: ShiftChange["kind"]; at: Date; startsAt: string | null; endsAt: string | null };

/**
 * Collapses a block's audit trail since the marker into what the worker needs
 * to hear, or nothing. Created-then-deleted is nothing; moved onto someone
 * else is "removed"; created (or moved onto them) is "added"; anything else
 * that still leaves the block on them is "changed".
 */
export function collapseShiftEvents(events: ShiftEvent[], workerId: string): ShiftVerdict | null {
  if (!events.length) return null;
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const hadItBefore = first.action === "created" ? false : first.fromWorker === workerId;
  const hasItNow = last.action === "deleted" ? false : last.toWorker === workerId;
  if (!hadItBefore && !hasItNow) return null;
  if (hadItBefore && !hasItNow) {
    // Where it was when it left them — the "from" side of the last event.
    return { kind: "shift_removed", at: last.at, startsAt: last.startsAt, endsAt: last.endsAt };
  }
  return { kind: hadItBefore ? "shift_changed" : "shift_added", at: last.at, startsAt: null, endsAt: null };
}

function eventFromAudit(row: { entityId: string; action: string; createdAt: Date; diff: Record<string, unknown> | null }): ShiftEvent {
  const d = (row.diff ?? {}) as { collaboratorId?: string | null; startsAt?: string; endsAt?: string; from?: { collaboratorId?: string | null; startsAt?: string; endsAt?: string }; to?: { collaboratorId?: string | null } };
  if (row.action === "created" || row.action === "deleted") {
    const who = d.collaboratorId ?? null;
    return { blockId: row.entityId, action: row.action, at: row.createdAt, fromWorker: who, toWorker: who, startsAt: d.startsAt ?? null, endsAt: d.endsAt ?? null };
  }
  return { blockId: row.entityId, action: row.action, at: row.createdAt, fromWorker: d.from?.collaboratorId ?? null, toWorker: d.to?.collaboratorId ?? null, startsAt: d.from?.startsAt ?? null, endsAt: d.from?.endsAt ?? null };
}

/** The jobs whose tasks this worker cares about: assigned, or booked from yesterday to two weeks out. */
async function followedJobs(worker: { id: string; userId: string }, now: Date): Promise<string[]> {
  const assigned = await db.select({ projectId: projectAssignmentsTable.projectId }).from(projectAssignmentsTable).where(eq(projectAssignmentsTable.collaboratorId, worker.id));
  const booked = await db
    .select({ projectId: scheduleBlocksTable.projectId })
    .from(scheduleBlocksTable)
    .where(and(eq(scheduleBlocksTable.collaboratorId, worker.id), isNotNull(scheduleBlocksTable.projectId), gte(scheduleBlocksTable.endsAt, new Date(now.getTime() - DAY_MS)), lt(scheduleBlocksTable.startsAt, new Date(now.getTime() + 15 * DAY_MS))));
  return [...new Set([...assigned.map((a) => a.projectId), ...booked.map((b) => b.projectId!)])];
}

/**
 * Everything the office changed for this worker after `since`, newest first.
 * Past shifts are left out (moving yesterday's block is bookkeeping, not news).
 */
export async function workerChanges(worker: { id: string; userId: string }, since: Date, lang: "en" | "fr", now = new Date()): Promise<CrewChange[]> {
  const floor = new Date(Math.max(since.getTime(), now.getTime() - CHANGES_MAX_AGE_MS));
  const out: CrewChange[] = [];

  // ── Shifts ──
  const w = worker.id;
  const audit = await db
    .select({ entityId: auditLogTable.entityId, action: auditLogTable.action, createdAt: auditLogTable.createdAt, diff: auditLogTable.diff })
    .from(auditLogTable)
    .where(
      and(
        eq(auditLogTable.userId, worker.userId),
        eq(auditLogTable.entityType, "schedule_block"),
        gt(auditLogTable.createdAt, floor),
        sql`(${auditLogTable.diff}->>'collaboratorId' = ${w} or ${auditLogTable.diff}->'from'->>'collaboratorId' = ${w} or ${auditLogTable.diff}->'to'->>'collaboratorId' = ${w})`,
      ),
    )
    .limit(300);
  const byBlock = new Map<string, ShiftEvent[]>();
  for (const row of audit) byBlock.set(row.entityId, [...(byBlock.get(row.entityId) ?? []), eventFromAudit(row)]);
  const verdicts = [...byBlock].map(([blockId, events]) => [blockId, collapseShiftEvents(events, w)] as const).filter((x): x is readonly [string, ShiftVerdict] => !!x[1]);
  const liveIds = verdicts.filter(([, v]) => v.kind !== "shift_removed").map(([id]) => id);
  const blocks = new Map((liveIds.length ? await db.select().from(scheduleBlocksTable).where(and(eq(scheduleBlocksTable.userId, worker.userId), inArray(scheduleBlocksTable.id, liveIds))) : []).map((b) => [b.id, b]));
  const blockProjects = [...new Set([...blocks.values()].map((b) => b.projectId).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (blockProjects.length) for (const p of await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(inArray(projectsTable.id, blockProjects))) names.set(p.id, p.name);
  for (const [blockId, v] of verdicts) {
    if (v.kind === "shift_removed") {
      if (!v.startsAt || !v.endsAt || new Date(v.endsAt).getTime() < now.getTime()) continue;
      out.push({ kind: v.kind, at: v.at.toISOString(), blockId, projectId: null, label: "", startsAt: new Date(v.startsAt).toISOString(), endsAt: new Date(v.endsAt).toISOString(), allDay: false });
      continue;
    }
    const b = blocks.get(blockId);
    if (!b || b.collaboratorId !== w || b.endsAt.getTime() < now.getTime()) continue;
    out.push({ kind: v.kind, at: v.at.toISOString(), blockId, projectId: b.projectId, label: blockLabel(b, b.projectId ? names.get(b.projectId) : null, lang), startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString(), allDay: b.allDay });
  }

  // ── Tasks ──
  const jobIds = await followedJobs(worker, now);
  if (jobIds.length) {
    const rows = await db
      .select({ task: projectTasksTable, projectName: projectsTable.name })
      .from(projectTasksTable)
      .innerJoin(projectsTable, eq(projectsTable.id, projectTasksTable.projectId))
      .where(
        and(
          eq(projectsTable.userId, worker.userId),
          inArray(projectTasksTable.projectId, jobIds),
          gt(projectTasksTable.updatedAt, floor),
          // Not a change this worker made themselves (their tick or their own new task).
          or(isNull(projectTasksTable.fieldUpdatedBy), ne(projectTasksTable.fieldUpdatedBy, w), lt(projectTasksTable.fieldUpdatedAt, projectTasksTable.updatedAt)),
        ),
      )
      .orderBy(desc(projectTasksTable.updatedAt))
      .limit(60);
    const otherCrew = [...new Set(rows.map((r) => r.task.fieldUpdatedBy).filter((x): x is string => !!x && x !== w))];
    const crewNames = new Map<string, string>();
    if (otherCrew.length) for (const c of await db.select({ id: collaboratorsTable.id, name: collaboratorsTable.name }).from(collaboratorsTable).where(inArray(collaboratorsTable.id, otherCrew))) crewNames.set(c.id, c.name);
    for (const { task, projectName } of rows) {
      const fromField = !!task.fieldUpdatedAt && task.fieldUpdatedAt.getTime() >= task.updatedAt.getTime();
      const by = fromField && task.fieldUpdatedBy ? (crewNames.get(task.fieldUpdatedBy) ?? null) : null;
      // A task they added themselves is never "new" to them — only what the office did to it since.
      const isNew = task.createdAt.getTime() > floor.getTime() && task.createdByWorkerId !== w;
      const kind: TaskChange["kind"] = isNew ? "task_added" : task.status === "done" ? "task_done" : "task_changed";
      out.push({ kind, at: task.updatedAt.toISOString(), taskId: task.id, projectId: task.projectId, projectName, title: task.title, by: kind === "task_added" ? (task.createdByName ?? by) : by });
    }
  }

  // ── Answers to their blockers ──
  const answered = await db
    .select({ report: fieldReportsTable, projectName: projectsTable.name })
    .from(fieldReportsTable)
    .leftJoin(projectsTable, eq(projectsTable.id, fieldReportsTable.projectId))
    .where(and(eq(fieldReportsTable.workerId, w), eq(fieldReportsTable.kind, "blocker"), gt(fieldReportsTable.resolvedAt, floor)))
    .orderBy(desc(fieldReportsTable.resolvedAt))
    .limit(10);
  for (const { report, projectName } of answered) {
    out.push({ kind: "answer", at: report.resolvedAt!.toISOString(), reportId: report.id, projectId: report.projectId, projectName, body: report.body, answer: report.resolutionNote, by: report.resolvedByName });
  }

  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_CHANGES);
}
