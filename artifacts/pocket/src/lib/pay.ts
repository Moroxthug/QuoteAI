// The Pay screen's rules (Pay.dc.html): the period's status, what needs a look before export, the totals, an employee's lines, labour by job, the
// overtime rows and the settings changes the rules tab saves. Pure, so they are tested (pay.test.ts). The server's shapes (routes/pay.ts,
// pay/service.ts, pay/rules.ts) are typed here. The worksheet is time to pay, not a payroll engine: no deductions, and no vacation-pay line.

export const PAY_FREQUENCIES = ["weekly", "biweekly", "semimonthly", "monthly"] as const;
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];
export const PAY_FORMATS = ["generic", "wagepoint", "payworks", "qbo_payroll"] as const;
export type PayFormat = (typeof PAY_FORMATS)[number];
export const EARNING_KINDS = ["regular", "overtime", "double", "holiday", "holiday_worked", "mileage", "per_diem", "other"] as const;
export type EarningKind = (typeof EARNING_KINDS)[number];

export type Overtime = { dailyHours: number | null; dailyDoubleHours: number | null; weeklyHours: number | null; multiplier: number; doubleMultiplier: number };
export type HolidayRules = { method: string; workedMultiplier: number; minDaysWorked: number; minEmployedDays: number; percent: number; includeOvertime: boolean; includeVacationPay: boolean; substituteWeekend: boolean };
export type Holiday = { date: string; key: string | null; name: string | null; custom: boolean; observedFrom: string | null };
export type Effective = {
  province: string; frequency: PayFrequency; anchorDate: string; weekStartsOn: number; overtime: Overtime; overtimeIsDefault: boolean; averaging: { weeks: number; startDate: string } | null;
  holidays: HolidayRules; allowances: { kmRateCents: number; perDiemCents: number }; exportFormat: PayFormat; earningCodes: Record<EarningKind, string>; vacationPayPercent: number | null; preset: string | null;
};
/** The company's own settings as saved (PUT replaces them whole, so a change sends all of this back). */
export type RawSettings = {
  frequency?: PayFrequency; anchorDate?: string; weekStartsOn?: number; overtime?: Overtime | null; averaging?: { weeks: number; startDate: string } | null; holidays?: Partial<HolidayRules> & { added?: { date: string; name: string }[]; removed?: string[] };
  allowances?: { kmRateCents?: number; perDiemCents?: number }; exportFormat?: PayFormat; earningCodes?: Partial<Record<EarningKind, string>>; vacationPayPercent?: number | null; preset?: string | null;
};
export type Preset = { key: string; overtime: Overtime; holidays: Partial<HolidayRules> };
export type PaySettingsPayload =
  | { enabled: false; requiredPlan?: string }
  | { enabled: true; settings: RawSettings; effective: Effective; provinceDefaults: { overtime: Overtime; holidays: HolidayRules; earningCodes: Record<EarningKind, string> }; presets: Preset[]; holidays: Holiday[]; provinceHolidays: Holiday[]; today: string };

export type EarningLine = { kind: EarningKind; code: string; hours: number | null; quantity: number | null; rateCents: number; amountCents: number; taxable: boolean; note?: string };
export type Allowance = { id: string; date: string; kind: string; quantity: number; rateCents: number; amountCents: number; taxable: boolean; note: string; projectId: string | null; projectName: string | null };
export type WorkerPay = { workerId: string; name: string; payrollId: string | null; hours: number; lines: EarningLine[]; grossCents: number; allowances: Allowance[]; jobs: string[] };
export type PendingAllowance = { id: string; workerId: string; workerName: string; date: string; kind: string; quantity: number; rateCents: number; amountCents: number; note: string; projectId: string | null; projectName: string | null };
export type JobPay = { projectId: string | null; name: string | null; hours: number; overtimeHours: number; straightCents: number; premiumCents: number; burdenCents: number; allowanceCents: number; totalCents: number };
export type PayReport = {
  period: { start: string; end: string }; today: string; isCurrent: boolean; holidays: Holiday[]; employees: WorkerPay[];
  subcontractors: { workerId: string; name: string; hours: number; amountCents: number }[]; jobs: JobPay[];
  totals: { hours: number; overtimeHours: number; grossCents: number; holidayCents: number; allowanceCents: number; premiumCents: number };
  pending: { count: number; hours: number }; pendingAllowances: PendingAllowance[]; warnings: { missingPayrollId: string[]; zeroRate: string[] };
  exports: { id: string; format: PayFormat; exportedAt: string; exportedByName: string | null }[]; changedSinceExport: string[]; settings: Effective; previousStart: string; nextStart: string;
};

