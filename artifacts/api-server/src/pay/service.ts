import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm";
import {
  db,
  businessProfilesTable,
  collaboratorsTable,
  costEntriesTable,
  payAllowancesTable,
  payExportsTable,
  projectsTable,
  timeEntriesTable,
  labourCostCents,
  type Collaborator,
  type EarningKind,
  type PayAllowance,
  type PayExportFormat,
  type PayExportSnapshot,
  type PaySettings,
  type TimeEntry,
} from "@workspace/db";
import { parseIsoDate, timeZoneForProvince, toIsoDate } from "../jobs/dates.js";
import { todayFor } from "../compliance/service.js";
import { syncLabourCost } from "../costs/service.js";
import { checkJobBudget } from "../jobs/budgetAlerts.js";
import {
  addDays,
  daysBetween,
  effectivePaySettings,
  holidayBaseCents,
  holidayLookbackDays,
  holidayPay,
  holidayPercentOf,
  holidaysBetween,
  holidaysCountForSplit,
  hoursAfterMidnight,
  overtimeWindow,
  periodContaining,
  previousPeriod,
  round2,
  splitWindow,
  type EffectivePaySettings,
  type Holiday,
  type Period,
} from "./rules.js";

// ── Phase 89: time to pay ────────────────────────────────────────────────────
// Keeps each approved entry's overtime/holiday split current (so the job it was
// worked on carries the premium), builds a pay period's worksheet, and turns it
// into the file a payroll provider imports. It never computes deductions.

const dayDate = (iso: string) => parseIsoDate(iso)!;

export async function paySettingsFor(userId: string): Promise<{ raw: PaySettings; effective: EffectivePaySettings; province: string | null }> {
  const [profile] = await db.select({ province: businessProfilesTable.province, paySettings: businessProfilesTable.paySettings }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  const raw = profile?.paySettings ?? {};
  return { raw, effective: effectivePaySettings(profile?.province, raw), province: profile?.province ?? null };
}

// ── Keeping the split current ────────────────────────────────────────────────

const workOrder = (e: TimeEntry) => (e.clockInAt ?? e.createdAt).getTime();

/**
 * Recomputes the overtime/holiday split for every overtime window (week, or
 * averaging block) that touches `days`, for one worker, and rewrites the labour
 * cost of each entry whose split moved. Entries that are not approved carry no
 * split. Subcontractors are paid what they invoice — no overtime, no holiday.
 */
export async function recomputeWorkerDays(userId: string, workerId: string, days: string[], ctx?: { settings: EffectivePaySettings; raw: PaySettings }): Promise<number> {
  const uniq = [...new Set(days.filter(Boolean))];
  if (!uniq.length) return 0;
  const [worker] = await db.select().from(collaboratorsTable).where(and(eq(collaboratorsTable.id, workerId), eq(collaboratorsTable.userId, userId)));
  if (!worker) return 0;
  const { effective, raw } = ctx ? { effective: ctx.settings, raw: ctx.raw } : await paySettingsFor(userId);
  const tz = timeZoneForProvince(effective.province);
  const tailOf = (r: TimeEntry) => hoursAfterMidnight(toIsoDate(r.date)!, Number(r.hours), r.clockInAt, r.clockOutAt, tz);
  const windows = new Map<string, Period>();
  for (const d of uniq) {
    // A shift on the window's last day can run past midnight into the next
    // window's first day, whose threshold then starts from that tail.
    for (const day of [d, addDays(d, 1)]) {
      const w = overtimeWindow(day, effective);
      windows.set(w.start, w);
    }
  }
  let changed = 0;
  for (const w of windows.values()) {
    const rows = await db
      .select()
      .from(timeEntriesTable)
      .where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.workerId, workerId), gte(timeEntriesTable.date, dayDate(addDays(w.start, -1))), lte(timeEntriesTable.date, dayDate(w.end))));
    const inWindow = rows.filter((r) => toIsoDate(r.date)! >= w.start);
    const approved = inWindow.filter((r) => r.status === "approved").sort((a, b) => a.date.getTime() - b.date.getTime() || workOrder(a) - workOrder(b));
    const holidays = holidaysCountForSplit(effective) ? new Set(holidaysBetween(effective.province, w.start, addDays(w.end, 1), raw).map((h) => h.date)) : new Set<string>();
    const prior = new Map<string, number>();
    for (const r of rows) if (r.status === "approved" && toIsoDate(r.date)! < w.start) prior.set(w.start, (prior.get(w.start) ?? 0) + tailOf(r));
    const split =
      worker.workerType === "employee"
        ? splitWindow(
            approved.map((r) => ({ id: r.id, day: toIsoDate(r.date)!, hours: Number(r.hours), rateCents: r.rateCentsSnapshot, nextDayHours: tailOf(r) })),
            effective.overtime,
            holidays,
            effective.holidays.workedMultiplier,
            effective.averaging?.weeks ?? 1,
            prior,
          )
        : new Map();
    for (const r of inWindow) {
      const s = split.get(r.id) ?? { overtimeHours: 0, doubleHours: 0, holidayHours: 0, premiumCents: 0 };
      if (Number(r.overtimeHours) === s.overtimeHours && Number(r.doubleHours) === s.doubleHours && Number(r.holidayHours) === s.holidayHours && r.premiumCents === s.premiumCents) continue;
      const [updated] = await db
        .update(timeEntriesTable)
        .set({ overtimeHours: s.overtimeHours.toFixed(2), doubleHours: s.doubleHours.toFixed(2), holidayHours: s.holidayHours.toFixed(2), premiumCents: s.premiumCents })
        .where(eq(timeEntriesTable.id, r.id))
        .returning();
      if (updated!.status === "approved") await syncLabourCost(updated!, worker);
      changed++;
    }
  }
  return changed;
}

