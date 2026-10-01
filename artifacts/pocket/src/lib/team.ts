// The Team screen's rules (Team.dc.html): the three figures, the hours bars, a worker's link state, the flags on a time entry and the seats. Pure, so they are tested (team.test.ts).
import type { Worker } from "./teamApi";

export type TimeRow = {
  id: string; workerId: string; workerName: string | null; projectId: string; projectName: string | null; date: string; hours: number; overtimeHours: number; holidayHours: number;
  note: string | null; status: "submitted" | "approved" | "rejected"; enteredBy: string; clockInAt: string | null; clockOutAt: string | null; geofenceFlagged: boolean; costCents: number;
};
export type EquipmentRow = { id: string; name: string; ownership: "owned" | "rented" | "financed" | string; usageRateCents: number; usageUnit: string; financing: string | null; notes: string | null; active: boolean; usageCentsThisMonth: number };
export type MemberRow = { id: string; userId: string | null; email: string | null; kind: "code" | "email"; codeHint: string | null; name: string | null; role: "owner" | "admin" | "office" | "foreman" | "viewer"; status: string; invitedAt: string; joinedAt: string | null };
export type Seats = { used: number; limit: number; included?: number; extra?: number };

export type LinkState = "active" | "sent" | "none";
/** A worker's crew link: used (they have clocked something), sent (issued, never used), or none. */
export function linkState(w: Pick<Worker, "hasInvite" | "lastTimeEntryAt">): LinkState {
  if (!w.hasInvite) return "none";
  return w.lastTimeEntryAt ? "active" : "sent";
}

export type TeamKpis = { crew: number; staff: number; subs: number; monthHours: number; pending: number; pendingHours: number };
export function teamKpis(workers: Worker[], pending: TimeRow[]): TeamKpis {
  const active = workers.filter((w) => w.active);
  const subs = active.filter((w) => w.workerType === "subcontractor").length;
  const round = (n: number) => Math.round(n * 10) / 10;
  return { crew: active.length, staff: active.length - subs, subs, monthHours: Math.round(active.reduce((s, w) => s + w.hoursThisMonth, 0)), pending: pending.length, pendingHours: round(pending.reduce((s, e) => s + e.hours, 0)) };
}

/** The bars: each person's month, scaled to the longest (at least 1 so nobody divides by zero). */
export function hourBars(workers: Worker[]): { id: string; name: string; hours: number; width: number }[] {
  const list = workers.filter((w) => w.active).sort((a, b) => b.hoursThisMonth - a.hoursThisMonth);
  const top = Math.max(1, ...list.map((w) => w.hoursThisMonth));
  return list.map((w) => ({ id: w.id, name: w.name.split(/\s+/)[0] ?? w.name, hours: Math.round(w.hoursThisMonth * 10) / 10, width: Math.round((w.hoursThisMonth / top) * 1000) / 10 }));
}

export type EntryFlag = "worker" | "overtime" | "offsite" | "weekend" | "byHand";
/** What the office should look at on an entry waiting for approval. */
export function entryFlags(e: TimeRow): EntryFlag[] {
  const out: EntryFlag[] = [];
  if (e.overtimeHours > 0) out.push("overtime");
  if (e.geofenceFlagged) out.push("offsite");
  const dow = new Date(`${e.date}T12:00:00`).getDay();
  if (dow === 0 || dow === 6) out.push("weekend");
  if (!out.length) out.push(e.enteredBy === "worker" || e.clockInAt ? "worker" : "byHand");
  return out;
}

export function seatsFull(s: Seats | null | undefined): boolean { return !!s && s.used >= s.limit; }
export function seatShare(s: Seats | null | undefined): number { return s && s.limit > 0 ? Math.min(100, Math.round((s.used / s.limit) * 100)) : 0; }
export function equipmentMonth(items: EquipmentRow[]): number { return items.filter((e) => e.active).reduce((s, e) => s + e.usageCentsThisMonth, 0); }
export const validEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** The real cost of an hour: the pay rate with the employer's burden on top (Teammate's "Real cost"). */
export function realHourlyCents(rateCents: number, burdenPercent: number): number { return Math.round(rateCents * (1 + burdenPercent / 100)); }

export type PeriodTotals = { hours: number; regular: number; overtime: number; toApprove: number; costCents: number; regularShare: number; overtimeShare: number };
/** A worker's hours over a period: regular, overtime and what still waits for approval (rejected entries don't count). */
export function periodTotals(entries: TimeRow[]): PeriodTotals {
  const live = entries.filter((e) => e.status !== "rejected");
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const hours = live.reduce((s, e) => s + e.hours, 0);
  const overtime = live.reduce((s, e) => s + Math.min(e.hours, e.overtimeHours), 0);
  const toApprove = live.filter((e) => e.status === "submitted").reduce((s, e) => s + e.hours, 0);
  const share = (n: number) => (hours > 0 ? Math.round((n / hours) * 100) : 0);
  return { hours: r1(hours), regular: r1(hours - overtime), overtime: r1(overtime), toApprove: r1(toApprove), costCents: live.reduce((s, e) => s + e.costCents, 0), regularShare: share(hours - overtime - toApprove > 0 ? hours - overtime - toApprove : 0), overtimeShare: share(overtime) };
}

/** Hours per job, most hours first. */
export function hoursByJob(entries: TimeRow[]): { projectId: string; name: string; hours: number }[] {
  const by = new Map<string, { projectId: string; name: string; hours: number }>();
  for (const e of entries) {
    if (e.status === "rejected") continue;
    const row = by.get(e.projectId) ?? { projectId: e.projectId, name: e.projectName ?? "", hours: 0 };
    row.hours += e.hours;
    by.set(e.projectId, row);
  }
  return [...by.values()].map((r) => ({ ...r, hours: Math.round(r.hours * 10) / 10 })).sort((a, b) => b.hours - a.hours);
}