// ── Days ────────────────────────────────────────────────────────────────────

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** A calendar day at noon on the phone's clock, for Intl. */
export function dayAt(day: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
}
/** 0 = Sunday. */
export const weekdayOf = (day: string): number => dayAt(day).getDay();

/** The last day of the period that starts on `start`. */
export function periodEndFor(start: string, frequency: PayFrequency): string {
  const [y, m, d] = start.split("-").map(Number) as [number, number, number];
  if (frequency === "weekly") return addDays(start, 6);
  if (frequency === "biweekly") return addDays(start, 13);
  const lastOfMonth = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  if (frequency === "semimonthly" && d <= 15) return `${start.slice(0, 8)}15`;
  return lastOfMonth;
}

// ── The period ──────────────────────────────────────────────────────────────

export type PeriodStatus = { kind: "exported"; at: string } | { kind: "ready" } | { kind: "progress" };
/** Exported (and when), ready to export (the period is over) or still in progress. */
export function periodStatus(r: Pick<PayReport, "exports" | "isCurrent" | "period" | "today">): PeriodStatus {
  if (r.exports.length > 0) return { kind: "exported", at: r.exports[0]!.exportedAt };
  if (r.isCurrent || r.period.end >= r.today) return { kind: "progress" };
  return { kind: "ready" };
}
/** You can step forward only to a period that has started. */
export const canGoNext = (r: Pick<PayReport, "nextStart" | "today">): boolean => r.nextStart <= r.today;

export type PayTotals = { gross: number; hours: number; overtime: number; holiday: number; travel: number; claimsWaiting: number; employees: number };
export function totalsOf(r: PayReport): PayTotals {
  return { gross: r.totals.grossCents, hours: r.totals.hours, overtime: r.totals.overtimeHours, holiday: r.totals.holidayCents, travel: r.totals.allowanceCents, claimsWaiting: r.pendingAllowances.length, employees: r.employees.length };
}

// ── What needs a look ───────────────────────────────────────────────────────

export type WarningKey = "approve" | "changed" | "payroll" | "rate" | "holiday";
export type Warning = { key: WarningKey; tone: "warn" | "bad" | "info"; count: number; names: string[]; hours?: number; holiday?: Holiday };

/** The first holiday coming up after this period, within four weeks (the board's "Thanksgiving is Mon Oct 12 · Next"). */
export function nextHoliday(holidays: Holiday[], r: Pick<PayReport, "nextStart">): Holiday | null {
  const end = addDays(r.nextStart, 27);
  return holidays.find((h) => h.date >= r.nextStart && h.date <= end) ?? null;
}

/** Rows of the card under the period, in the board's order; empty when nothing needs a look. */
export function warnings(r: PayReport, ctx: { pendingNames: string[]; holiday: Holiday | null }): Warning[] {
  const out: Warning[] = [];
  if (r.pending.count > 0) out.push({ key: "approve", tone: "warn", count: r.pending.count, names: ctx.pendingNames, hours: r.pending.hours });
  if (r.changedSinceExport.length > 0) out.push({ key: "changed", tone: "warn", count: r.changedSinceExport.length, names: r.changedSinceExport });
  if (r.warnings.missingPayrollId.length > 0) out.push({ key: "payroll", tone: "bad", count: r.warnings.missingPayrollId.length, names: r.warnings.missingPayrollId });
  if (r.warnings.zeroRate.length > 0) out.push({ key: "rate", tone: "bad", count: r.warnings.zeroRate.length, names: r.warnings.zeroRate });
  if (ctx.holiday) out.push({ key: "holiday", tone: "info", count: 1, names: [], holiday: ctx.holiday });
  return out;
}

