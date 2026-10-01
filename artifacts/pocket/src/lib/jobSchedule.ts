// The Schedule tab's crew grid (Job.dc.html "Crew, next 4 weeks"): one row per person, four weeks of five working days.
// A day is `j` when the person is on this job, `o` on another job, `x` when two of their blocks overlap, empty when free.
// Pure, so it is tested without a screen.
export type Block = { id: string; projectId: string | null; collaboratorId: string | null; collaboratorName: string | null; startsAt: string; endsAt: string; allDay: boolean; conflicts: string[]; projectName?: string | null };

export type DayCell = "j" | "o" | "x" | "";
export type CrewRow = { workerId: string; name: string; weeks: DayCell[][] };

/** The Monday of the week `d` falls in (a weekend belongs to the week before, so a Saturday still shows the week just worked). */
export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const back = (x.getDay() + 6) % 7; // Mon 0 ... Sun 6
  x.setDate(x.getDate() - back);
  return x;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function weekStarts(from: Date, weeks = 4): Date[] {
  const m = mondayOf(from);
  return Array.from({ length: weeks }, (_, i) => new Date(m.getFullYear(), m.getMonth(), m.getDate() + i * 7, 12));
}

function touches(b: Block, day: Date): boolean {
  const from = dayStart(day);
  const to = from + 86_400_000;
  return +new Date(b.startsAt) < to && +new Date(b.endsAt) > from;
}

export function crewGrid(blocks: Block[], jobId: string, people: { id: string; name: string }[], from: Date, weeks = 4): CrewRow[] {
  const starts = weekStarts(from, weeks);
  const names = new Map(people.map((p) => [p.id, p.name]));
  for (const b of blocks) if (b.collaboratorId && !names.has(b.collaboratorId)) names.set(b.collaboratorId, b.collaboratorName ?? "");
  return [...names].map(([workerId, name]) => {
    const mine = blocks.filter((b) => b.collaboratorId === workerId);
    return {
      workerId, name,
      weeks: starts.map((w) => Array.from({ length: 5 }, (_, i): DayCell => {
        const day = new Date(w.getFullYear(), w.getMonth(), w.getDate() + i, 12);
        const here = mine.filter((b) => touches(b, day));
        if (!here.length) return "";
        if (here.some((b) => b.conflicts.length > 0)) return "x";
        return here.some((b) => b.projectId === jobId) ? "j" : "o";
      })),
    };
  });
}

/** People who matter on this job's grid: assigned, or booked on it in the window. Someone only on other jobs is left out. */
export function relevantPeople(rows: CrewRow[], assigned: Set<string>): CrewRow[] {
  return rows.filter((r) => assigned.has(r.workerId) || r.weeks.some((w) => w.includes("j") || w.includes("x")));
}

export type Clash = { workerName: string; day: Date };

/** Double bookings that touch this job, one per person and day. */
export function jobClashes(blocks: Block[], jobId: string): Clash[] {
  const jobBlockIds = new Set(blocks.filter((b) => b.projectId === jobId).map((b) => b.id));
  const out = new Map<string, Clash>();
  for (const b of blocks) {
    if (!b.conflicts.length) continue;
    const hits = jobBlockIds.has(b.id) || b.conflicts.some((c) => jobBlockIds.has(c));
    if (!hits) continue;
    const day = new Date(new Date(b.startsAt).getFullYear(), new Date(b.startsAt).getMonth(), new Date(b.startsAt).getDate(), 12);
    out.set(`${b.collaboratorId}|${day.toDateString()}`, { workerName: b.collaboratorName ?? "", day });
  }
  return [...out.values()].sort((a, b) => +a.day - +b.day);
}