/** After the rules change: every worker's approved hours from `sinceDay` on. Older weeks were paid under the old rules and stay as they were. */
export async function recomputeSince(userId: string, sinceDay: string): Promise<number> {
  const { effective, raw } = await paySettingsFor(userId);
  const rows = await db
    .select({ workerId: timeEntriesTable.workerId, date: timeEntriesTable.date })
    .from(timeEntriesTable)
    .where(and(eq(timeEntriesTable.userId, userId), gte(timeEntriesTable.date, dayDate(sinceDay)), or(eq(timeEntriesTable.status, "approved"), ne(timeEntriesTable.premiumCents, 0))));
  const byWorker = new Map<string, string[]>();
  for (const r of rows) byWorker.set(r.workerId, [...(byWorker.get(r.workerId) ?? []), toIsoDate(r.date)!]);
  let n = 0;
  for (const [workerId, days] of byWorker) n += await recomputeWorkerDays(userId, workerId, days, { settings: effective, raw });
  return n;
}

// ── Allowances ───────────────────────────────────────────────────────────────

/** A travel or per-diem line on a job becomes a confirmed labour cost on that job (and leaves with it). */
export async function syncAllowanceCost(a: PayAllowance, workerName: string): Promise<void> {
  if (!a.projectId) {
    if (a.costEntryId) {
      await db.delete(costEntriesTable).where(eq(costEntriesTable.id, a.costEntryId));
      await db.update(payAllowancesTable).set({ costEntryId: null }).where(eq(payAllowancesTable.id, a.id));
    }
    return;
  }
  const label = a.kind === "mileage" ? `${Number(a.quantity)} km` : a.kind === "per_diem" ? `${Number(a.quantity)} × per diem` : a.note || "allowance";
  const values = {
    userId: a.userId,
    projectId: a.projectId,
    category: "labour" as const,
    vendor: workerName,
    description: `${workerName} — ${label}`,
    date: dayDate(a.date),
    subtotalCents: a.amountCents,
    taxCents: 0,
    taxBreakdown: {},
    totalCents: a.amountCents,
    status: "confirmed" as const,
    source: "allowance" as const,
    createdBy: "system" as const,
    confirmedAt: new Date(),
  };
  if (a.costEntryId) {
    const [existing] = await db.update(costEntriesTable).set(values).where(eq(costEntriesTable.id, a.costEntryId)).returning({ id: costEntriesTable.id });
    if (existing) return;
  }
  const [created] = await db.insert(costEntriesTable).values(values).returning({ id: costEntriesTable.id });
  await db.update(payAllowancesTable).set({ costEntryId: created!.id }).where(eq(payAllowancesTable.id, a.id));
  void checkJobBudget(a.projectId);
}

