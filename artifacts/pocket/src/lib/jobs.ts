// The Jobs tab's logic (Jobs.dc.html): the board's five states worked out from what the server holds, the
// figures, the filters and the groups. Pure, so it is tested without a screen.
// A job's setup is "pending review" until the contractor confirms the AI's plan; that is the board's "Review setup".

export type JobStatus = "planning" | "active" | "suspended" | "completed";
export type JobState = "setup" | "planning" | "active" | "hold" | "done";
export type JobFilter = "all" | "setup" | "planning" | "active" | "hold" | "done";

/** One row of GET /api/jobs. */
export type Job = {
  id: string;
  name: string;
  status: JobStatus;
  setupStatus: "pending_review" | "confirmed";
  clientId: string | null;
  clientName: string | null;
  address: string;
  totalValueCents: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  progressPercent: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  milestoneCount: number;
  milestonesDone: number;
  nextMilestone: { id: string; title: string; plannedEnd: string | null } | null;
  crewCount: number;
  crew: { id: string; name: string }[];
  invoicedCents: number;
  costCents: number;
  pendingReceiptCount: number;
  pendingReceiptCents: number;
};

export type JobsResponse = { items: Job[]; jobLimit: number | null; openJobs: number };

export const FILTER_ORDER: JobFilter[] = ["all", "setup", "planning", "active", "hold", "done"];
export const GROUP_ORDER: JobState[] = ["setup", "active", "planning", "hold", "done"];

export function jobState(j: Pick<Job, "status" | "setupStatus">): JobState {
  if (j.status === "completed") return "done";
  if (j.setupStatus === "pending_review") return "setup";
  if (j.status === "suspended") return "hold";
  return j.status === "active" ? "active" : "planning";
}

export const matchesFilter = (s: JobState, f: JobFilter): boolean => (f === "all" ? s !== "done" : f === s);

export const dollars = (cents: number): number => cents / 100;

/** The part of the contract earned so far and not yet invoiced. Never negative. */
export function toInvoiceCents(j: Pick<Job, "totalValueCents" | "progressPercent" | "invoicedCents">): number {
  return Math.max(0, Math.round((j.totalValueCents * j.progressPercent) / 100) - j.invoicedCents);
}

/** 0 to 100, whole percent of the contract invoiced; null when there is no value. */
export function invoicedPct(j: Pick<Job, "totalValueCents" | "invoicedCents">): number | null {
  return j.totalValueCents > 0 ? Math.round((j.invoicedCents / j.totalValueCents) * 100) : null;
}

export function costPct(j: Pick<Job, "totalValueCents" | "costCents">): number | null {
  return j.totalValueCents > 0 ? Math.round((j.costCents / j.totalValueCents) * 100) : null;
}

/** Margin on what has been invoiced; null until something is invoiced. */
export function marginPct(j: Pick<Job, "invoicedCents" | "costCents">): number | null {
  return j.invoicedCents > 0 ? Math.round(((j.invoicedCents - j.costCents) / j.invoicedCents) * 100) : null;
}

export type JobGlance = { inProgressCents: number; inProgressCount: number; toInvoiceCents: number; toInvoiceTop: Job | null };

export function glance(jobs: Job[]): JobGlance {
  const active = jobs.filter((j) => jobState(j) === "active");
  const owed = active.map((j) => ({ j, c: toInvoiceCents(j) })).filter((x) => x.c > 0).sort((a, b) => b.c - a.c);
  return {
    inProgressCents: active.reduce((n, j) => n + j.totalValueCents, 0),
    inProgressCount: active.length,
    toInvoiceCents: owed.reduce((n, x) => n + x.c, 0),
    toInvoiceTop: owed[0]?.j ?? null,
  };
}

/** Pending receipts across jobs: how many, how much, and the job with the most (the board names one job). */
export function receiptsToReview(jobs: Job[]): { count: number; cents: number; top: Job } | null {
  const withAny = jobs.filter((j) => j.pendingReceiptCount > 0);
  if (!withAny.length) return null;
  const top = [...withAny].sort((a, b) => b.pendingReceiptCount - a.pendingReceiptCount)[0]!;
  return { count: withAny.reduce((n, j) => n + j.pendingReceiptCount, 0), cents: withAny.reduce((n, j) => n + j.pendingReceiptCents, 0), top };
}

export const firstName = (full: string | null | undefined): string => (full ?? "").trim().split(/\s+/)[0] ?? "";

/** Whole days from `now` (local midnight) to a YYYY-MM-DD date; negative when it has passed. */
export function daysUntil(isoDate: string, now: Date): number {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const from = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y!, m! - 1, d!) - from) / 86_400_000);
}

/** A YYYY-MM-DD date as a local Date (noon, so formatting in any zone keeps the day). */
export function dateOnly(isoDate: string): Date {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

export type Clash = { workerId: string; workerName: string; from: Date; to: Date; jobs: [string, string] };

type DayBlock = { workerId: string | null; workerName: string | null; startsAt: string; endsAt: string; allDay: boolean };
type DayJob = { jobId: string | null; jobName: string | null; crew: DayBlock[] };

/** Workers booked on two jobs at overlapping times today (the board's "Luca is booked twice, 9 to 11"). */
export function clashes(day: DayJob[]): Clash[] {
  const per = new Map<string, { name: string; blocks: { job: string; from: number; to: number }[] }>();
  for (const j of day) {
    if (!j.jobId) continue;
    for (const b of j.crew) {
      if (!b.workerId || b.allDay) continue;
      const row = per.get(b.workerId) ?? { name: b.workerName ?? "", blocks: [] };
      row.blocks.push({ job: j.jobName ?? "", from: +new Date(b.startsAt), to: +new Date(b.endsAt) });
      per.set(b.workerId, row);
    }
  }
  const out: Clash[] = [];
  for (const [workerId, row] of per) {
    const bs = [...row.blocks].sort((a, b) => a.from - b.from);
    for (let i = 0; i < bs.length; i++) {
      for (let k = i + 1; k < bs.length; k++) {
        const a = bs[i]!, b = bs[k]!;
        if (b.from >= a.to) break;
        if (a.job === b.job) continue;
        out.push({ workerId, workerName: row.name, from: new Date(Math.max(a.from, b.from)), to: new Date(Math.min(a.to, b.to)), jobs: [a.job, b.job] });
      }
    }
  }
  return out;
}
