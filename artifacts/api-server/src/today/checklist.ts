// Pocket (docs/POCKET-DESIGN-PLAN.md, Phase 146) — the Home's "Today" list: what needs
// the person (needsYou: blockers, e-Transfers, overdue invoices, hours, call-backs,
// unanswered quotes) and the job tasks due by today, each with a round tick. Ticking a
// job task completes the task; ticking anything else says "dealt with today"
// (today_checks), so it shows done until the company's midnight.

import { and, asc, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import { db, projectTasksTable, projectsTable, todayChecksTable, type BusinessProfile } from "@workspace/db";
import { roleCan, type TeamMemberRole } from "@workspace/permissions";
import { needsYou, type NeedsYouItem } from "./service.js";
import { localParts } from "../schedule/service.js";
import { localMidnight } from "./business.js";
import { timeZoneForProvince } from "../jobs/dates.js";

const TASKS = 10;
const DAY_MS = 86_400_000;

export type ChecklistItem = (Omit<NeedsYouItem, "kind"> & { kind: NeedsYouItem["kind"] | "task" }) & {
  done: boolean;
  /** task: its job's name, and whole days past due (0 = due today). */
  jobName?: string;
};

export async function checklist(userId: string, memberUserId: string, role: TeamMemberRole, profile: BusinessProfile | undefined, now = new Date()): Promise<{ day: string; items: ChecklistItem[] }> {
  const province = profile?.province ?? null;
  const day = localParts(now, province).day;
  const [needs, ticks] = await Promise.all([
    needsYou(userId, role, profile, now),
    db.select({ itemId: todayChecksTable.itemId }).from(todayChecksTable).where(and(eq(todayChecksTable.memberUserId, memberUserId), eq(todayChecksTable.userId, userId), eq(todayChecksTable.day, day))),
  ]);
  const ticked = new Set(ticks.map((t) => t.itemId));
  const items: ChecklistItem[] = needs.map((n) => ({ ...n, done: ticked.has(n.id) }));

  if (roleCan(role, "jobs", "view")) {
    const tomorrow = new Date(localMidnight(day, timeZoneForProvince(province)).getTime() + DAY_MS);
    const tasks = await db
      .select({ id: projectTasksTable.id, title: projectTasksTable.title, status: projectTasksTable.status, dueDate: projectTasksTable.dueDate, projectId: projectTasksTable.projectId, jobName: projectsTable.name })
      .from(projectTasksTable)
      .innerJoin(projectsTable, eq(projectTasksTable.projectId, projectsTable.id))
      .where(and(eq(projectsTable.userId, userId), isNull(projectsTable.archivedAt), inArray(projectsTable.status, ["planning", "active"]), lt(projectTasksTable.dueDate, tomorrow), ne(projectTasksTable.status, "done")))
      .orderBy(asc(projectTasksTable.dueDate))
      .limit(TASKS);
    // Tasks finished today stay on the list, ticked.
    const tickedTasks = [...ticked].filter((i) => i.startsWith("task:")).map((i) => i.slice(5));
    const doneToday = tickedTasks.length === 0 ? [] : await db
      .select({ id: projectTasksTable.id, title: projectTasksTable.title, dueDate: projectTasksTable.dueDate, projectId: projectTasksTable.projectId, jobName: projectsTable.name })
      .from(projectTasksTable)
      .innerJoin(projectsTable, eq(projectTasksTable.projectId, projectsTable.id))
      .where(and(eq(projectsTable.userId, userId), eq(projectTasksTable.status, "done"), inArray(projectTasksTable.id, tickedTasks)));
    for (const t of [...tasks.map((x) => ({ ...x, done: false })), ...doneToday.map((x) => ({ ...x, done: true }))]) {
      const days = t.dueDate ? Math.max(0, Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${localParts(t.dueDate, province).day}T00:00:00Z`)) / DAY_MS)) : 0;
      items.push({ id: `task:${t.id}`, kind: "task", title: t.title, subtitle: "", jobName: t.jobName, at: t.dueDate?.toISOString() ?? null, href: `/dashboard/jobs/${t.projectId}?tab=tasks`, days, done: t.done });
    }
  }
  return { day, items };
}

/** Tick or untick an item for today. A job task is completed (or reopened) for real. */
export async function setChecked(userId: string, memberUserId: string, role: TeamMemberRole, province: string | null, itemId: string, done: boolean, now = new Date()): Promise<"ok" | "forbidden" | "not_found"> {
  const day = localParts(now, province).day;
  if (itemId.startsWith("task:")) {
    if (!roleCan(role, "jobs", "edit")) return "forbidden";
    const id = itemId.slice(5);
    const [task] = await db.select({ id: projectTasksTable.id }).from(projectTasksTable).innerJoin(projectsTable, eq(projectTasksTable.projectId, projectsTable.id)).where(and(eq(projectTasksTable.id, id), eq(projectsTable.userId, userId)));
    if (!task) return "not_found";
    await db.update(projectTasksTable).set({ status: done ? "done" : "todo" }).where(eq(projectTasksTable.id, id));
  }
  if (done) {
    await db.insert(todayChecksTable).values({ userId, memberUserId, day, itemId }).onConflictDoNothing();
  } else {
    await db.delete(todayChecksTable).where(and(eq(todayChecksTable.memberUserId, memberUserId), eq(todayChecksTable.day, day), eq(todayChecksTable.itemId, itemId)));
  }
  return "ok";
}