/** Phase 89b: a line the crew sent is paid and costed once the office approves it; rejected, it stays for the crew to see why. */
export async function reviewAllowance(a: PayAllowance, decision: "approved" | "rejected", reviewerName: string | null, reason: string | null): Promise<PayAllowance> {
  const [updated] = await db
    .update(payAllowancesTable)
    .set({ status: decision, reviewedAt: new Date(), reviewedByName: reviewerName, rejectedReason: decision === "rejected" ? reason || null : null })
    .where(eq(payAllowancesTable.id, a.id))
    .returning();
  const [worker] = await db.select({ name: collaboratorsTable.name }).from(collaboratorsTable).where(eq(collaboratorsTable.id, a.workerId));
  if (decision === "approved") await syncAllowanceCost(updated!, worker?.name ?? "");
  else await syncAllowanceCost({ ...updated!, projectId: null }, worker?.name ?? "");
  return updated!;
}

export async function deleteAllowance(a: PayAllowance): Promise<void> {
  await db.transaction(async (tx) => {
    if (a.costEntryId) await tx.delete(costEntriesTable).where(eq(costEntriesTable.id, a.costEntryId));
    await tx.delete(payAllowancesTable).where(eq(payAllowancesTable.id, a.id));
  });
}

// ── The worksheet ────────────────────────────────────────────────────────────

type EarningLine = { kind: EarningKind; code: string; hours: number | null; quantity: number | null; rateCents: number; amountCents: number; taxable: boolean; note?: string };

type WorkerPay = {
  workerId: string;
  name: string;
  payrollId: string | null;
  hours: number;
  lines: EarningLine[];
  grossCents: number;
  holidays: { date: string; key: string | null; name: string | null; cents: number | null; hours: number | null; reason: string | null }[];
  allowances: { id: string; date: string; kind: string; quantity: number; rateCents: number; amountCents: number; taxable: boolean; note: string; projectId: string | null; projectName: string | null }[];
  jobs: string[];
};

export type PayPeriodReport = {
  period: Period;
  today: string;
  isCurrent: boolean;
  holidays: Holiday[];
  employees: WorkerPay[];
  subcontractors: { workerId: string; name: string; hours: number; amountCents: number }[];
  jobs: { projectId: string | null; name: string | null; hours: number; overtimeHours: number; straightCents: number; premiumCents: number; burdenCents: number; allowanceCents: number; totalCents: number }[];
  totals: { hours: number; overtimeHours: number; grossCents: number; holidayCents: number; allowanceCents: number; premiumCents: number };
  pending: { count: number; hours: number };
  /** Phase 89b: travel and per diem the crew sent that the office has not looked at yet. */
  pendingAllowances: { id: string; workerId: string; workerName: string; date: string; kind: string; quantity: number; rateCents: number; amountCents: number; note: string; projectId: string | null; projectName: string | null }[];
  warnings: { missingPayrollId: string[]; zeroRate: string[] };
  exports: { id: string; format: PayExportFormat; exportedAt: string; exportedByName: string | null }[];
  changedSinceExport: string[];
  settings: EffectivePaySettings;
};

/** The period to show when none is asked for: the one that ended most recently — the one being paid. */
export function defaultPeriod(today: string, s: EffectivePaySettings): Period {
  return previousPeriod(periodContaining(today, s), s);
}

