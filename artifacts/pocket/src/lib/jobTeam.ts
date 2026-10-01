// The Team tab's figures (Job.dc.html): hours waiting for approval and the hours each person has on the job. Pure, so it is tested
// without a screen. Hours count once approved; a submitted entry is on the list to approve, not yet on the person's total.
import type { Assignment, JobDetail, TimeEntryRow } from "./jobDetail.ts";

export const hoursToApprove = (d: JobDetail): TimeEntryRow[] => d.timeEntries.filter((e) => e.status === "submitted");

export function hoursOnJob(d: JobDetail, workerId: string): number {
  return d.timeEntries.filter((e) => e.workerId === workerId && e.status === "approved").reduce((n, e) => n + e.hours, 0);
}

/** The crew, the people who have hours on the job without an assignment (a subcontractor who only clocked in) included. */
export function crewOnJob(d: JobDetail): { workerId: string; name: string; role: string; hours: number; assignmentId: string | null }[] {
  const rows = d.assignments.map((a: Assignment) => ({ workerId: a.collaboratorId, name: a.collaboratorName, role: a.roleInProject || a.collaboratorRole, hours: hoursOnJob(d, a.collaboratorId), assignmentId: a.id as string | null }));
  const have = new Set(rows.map((r) => r.workerId));
  for (const e of d.timeEntries) {
    if (have.has(e.workerId)) continue;
    have.add(e.workerId);
    rows.push({ workerId: e.workerId, name: e.workerName ?? "", role: "", hours: hoursOnJob(d, e.workerId), assignmentId: null });
  }
  return rows;
}

/** Whole hours as "8" and part hours with one decimal as "7.5" (the locale's own separator is applied by the caller). */
export const hoursText = (h: number): number => Math.round(h * 10) / 10;
