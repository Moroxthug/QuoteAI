import { startOfWeek, addDays } from "date-fns";

// Phase 116: which jobs' full pages are fetched ahead for no signal (warm.ts).
// Its own module so date-fns stays out of the app shell (query-policy.ts is in it).

/** Job pages fetched ahead for no signal (warm.ts). */
const MAX_JOB_DETAILS = 15;

type JobForWeek = { id: string; status: string; archivedAt: string | null; plannedStart: string | null; plannedEnd: string | null; updatedAt: string };

/** The jobs worth having on a roof with no signal: running, or planned to overlap this week. */
export function jobsThisWeek<J extends JobForWeek>(jobs: J[], now: Date): J[] {
  const from = startOfWeek(now, { weekStartsOn: 1 }).getTime();
  const to = addDays(new Date(from), 7).getTime();
  return jobs
    .filter((j) => !j.archivedAt && (j.status === "active" || j.status === "planning"))
    .filter((j) => {
      if (j.status === "active") return true;
      const start = j.plannedStart ? new Date(j.plannedStart).getTime() : null;
      const end = j.plannedEnd ? new Date(j.plannedEnd).getTime() : start;
      return start !== null && start < to && (end ?? start) >= from;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_JOB_DETAILS);
}

