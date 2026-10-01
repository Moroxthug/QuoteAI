// The crew's phone (CrewNow, CrewHours, CrewTravel, LiveLocation, CrewExpired): what the worker's link returns (GET /api/t/:token), and the small pure
// rules the screens use. A worker sees only their own day and hours; nothing with a price on it. Pure, so it is tested.

export type CrewJob = {
  id: string; name: string; address: string | null; latitude: string | null; longitude: string | null; geofenceRadiusMeters: number | null;
  milestones: { id: string; title: string; status: string }[];
};

export type CrewEntry = {
  id: string; projectId: string; projectName: string | null; milestoneId: string | null; milestoneTitle: string | null; date: string; hours: number; note: string;
  status: "submitted" | "approved" | "rejected" | string; rejectedReason: string | null; clockInAt: string | null; clockOutAt: string | null; geofenceFlagged: boolean; createdAt: string;
};

export type CrewTask = { id: string; title: string; status: string; milestoneTitle: string | null; dueDate: string | null; addedBy: string | null };
export type CrewBlock = { id: string; startsAt: string; endsAt: string; allDay: boolean; notes: string };
export type CrewTodayJob = { id: string; name: string; address: string | null; contact: { name: string; phone: string | null } | null; blocks: CrewBlock[]; tasks: CrewTask[] };
export type CrewReport = { id: string; projectId: string; projectName: string | null; kind: "note" | "blocker" | "materials"; body: string; materialsCents: number | null; resolvedAt: string | null; resolutionNote: string | null; createdAt: string };
export type CrewAllowance = { id: string; date: string; kind: "mileage" | "per_diem"; quantity: number; note: string; projectName: string | null; status: string; rejectedReason: string | null };
export type CrewScheduleItem = { id: string; projectId: string | null; projectName: string | null; address: string | null; milestoneTitle: string | null; startsAt: string; endsAt: string; allDay: boolean; notes: string };

export type CrewChange =
  | { kind: "shift_added" | "shift_changed" | "shift_removed"; at: string; blockId: string; projectId: string | null; label: string; startsAt: string; endsAt: string; allDay: boolean }
  | { kind: "task_added" | "task_changed" | "task_done"; at: string; taskId: string; projectId: string; projectName: string; title: string; by: string | null }
  | { kind: "answer"; at: string; reportId: string; projectId: string; projectName: string | null; body: string; answer: string | null; by: string | null };

export type CrewView = {
  worker: { name: string; role: string; canAddTasks: boolean };
  travel: { km: boolean; perDiem: boolean } | null;
  allowances: CrewAllowance[];
  companyName: string;
  language: "en" | "fr";
  jobs: CrewJob[];
  entries: CrewEntry[];
  activeEntry: CrewEntry | null;
  today: string;
  schedule: CrewScheduleItem[];
  todayJobs: CrewTodayJob[];
  reports: CrewReport[];
  changes: CrewChange[];
  changesUpTo: string;
  companies: { workerId: string; companyName: string; current: boolean; primary: boolean }[];
};

/** Why the link doesn't open: the server's answer, or no signal. */
export type LinkProblem = "expired" | "replaced" | "invalid" | "offline";

export function linkProblem(failure: { status: number; code?: string }): LinkProblem | null {
  if (failure.status === 0) return "offline";
  if (failure.status === 410) return failure.code === "REPLACED" ? "replaced" : "expired";
  if (failure.status === 404) return "invalid";
  return null;
}

const pad = (n: number) => (n < 10 ? "0" : "") + n;

/** 9728000 ms → "2:42:08". */
export function timer(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

/** 9728000 ms → { h: 2, m: 42 }. */
export function hm(ms: number): { h: number; m: number } {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { h: Math.floor(s / 3600), m: Math.floor(s / 60) % 60 };
}

/** Time on the clock today: closed sessions today plus the open one. */
export function workedToday(entries: CrewEntry[], active: CrewEntry | null, today: string, now: Date): number {
  const closed = entries.filter((e) => e.date === today && e.clockInAt && e.clockOutAt && e.id !== active?.id).reduce((n, e) => n + (+new Date(e.clockOutAt!) - +new Date(e.clockInAt!)), 0);
  return closed + (active?.clockInAt ? Math.max(0, +now - +new Date(active.clockInAt)) : 0);
}

/** Hours on the entries of a week (Monday to Sunday, local) whose day is in `days`. */
export function hoursOn(entries: CrewEntry[], days: string[]): number {
  return entries.filter((e) => days.includes(e.date)).reduce((n, e) => n + e.hours, 0);
}

/** 8.03 h → "8h 02m" (minutes rounded). */
export function hoursLabel(h: number): { h: number; m: number } {
  const total = Math.round(h * 60);
  return { h: Math.floor(total / 60), m: total % 60 };
}

export type EntryLook = { tone: "ok" | "warn" | "bad" | "mute"; shape: "check" | "clock" | "alert" | "draft"; key: "approved" | "toApprove" | "rejected" | "offSite" | "saved" };

/** The word, colour and shape of an hours row: off site is flagged even when approved; rejected is red; the rest wait for the office. */
export function entryLook(e: Pick<CrewEntry, "status" | "geofenceFlagged">): EntryLook {
  if (e.status === "rejected") return { tone: "bad", shape: "alert", key: "rejected" };
  if (e.geofenceFlagged && e.status !== "approved") return { tone: "bad", shape: "alert", key: "offSite" };
  if (e.status === "approved") return { tone: "ok", shape: "check", key: "approved" };
  return { tone: "warn", shape: "clock", key: "toApprove" };
}

/** The hours a day by hand adds up to: finish minus start minus the break, never negative. Minutes since midnight in. */
export function handHours(startMin: number, endMin: number, breakMin: number): number {
  return Math.max(0, Math.round(((endMin - startMin - breakMin) / 60) * 100) / 100);
}

export const HAND_REASONS = ["forgot", "phoneDied", "noSignal", "other"] as const;
export type HandReason = (typeof HAND_REASONS)[number];

/** The note the office reads on an hours entry made by hand: the reason, the span and what the worker wrote. */
export function handNote(reason: string, startMin: number, endMin: number, breakMin: number, note: string): string {
  const t = (m: number) => `${Math.floor(m / 60)}:${pad(m % 60)}`;
  return [`${reason}`, `${t(startMin)}–${t(endMin)}${breakMin ? `, break ${breakMin} min` : ""}`, note.trim()].filter(Boolean).join(" · ").slice(0, 300);
}

/** The last seven days as YYYY-MM-DD, newest first, from `today`. */
export function lastDays(today: string, n = 7): string[] {
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(y!, m! - 1, d! - i, 12);
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  });
}

/** The pay period shown on the travel screen: the fortnight that holds `today`, counted from a Monday the server doesn't send, so the last 14 days. */
export function periodDays(today: string): string[] {
  return lastDays(today, 14);
}

export type TravelTotals = { km: number; days: number; waiting: number };

export function travelTotals(items: CrewAllowance[]): TravelTotals {
  return {
    km: items.filter((a) => a.kind === "mileage").reduce((n, a) => n + a.quantity, 0),
    days: items.filter((a) => a.kind === "per_diem").reduce((n, a) => n + a.quantity, 0),
    waiting: items.filter((a) => a.status !== "approved" && a.status !== "paid").length,
  };
}
