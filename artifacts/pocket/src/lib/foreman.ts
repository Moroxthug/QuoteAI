// The foreman's Home reads the office's "crew today" (routes/crew.ts GET /api/crew/today): who is booked where, who is on the clock,
// the hours waiting for approval, the blockers and what the field sent. Pure helpers here so the rules are tested (foreman.test.ts).
export type ForemanReport = { id: string; projectId: string; projectName: string | null; workerId: string | null; authorName: string | null; kind: "note" | "blocker" | "materials"; body: string; photoId: string | null; materialsCents: number | null; resolvedAt: string | null; resolutionNote: string | null; createdAt: string };
export type ForemanBlock = { blockId: string; workerId: string | null; workerName: string | null; startsAt: string; endsAt: string; allDay: boolean; title: string; clockedInAt: string | null; clockedInElsewhere: boolean };
export type ForemanJob = { jobId: string | null; jobName: string | null; address: string | null; crew: ForemanBlock[] };
export type ForemanClock = { entryId: string; workerId: string; workerName: string | null; projectId: string; projectName: string | null; since: string; geofenceFlagged: boolean };
export type ForemanHours = { id: string; workerId: string; workerName: string | null; projectId: string; projectName: string | null; date: string; hours: number; note: string | null; geofenceFlagged: boolean; clocked: boolean };
export type CrewTodayView =
  | { enabled: false; requiredPlan?: string }
  | { enabled: true; day: string; jobs: ForemanJob[]; clockedIn: ForemanClock[]; awaitingApproval: ForemanHours[]; blockers: ForemanReport[]; recentReports: ForemanReport[] };

export type CrewState = "on" | "elsewhere" | "later";
export type CrewLine = { workerId: string; name: string; jobName: string | null; state: CrewState; at: string };

/** One line per person booked today: on site (clocked in on that job), elsewhere (clocked in on another), or later. */
export function crewLines(jobs: ForemanJob[]): CrewLine[] {
  const seen = new Map<string, CrewLine>();
  for (const j of jobs) {
    for (const b of j.crew) {
      if (!b.workerId || !b.workerName) continue;
      const state: CrewState = b.clockedInAt ? "on" : b.clockedInElsewhere ? "elsewhere" : "later";
      const line: CrewLine = { workerId: b.workerId, name: b.workerName, jobName: j.jobName, state, at: b.clockedInAt ?? b.startsAt };
      const had = seen.get(b.workerId);
      // On site beats elsewhere beats later when someone is booked twice.
      const rank = (s: CrewState) => (s === "on" ? 0 : s === "elsewhere" ? 1 : 2);
      if (!had || rank(state) < rank(had.state)) seen.set(b.workerId, line);
    }
  }
  return [...seen.values()].sort((a, b) => (a.state === b.state ? a.name.localeCompare(b.name) : a.state === "on" ? -1 : b.state === "on" ? 1 : a.state === "elsewhere" ? -1 : 1));
}

export function onSiteCount(lines: CrewLine[]): number { return lines.filter((l) => l.state === "on").length; }
export function hoursTotal(rows: { hours: number }[]): number { return Math.round(rows.reduce((s, r) => s + r.hours, 0) * 10) / 10; }

/** A foreman's next blocks today, soonest first (the "Next up" list). */
export function nextUp(jobs: ForemanJob[], now: Date, limit = 5): { startsAt: string; allDay: boolean; title: string; jobName: string | null }[] {
  const out: { startsAt: string; allDay: boolean; title: string; jobName: string | null }[] = [];
  for (const j of jobs) for (const b of j.crew) if (new Date(b.endsAt) >= now) out.push({ startsAt: b.startsAt, allDay: b.allDay, title: b.title || j.jobName || "", jobName: j.jobName });
  return out.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)).slice(0, limit);
}