/** Names for a sentence: first names, "Luca, Amara and Dev". */
export function firstNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) { const f = n.trim().split(/\s+/)[0] ?? ""; if (f && !seen.has(f)) { seen.add(f); out.push(f); } }
  return out;
}

// ── An employee ─────────────────────────────────────────────────────────────

export type LineQty = { kind: "hours"; value: number; rateCents: number } | { kind: "km" | "days"; value: number; rateCents: number } | { kind: "amount" };
/** How a line reads under its label: "80.0 h × $34.00", "142 km × $0.72", "3 days × $45.00", or only the amount. */
export function lineQty(l: EarningLine): LineQty {
  if (l.hours != null && l.hours > 0) return { kind: "hours", value: l.hours, rateCents: l.rateCents };
  if (l.quantity != null && l.quantity > 0 && l.kind === "mileage") return { kind: "km", value: l.quantity, rateCents: l.rateCents };
  if (l.quantity != null && l.quantity > 0 && l.kind === "per_diem") return { kind: "days", value: l.quantity, rateCents: l.rateCents };
  return { kind: "amount" };
}

/** The hourly rate on the straight-time line, for the "Painter lead · $34.00/h" line. */
export const hourlyRate = (w: WorkerPay): number | null => w.lines.find((l) => l.kind === "regular")?.rateCents ?? null;

export type EmployeeFlag = "noPayroll" | "noRate";
export function employeeFlag(w: WorkerPay): EmployeeFlag | null {
  if (!w.payrollId) return "noPayroll";
  const rate = hourlyRate(w);
  return rate === 0 ? "noRate" : null;
}

/** Approved travel and per diem lines across the employees (the claims list shows these after the waiting ones). */
export function approvedAllowances(r: PayReport): (Allowance & { workerName: string })[] {
  return r.employees.flatMap((e) => e.allowances.map((a) => ({ ...a, workerName: e.name }))).sort((a, b) => b.date.localeCompare(a.date));
}

// ── Labour by job ───────────────────────────────────────────────────────────

export type JobCard = JobPay & { share: number; key: string };
/** Jobs biggest first, each with its share of the total for the bar. */
export function jobCards(jobs: JobPay[]): JobCard[] {
  const total = jobs.reduce((n, j) => n + j.totalCents, 0);
  return [...jobs].sort((a, b) => b.totalCents - a.totalCents).map((j) => ({ ...j, key: j.projectId ?? "none", share: total > 0 ? j.totalCents / total : 0 }));
}
export const labourTotal = (jobs: JobPay[]): number => jobs.reduce((n, j) => n + j.totalCents, 0);
/** The burden as a percentage of wages, when the jobs carry any. */
export function burdenPercent(jobs: JobPay[]): number | null {
  const burden = jobs.reduce((n, j) => n + j.burdenCents, 0);
  const wages = jobs.reduce((n, j) => n + j.straightCents + j.premiumCents, 0);
  return burden > 0 && wages > 0 ? Math.round((burden / wages) * 100) : null;
}

// ── Rules ───────────────────────────────────────────────────────────────────

export type OvertimeRows = {
  starts: { kind: "daily"; hours: number } | { kind: "weekly"; hours: number } | { kind: "both"; daily: number; weekly: number } | { kind: "none" };
  multiplier: number;
  premium: { kind: "double"; hours: number; multiplier: number } | { kind: "holiday"; multiplier: number } | { kind: "none" };
};
export function overtimeRows(ot: Overtime, holidayWorkedMultiplier: number): OvertimeRows {
  const starts: OvertimeRows["starts"] = ot.dailyHours != null && ot.weeklyHours != null ? { kind: "both", daily: ot.dailyHours, weekly: ot.weeklyHours }
    : ot.dailyHours != null ? { kind: "daily", hours: ot.dailyHours } : ot.weeklyHours != null ? { kind: "weekly", hours: ot.weeklyHours } : { kind: "none" };
  const premium: OvertimeRows["premium"] = ot.dailyDoubleHours != null ? { kind: "double", hours: ot.dailyDoubleHours, multiplier: ot.doubleMultiplier }
    : holidayWorkedMultiplier > 1 ? { kind: "holiday", multiplier: holidayWorkedMultiplier } : { kind: "none" };
  return { starts, multiplier: ot.multiplier, premium };
}