export async function payPeriodReport(userId: string, day: string): Promise<PayPeriodReport> {
  const { effective, raw, province } = await paySettingsFor(userId);
  const period = periodContaining(day, effective);
  const today = todayFor(province);
  const from = dayDate(period.start);
  const to = dayDate(period.end);

  const inPeriod = await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.userId, userId), gte(timeEntriesTable.date, from), lte(timeEntriesTable.date, to)));
  const approved = inPeriod.filter((e) => e.status === "approved");
  const workers = await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.userId, userId));
  const byId = new Map(workers.map((w) => [w.id, w]));

  // An open period (the previous one on — the same reach as a rules change) is
  // re-split so it matches today's rules; an older one shows what it was paid
  // under, and opening it never rewrites the cost of an old job.
  let refreshed = 0;
  if (period.end >= recomputeHorizon(today, effective)) {
    const touched = new Map<string, string[]>();
    for (const e of inPeriod) touched.set(e.workerId, [...(touched.get(e.workerId) ?? []), toIsoDate(e.date)!]);
    for (const [wid, days] of touched) refreshed += await recomputeWorkerDays(userId, wid, days, { settings: effective, raw });
  }
  const entries = refreshed
    ? await db.select().from(timeEntriesTable).where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.status, "approved"), gte(timeEntriesTable.date, from), lte(timeEntriesTable.date, to)))
    : approved;

  const allAllowances = await db.select().from(payAllowancesTable).where(and(eq(payAllowancesTable.userId, userId), gte(payAllowancesTable.date, period.start), lte(payAllowancesTable.date, period.end))).orderBy(asc(payAllowancesTable.date));
  const allowances = allAllowances.filter((a) => a.status === "approved");
  const submittedAllowances = allAllowances.filter((a) => a.status === "submitted");
  const projectIds = [...new Set([...entries.map((e) => e.projectId), ...allAllowances.map((a) => a.projectId).filter((x): x is string => !!x)])];
  const projects = projectIds.length ? await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(inArray(projectsTable.id, projectIds)) : [];
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const holidays = holidaysBetween(effective.province, period.start, period.end, raw);
  const codes = effective.earningCodes;
  const ot = effective.overtime;
  const employees = new Map<string, WorkerPay>();
  const subs = new Map<string, { workerId: string; name: string; hours: number; amountCents: number }>();
  const emp = (w: Collaborator) => {
    let p = employees.get(w.id);
    if (!p) {
      p = { workerId: w.id, name: w.name, payrollId: w.payrollId, hours: 0, lines: [], grossCents: 0, holidays: [], allowances: [], jobs: [] };
      employees.set(w.id, p);
    }
    return p;
  };
  const addLine = (p: WorkerPay, line: EarningLine) => {
    if (line.amountCents === 0 && !line.hours && !line.quantity) return;
    const same = p.lines.find((l) => l.kind === line.kind && l.rateCents === line.rateCents && l.taxable === line.taxable);
    if (same) {
      same.hours = same.hours == null ? null : round2(same.hours + (line.hours ?? 0));
      same.quantity = same.quantity == null ? null : round2(same.quantity + (line.quantity ?? 0));
      same.amountCents += line.amountCents;
    } else p.lines.push(line);
  };

  const jobs = new Map<string, PayPeriodReport["jobs"][number]>();
  const job = (id: string | null) => {
    const key = id ?? "";
    let j = jobs.get(key);
    if (!j) {
      j = { projectId: id, name: id ? (projectName.get(id) ?? null) : null, hours: 0, overtimeHours: 0, straightCents: 0, premiumCents: 0, burdenCents: 0, allowanceCents: 0, totalCents: 0 };
      jobs.set(key, j);
    }
    return j;
  };

  const hr = effective.holidays;
  const overtimeWages = (hoursOt: number, hoursDbl: number, rate: number) => hoursOt * rate * ot.multiplier + hoursDbl * rate * ot.doubleMultiplier;
  // ON construction's 7.7 %: the base builds up over the period's own hours.
  const pctBase = new Map<string, number>();
  for (const e of entries) {
    const w = byId.get(e.workerId);
    if (!w) continue;
    const hours = Number(e.hours), otH = Number(e.overtimeHours), dblH = Number(e.doubleHours), holH = Number(e.holidayHours);
    if (hr.method === "pct_of_wages" && w.workerType === "employee") {
      pctBase.set(w.id, (pctBase.get(w.id) ?? 0) + holidayBaseCents(hr, effective.vacationPayPercent, { straightCents: (hours - otH - dblH) * e.rateCentsSnapshot, overtimeCents: overtimeWages(otH, dblH, e.rateCentsSnapshot) }));
    }
    const rate = e.rateCentsSnapshot;
    const straightCents = Math.round(hours * rate);
    const total = labourCostCents(hours, rate, Number(e.burdenPercentSnapshot), e.premiumCents);
    const j = job(e.projectId);
    j.hours = round2(j.hours + hours);
    j.overtimeHours = round2(j.overtimeHours + otH + dblH);
    j.straightCents += straightCents;
    j.premiumCents += e.premiumCents;
    j.burdenCents += total - straightCents - e.premiumCents;
    j.totalCents += total;
    if (w.workerType !== "employee") {
      const s = subs.get(w.id) ?? { workerId: w.id, name: w.name, hours: 0, amountCents: 0 };
      s.hours = round2(s.hours + hours);
      s.amountCents += straightCents;
      subs.set(w.id, s);
      continue;
    }
    const p = emp(w);
    p.hours = round2(p.hours + hours);
    const name = projectName.get(e.projectId);
    if (name && !p.jobs.includes(name)) p.jobs.push(name);
    const regular = round2(hours - otH - dblH - holH);
    addLine(p, { kind: "regular", code: codes.regular, hours: regular, quantity: null, rateCents: rate, amountCents: Math.round(regular * rate), taxable: true });
    if (otH) addLine(p, { kind: "overtime", code: codes.overtime, hours: otH, quantity: null, rateCents: Math.round(rate * ot.multiplier), amountCents: Math.round(otH * rate * ot.multiplier), taxable: true });
    if (dblH) addLine(p, { kind: "double", code: codes.double, hours: dblH, quantity: null, rateCents: Math.round(rate * ot.doubleMultiplier), amountCents: Math.round(dblH * rate * ot.doubleMultiplier), taxable: true });
    if (holH) addLine(p, { kind: "holiday_worked", code: codes.holiday_worked, hours: holH, quantity: null, rateCents: Math.round(rate * effective.holidays.workedMultiplier), amountCents: Math.round(holH * rate * effective.holidays.workedMultiplier), taxable: true });
  }

  for (const [wid, base] of pctBase) {
    const cents = holidayPercentOf(hr, base);
    if (cents) addLine(emp(byId.get(wid)!), { kind: "holiday", code: codes.holiday, hours: null, quantity: null, rateCents: 0, amountCents: cents, taxable: true, note: `${hr.percent}%` });
  }

  // Statutory holiday pay: every employee who worked in the lookback before each holiday, with the reason when they don't qualify.
  if (holidays.length && hr.method !== "pct_of_wages") {
    const lookback = holidayLookbackDays(effective.holidays.method);
    const earliest = addDays(holidays[0]!.date, -lookback);
    const before = await db
      .select()
      .from(timeEntriesTable)
      .where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.status, "approved"), gte(timeEntriesTable.date, dayDate(earliest)), lte(timeEntriesTable.date, dayDate(holidays[holidays.length - 1]!.date))));
    const firsts = await db
      .select({ workerId: timeEntriesTable.workerId, first: sql<string>`min(${timeEntriesTable.date})` })
      .from(timeEntriesTable)
      .where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.status, "approved")))
      .groupBy(timeEntriesTable.workerId);
    const firstDay = new Map(firsts.map((f) => [f.workerId, toIsoDate(new Date(f.first))!]));
    for (const h of holidays) {
      const start = addDays(h.date, -lookback);
      const window = before.filter((e) => {
        const d = toIsoDate(e.date)!;
        return d >= start && d < h.date;
      });
      const perWorker = new Map<string, { cents: number; hours: number; days: Set<string> }>();
      for (const e of window) {
        const w = byId.get(e.workerId);
        if (!w || w.workerType !== "employee") continue;
        const otH = Number(e.overtimeHours), dblH = Number(e.doubleHours);
        const straightHours = Number(e.hours) - otH - dblH;
        const agg = perWorker.get(w.id) ?? { cents: 0, hours: 0, days: new Set<string>() };
        agg.cents += Math.round(holidayBaseCents(hr, effective.vacationPayPercent, { straightCents: straightHours * e.rateCentsSnapshot, overtimeCents: overtimeWages(otH, dblH, e.rateCentsSnapshot) }));
        agg.hours += straightHours;
        agg.days.add(toIsoDate(e.date)!);
        perWorker.set(w.id, agg);
      }
      for (const [wid, agg] of perWorker) {
        const w = byId.get(wid)!;
        const first = firstDay.get(wid);
        const r = holidayPay(hr, { wagesCents: agg.cents, straightHours: agg.hours, daysWorked: agg.days.size, firstWorkedDaysAgo: first ? daysBetween(first, h.date) : null });
        const p = emp(w);
        if (r.cents == null) {
          p.holidays.push({ date: h.date, key: h.key, name: h.name, cents: null, hours: null, reason: r.reason });
          continue;
        }
        p.holidays.push({ date: h.date, key: h.key, name: h.name, cents: r.cents, hours: r.hours, reason: null });
        addLine(p, { kind: "holiday", code: codes.holiday, hours: r.hours, quantity: null, rateCents: r.hours ? Math.round(r.cents / r.hours) : 0, amountCents: r.cents, taxable: true, note: h.date });
      }
    }
  }

  for (const a of allowances) {
    const w = byId.get(a.workerId);
    if (!w) continue;
    const p = emp(w);
    const qty = Number(a.quantity);
    p.allowances.push({ id: a.id, date: a.date, kind: a.kind, quantity: qty, rateCents: a.rateCents, amountCents: a.amountCents, taxable: a.taxable, note: a.note, projectId: a.projectId, projectName: a.projectId ? (projectName.get(a.projectId) ?? null) : null });
    addLine(p, { kind: a.kind, code: codes[a.kind], hours: null, quantity: qty, rateCents: a.rateCents, amountCents: a.amountCents, taxable: a.taxable });
    const j = job(a.projectId);
    j.allowanceCents += a.amountCents;
    j.totalCents += a.amountCents;
  }

  const list = [...employees.values()].map((p) => ({ ...p, grossCents: p.lines.reduce((n, l) => n + l.amountCents, 0) })).sort((a, b) => a.name.localeCompare(b.name));
  const pendingRows = inPeriod.filter((e) => e.status === "submitted");

  const exports = await db.select().from(payExportsTable).where(and(eq(payExportsTable.userId, userId), eq(payExportsTable.periodStart, period.start))).orderBy(desc(payExportsTable.exportedAt));
  const snapshot = snapshotOf(list);
  const changedSinceExport = exports[0] ? changedWorkers(exports[0].snapshot, snapshot) : [];

  const holidayCents = list.reduce((n, p) => n + p.lines.filter((l) => l.kind === "holiday").reduce((m, l) => m + l.amountCents, 0), 0);
  return {
    period,
    today,
    isCurrent: today >= period.start && today <= period.end,
    holidays,
    employees: list,
    subcontractors: [...subs.values()].sort((a, b) => a.name.localeCompare(b.name)),
    jobs: [...jobs.values()].sort((a, b) => b.totalCents - a.totalCents),
    totals: {
      hours: round2(list.reduce((n, p) => n + p.hours, 0)),
      overtimeHours: round2(entries.filter((e) => byId.get(e.workerId)?.workerType === "employee").reduce((n, e) => n + Number(e.overtimeHours) + Number(e.doubleHours), 0)),
      grossCents: list.reduce((n, p) => n + p.grossCents, 0),
      holidayCents,
      allowanceCents: allowances.reduce((n, a) => n + a.amountCents, 0),
      premiumCents: entries.reduce((n, e) => n + e.premiumCents, 0),
    },
    pending: { count: pendingRows.length, hours: round2(pendingRows.reduce((n, e) => n + Number(e.hours), 0)) },
    pendingAllowances: submittedAllowances.map((a) => ({
      id: a.id,
      workerId: a.workerId,
      workerName: byId.get(a.workerId)?.name ?? "",
      date: a.date,
      kind: a.kind,
      quantity: Number(a.quantity),
      rateCents: a.rateCents,
      amountCents: a.amountCents,
      note: a.note,
      projectId: a.projectId,
      projectName: a.projectId ? (projectName.get(a.projectId) ?? null) : null,
    })),
    warnings: {
      missingPayrollId: list.filter((p) => !p.payrollId).map((p) => p.name),
      zeroRate: list.filter((p) => p.lines.some((l) => l.kind === "regular" && l.rateCents === 0)).map((p) => p.name),
    },
    exports: exports.map((x) => ({ id: x.id, format: x.format, exportedAt: x.exportedAt.toISOString(), exportedByName: x.exportedByName })),
    changedSinceExport,
    settings: effective,
  };
}

function snapshotOf(list: WorkerPay[]): PayExportSnapshot {
  return Object.fromEntries(list.map((p) => [p.workerId, { name: p.name, grossCents: p.grossCents, hours: p.hours }]));
}

/** Names of the workers whose pay differs from what was exported (added, removed or changed). */
function changedWorkers(then: PayExportSnapshot, now: PayExportSnapshot): string[] {
  const out: string[] = [];
  for (const [id, n] of Object.entries(now)) {
    const t = then[id];
    if (!t || t.grossCents !== n.grossCents || t.hours !== n.hours) out.push(n.name);
  }
  for (const [id, t] of Object.entries(then)) if (!now[id]) out.push(t.name);
  return out;
}

// ── Export files ─────────────────────────────────────────────────────────────

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cells: (string | number)[]) => cells.map(csvCell).join(",");
const money = (c: number) => (c / 100).toFixed(2);
const num = (n: number | null) => (n == null ? "" : n.toFixed(2));

/**
 * The file for one pay period. Provider layouts follow each one's own
 * vocabulary (employee number + earning code + hours/rate/amount); the codes
 * are the company's (Settings), because each payroll account names its own.
 * QuickBooks Payroll takes timesheets, not earnings, so that one is per day
 * and per job, hours only — holiday pay and allowances are added in the pay run.
 */