/** The frequencies the segmented control shows: the board's three, and monthly only when the company already has it. */
export const frequencyOptions = (current: PayFrequency): PayFrequency[] => (current === "monthly" ? ["weekly", "biweekly", "semimonthly", "monthly"] : ["weekly", "biweekly", "semimonthly"]);

/** How many holidays fall in the calendar year of `today`. */
export const holidaysInYear = (holidays: Holiday[], today: string): number => holidays.filter((h) => h.date.slice(0, 4) === today.slice(0, 4)).length;
export const upcomingHoliday = (holidays: Holiday[], today: string): Holiday | null => holidays.find((h) => h.date >= today) ?? null;

export function earningCodesLine(codes: Record<EarningKind, string>): string {
  return (["regular", "overtime", "holiday", "mileage", "per_diem"] as const).map((k) => codes[k]).filter(Boolean).join(" · ");
}

/** Dollars typed in a field to cents, or null when it is not an amount. */
export function centsFrom(text: string): number | null {
  const n = Number(text.replace(",", ".").replace(/[^0-9.]/g, ""));
  return text.trim() !== "" && Number.isFinite(n) ? Math.round(n * 100) : null;
}
/** A percentage typed in a field (0 to 20), or null. */
export function percentFrom(text: string): number | null {
  const n = Number(text.replace(",", ".").replace(/[^0-9.]/g, ""));
  return text.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 20 ? n : null;
}

// ── Saving settings (PUT replaces them whole) ───────────────────────────────

const keepHolidayEdits = (h: RawSettings["holidays"]): NonNullable<RawSettings["holidays"]> => ({
  ...(h?.added ? { added: h.added } : null), ...(h?.removed ? { removed: h.removed } : null), ...(h?.substituteWeekend ? { substituteWeekend: true } : null),
});

export const withFrequency = (raw: RawSettings, frequency: PayFrequency): RawSettings => ({ ...raw, frequency });
/** A trade preset sets the overtime and the holiday rules; "none" goes back to the province's own. */
export function withPreset(raw: RawSettings, preset: Preset | null): RawSettings {
  if (!preset) return { ...raw, preset: null, overtime: null, holidays: keepHolidayEdits(raw.holidays) };
  return { ...raw, preset: preset.key, overtime: preset.overtime, holidays: { ...keepHolidayEdits(raw.holidays), ...preset.holidays } };
}
export const withAllowances = (raw: RawSettings, a: { kmRateCents?: number; perDiemCents?: number }): RawSettings => ({ ...raw, allowances: { ...raw.allowances, ...a } });
export const withVacation = (raw: RawSettings, percent: number | null): RawSettings => ({ ...raw, vacationPayPercent: percent && percent > 0 ? percent : null });
export const withFormat = (raw: RawSettings, exportFormat: PayFormat): RawSettings => ({ ...raw, exportFormat });
/** Only the codes that differ from the defaults are kept. */
export function withCodes(raw: RawSettings, codes: Record<EarningKind, string>, defaults: Record<EarningKind, string>): RawSettings {
  const diff = Object.fromEntries(EARNING_KINDS.filter((k) => codes[k].trim() && codes[k].trim() !== defaults[k]).map((k) => [k, codes[k].trim()]));
  return { ...raw, earningCodes: diff };
}
/** Take a statutory holiday off (or put it back), by its date. */
export function withHolidayOff(raw: RawSettings, date: string, off: boolean): RawSettings {
  const removed = new Set(raw.holidays?.removed ?? []);
  if (off) removed.add(date); else removed.delete(date);
  return { ...raw, holidays: { ...raw.holidays, removed: [...removed].sort() } };
}