export async function buildExport(userId: string, report: PayPeriodReport, format: PayExportFormat): Promise<{ filename: string; body: string }> {
  const { period, employees } = report;
  const lines: string[] = [];
  if (format === "qbo_payroll") {
    const ids = employees.map((p) => p.workerId);
    const entries = ids.length
      ? await db
          .select()
          .from(timeEntriesTable)
          .where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.status, "approved"), inArray(timeEntriesTable.workerId, ids), gte(timeEntriesTable.date, dayDate(period.start)), lte(timeEntriesTable.date, dayDate(period.end))))
          .orderBy(asc(timeEntriesTable.date))
      : [];
    const names = new Map(employees.map((p) => [p.workerId, p.name]));
    const pids = [...new Set(entries.map((e) => e.projectId))];
    const projects = pids.length ? await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(inArray(projectsTable.id, pids)) : [];
    const pname = new Map(projects.map((p) => [p.id, p.name]));
    const c = report.settings.earningCodes;
    lines.push(row(["Date", "Employee", "Customer", "Pay item", "Hours", "Description"]));
    for (const e of entries) {
      const otH = Number(e.overtimeHours), dblH = Number(e.doubleHours), holH = Number(e.holidayHours);
      const parts: [string, number][] = [[c.regular, round2(Number(e.hours) - otH - dblH - holH)], [c.overtime, otH], [c.double, dblH], [c.holiday_worked, holH]];
      for (const [code, h] of parts) if (h > 0) lines.push(row([toIsoDate(e.date)!, names.get(e.workerId) ?? "", pname.get(e.projectId) ?? "", code, h.toFixed(2), e.note]));
    }
  } else if (format === "wagepoint") {
    lines.push(row(["Employee ID", "Employee Name", "Income Code", "Hours", "Rate", "Amount"]));
    for (const p of employees) for (const l of p.lines) lines.push(row([p.payrollId ?? "", p.name, l.code, num(l.hours ?? l.quantity), money(l.rateCents), money(l.amountCents)]));
  } else if (format === "payworks") {
    lines.push(row(["Employee Number", "Earning Code", "Hours", "Rate", "Amount"]));
    for (const p of employees) for (const l of p.lines) lines.push(row([p.payrollId ?? "", l.code, num(l.hours ?? l.quantity), money(l.rateCents), money(l.amountCents)]));
  } else {
    lines.push(row(["Employee ID", "Employee", "Period start", "Period end", "Earning", "Code", "Hours", "Quantity", "Rate", "Amount", "Taxable", "Jobs"]));
    for (const p of employees) {
      for (const l of p.lines) lines.push(row([p.payrollId ?? "", p.name, period.start, period.end, l.kind, l.code, num(l.hours), num(l.quantity), money(l.rateCents), money(l.amountCents), l.taxable ? "yes" : "no", p.jobs.join("; ")]));
    }
  }
  // Excel wants a BOM to read accents; importers tend to choke on one, so only the generic file carries it.
  const body = `${format === "generic" ? "﻿" : ""}${lines.join("\r\n")}\r\n`;
  return { filename: `pay-${format}-${period.start}-${period.end}.csv`, body };
}

export async function recordExport(userId: string, report: PayPeriodReport, format: PayExportFormat, exportedByName: string | null): Promise<void> {
  await db.insert(payExportsTable).values({ userId, periodStart: report.period.start, periodEnd: report.period.end, format, exportedByName, snapshot: snapshotOf(report.employees) });
}

/** Days from `today` back to where a settings change still reaches: the start of the pay period before the current one. */
export function recomputeHorizon(today: string, s: EffectivePaySettings): string {
  const p = previousPeriod(periodContaining(today, s), s);
  return overtimeWindow(p.start, s).start;
}
