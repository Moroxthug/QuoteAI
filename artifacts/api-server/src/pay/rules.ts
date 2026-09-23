import { DEFAULT_PROVINCE, normalizeProvince, type EarningKind, type HolidayRules, type OvertimeRules, type PayExportFormat, type PayFrequency, type PaySettings } from "@workspace/db";

// ── Phase 89: the rules, without the database ────────────────────────────────
// Provincial employment-standards defaults (the general rules — construction
// has sector exceptions: ON construction employees are paid 7.7 % in lieu of
// holiday and vacation pay, QC construction runs on the R-20 collective
// agreements), the statutory-holiday calendar, pay periods, and how a week of
// approved hours splits into straight time, overtime, double time and hours
// worked on a holiday. Every default can be overridden in the pay settings;
// none of this is legal advice, and the page says so.

const DAY_MS = 86_400_000;

// ── Day strings ──────────────────────────────────────────────────────────────

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toIso(new Date(toDate(iso).getTime() + n * DAY_MS));
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);
const weekday = (iso: string) => toDate(iso).getUTCDay();
const ymd = (y: number, m: number, d: number) => toIso(new Date(Date.UTC(y, m - 1, d)));

// ── Overtime defaults ────────────────────────────────────────────────────────

const ot = (dailyHours: number | null, weeklyHours: number | null, dailyDoubleHours: number | null = null): OvertimeRules => ({ dailyHours, dailyDoubleHours, weeklyHours, multiplier: 1.5, doubleMultiplier: 2 });

/** General employment-standards overtime, by province. NB, NS and NL set the floor at 1.5× minimum wage; 1.5× the worker's own rate is never less. */
export const PROVINCE_OVERTIME: Record<string, OvertimeRules> = {
  BC: ot(8, 40, 12),
  AB: ot(8, 44),
  SK: ot(8, 40),
  MB: ot(8, 40),
  ON: ot(null, 44),
  QC: ot(null, 40),
  NB: ot(null, 44),
  NS: ot(null, 48),
  PE: ot(null, 48),
  NL: ot(null, 40),
  YT: ot(8, 40),
  NT: ot(8, 40),
  NU: ot(8, 40),
};

const hol = (method: HolidayRules["method"], minDaysWorked = 1, minEmployedDays = 0, workedMultiplier = 1.5): HolidayRules => ({ method, workedMultiplier, minDaysWorked, minEmployedDays });

/** How a statutory holiday is paid, by province (general rules; QC pays the indemnity on top of the day's wages instead of a premium). */
export const PROVINCE_HOLIDAY_RULES: Record<string, HolidayRules> = {
  BC: hol("avg_day_30d", 15, 30),
  AB: hol("avg_day_28d", 1, 30),
  SK: hol("div20_4w"),
  MB: hol("div20_4w"),
  ON: hol("div20_4w"),
  QC: hol("div20_4w", 1, 0, 1),
  NB: hol("avg_day_28d"),
  NS: hol("avg_day_28d", 15),
  PE: hol("avg_day_28d"),
  NL: hol("avg_day_28d"),
  YT: hol("avg_day_28d"),
  NT: hol("avg_day_28d"),
  NU: hol("avg_day_28d"),
};

// ── Statutory holidays ───────────────────────────────────────────────────────

type HolidayKey =
  | "new_year"
  | "family_day"
  | "louis_riel_day"
  | "islander_day"
  | "heritage_day_ns"
  | "good_friday"
  | "victoria_day"
  | "patriots_day"
  | "indigenous_peoples_day"
  | "st_jean_baptiste"
  | "canada_day"
  | "memorial_day"
  | "nunavut_day"
  | "civic_holiday"
  | "discovery_day"
  | "labour_day"
  | "truth_reconciliation"
  | "thanksgiving"
  | "remembrance_day"
  | "christmas"
  | "boxing_day";

/** Anonymous Gregorian algorithm. */
function easter(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return ymd(y, Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1);
}
/** n-th `dow` (0 = Sunday) of a month. */
function nth(y: number, month: number, dow: number, n: number): string {
  const first = ymd(y, month, 1);
  return addDays(first, ((dow - weekday(first) + 7) % 7) + (n - 1) * 7);
}
/** The Monday before May 25. */
const victoria = (y: number) => addDays(ymd(y, 5, 24), -((weekday(ymd(y, 5, 24)) + 6) % 7));

const ALL = ["BC", "AB", "SK", "MB", "ON", "QC", "NB", "NS", "PE", "NL", "YT", "NT", "NU"];
const HOLIDAYS: { key: HolidayKey; provinces: string[]; date: (y: number) => string }[] = [
  { key: "new_year", provinces: ALL, date: (y) => ymd(y, 1, 1) },
  { key: "family_day", provinces: ["AB", "BC", "NB", "ON", "SK"], date: (y) => nth(y, 2, 1, 3) },
  { key: "louis_riel_day", provinces: ["MB"], date: (y) => nth(y, 2, 1, 3) },
  { key: "islander_day", provinces: ["PE"], date: (y) => nth(y, 2, 1, 3) },
  { key: "heritage_day_ns", provinces: ["NS"], date: (y) => nth(y, 2, 1, 3) },
  { key: "good_friday", provinces: ALL, date: (y) => addDays(easter(y), -2) },
  { key: "victoria_day", provinces: ["AB", "BC", "MB", "ON", "SK", "YT", "NT", "NU"], date: victoria },
  { key: "patriots_day", provinces: ["QC"], date: victoria },
  { key: "indigenous_peoples_day", provinces: ["NT", "YT"], date: (y) => ymd(y, 6, 21) },
  { key: "st_jean_baptiste", provinces: ["QC"], date: (y) => ymd(y, 6, 24) },
  // Quebec moves Canada Day to July 2 when July 1 is a Sunday (holidaysBetween).
  { key: "canada_day", provinces: ALL.filter((p) => p !== "NL"), date: (y) => ymd(y, 7, 1) },
  { key: "memorial_day", provinces: ["NL"], date: (y) => ymd(y, 7, 1) },
  { key: "nunavut_day", provinces: ["NU"], date: (y) => ymd(y, 7, 9) },
  { key: "civic_holiday", provinces: ["BC", "SK", "NB", "NT", "NU"], date: (y) => nth(y, 8, 1, 1) },
  { key: "discovery_day", provinces: ["YT"], date: (y) => nth(y, 8, 1, 3) },
  { key: "labour_day", provinces: ALL, date: (y) => nth(y, 9, 1, 1) },
  { key: "truth_reconciliation", provinces: ["BC", "PE", "YT", "NT", "NU"], date: (y) => ymd(y, 9, 30) },
  { key: "thanksgiving", provinces: ["AB", "BC", "MB", "ON", "QC", "SK", "YT", "NT", "NU"], date: (y) => nth(y, 10, 1, 2) },
  { key: "remembrance_day", provinces: ["AB", "BC", "NB", "NL", "PE", "SK", "YT", "NT", "NU"], date: (y) => ymd(y, 11, 11) },
  { key: "christmas", provinces: ALL, date: (y) => ymd(y, 12, 25) },
  { key: "boxing_day", provinces: ["ON"], date: (y) => ymd(y, 12, 26) },
];

export type Holiday = { date: string; key: HolidayKey | null; name: string | null; custom: boolean };

/** The province's statutory holidays in [from, to], plus the company's own additions, minus its removals. */
export function holidaysBetween(province: string | null | undefined, from: string, to: string, settings: PaySettings = {}): Holiday[] {
  const p: string = normalizeProvince(province) ?? DEFAULT_PROVINCE;
  const removed = new Set(settings.holidays?.removed ?? []);
  const out = new Map<string, Holiday>();
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    for (const h of HOLIDAYS) {
      if (!h.provinces.includes(p)) continue;
      let date = h.date(y);
      if (p === "QC" && h.key === "canada_day" && weekday(date) === 0) date = addDays(date, 1);
      if (date >= from && date <= to && !removed.has(date)) out.set(date, { date, key: h.key, name: null, custom: false });
    }
  }
  for (const a of settings.holidays?.added ?? []) if (a.date >= from && a.date <= to && !removed.has(a.date)) out.set(a.date, { date: a.date, key: null, name: a.name, custom: true });
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ── Effective settings ───────────────────────────────────────────────────────

export const DEFAULT_EARNING_CODES: Record<EarningKind, string> = {
  regular: "REG",
  overtime: "OT",
  double: "DT",
  holiday: "STAT",
  holiday_worked: "STATW",
  mileage: "KM",
  per_diem: "PD",
  other: "OTHER",
};

export type EffectivePaySettings = {
  province: string;
  frequency: PayFrequency;
  anchorDate: string;
  weekStartsOn: number;
  overtime: OvertimeRules;
  overtimeIsDefault: boolean;
  averaging: { weeks: number; startDate: string } | null;
  holidays: HolidayRules;
  allowances: { kmRateCents: number; perDiemCents: number };
  exportFormat: PayExportFormat;
  earningCodes: Record<EarningKind, string>;
};

/** A Sunday — weekly and biweekly periods count from here until the company picks its own first day. */
const DEFAULT_ANCHOR = "2026-01-04";

export function effectivePaySettings(province: string | null | undefined, s: PaySettings = {}): EffectivePaySettings {
  const p: string = normalizeProvince(province) ?? DEFAULT_PROVINCE;
  const weekStartsOn = Number.isInteger(s.weekStartsOn) && s.weekStartsOn! >= 0 && s.weekStartsOn! <= 6 ? s.weekStartsOn! : 0;
  const defaultAnchor = addDays(DEFAULT_ANCHOR, weekStartsOn);
  return {
    province: p,
    frequency: s.frequency ?? "biweekly",
    anchorDate: s.anchorDate ?? defaultAnchor,
    weekStartsOn,
    overtime: s.overtime ?? PROVINCE_OVERTIME[p]!,
    overtimeIsDefault: !s.overtime,
    averaging: s.averaging && s.averaging.weeks > 1 ? s.averaging : null,
    holidays: { ...PROVINCE_HOLIDAY_RULES[p]!, ...stripUndefined({ method: s.holidays?.method, workedMultiplier: s.holidays?.workedMultiplier, minDaysWorked: s.holidays?.minDaysWorked, minEmployedDays: s.holidays?.minEmployedDays }) },
    allowances: { kmRateCents: s.allowances?.kmRateCents ?? 72, perDiemCents: s.allowances?.perDiemCents ?? 0 },
    exportFormat: s.exportFormat ?? "generic",
    earningCodes: { ...DEFAULT_EARNING_CODES, ...stripUndefined(s.earningCodes ?? {}) },
  };
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;
}

// ── Periods and overtime windows ─────────────────────────────────────────────

export type Period = { start: string; end: string };

/** The pay period a day falls in. */
export function periodContaining(day: string, s: Pick<EffectivePaySettings, "frequency" | "anchorDate">): Period {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  if (s.frequency === "monthly") return { start: ymd(y, m, 1), end: ymd(y, m + 1, 0) };
  if (s.frequency === "semimonthly") return d <= 15 ? { start: ymd(y, m, 1), end: ymd(y, m, 15) } : { start: ymd(y, m, 16), end: ymd(y, m + 1, 0) };
  const len = s.frequency === "weekly" ? 7 : 14;
  const offset = Math.floor(daysBetween(s.anchorDate, day) / len) * len;
  const start = addDays(s.anchorDate, offset);
  return { start, end: addDays(start, len - 1) };
}

export const previousPeriod = (p: Period, s: Pick<EffectivePaySettings, "frequency" | "anchorDate">) => periodContaining(addDays(p.start, -1), s);

/** The stretch overtime is counted over: the workweek, or the averaging block. */
export function overtimeWindow(day: string, s: Pick<EffectivePaySettings, "weekStartsOn" | "averaging">): Period {
  if (s.averaging) {
    const len = s.averaging.weeks * 7;
    const start = addDays(s.averaging.startDate, Math.floor(daysBetween(s.averaging.startDate, day) / len) * len);
    return { start, end: addDays(start, len - 1) };
  }
  const start = addDays(day, -((weekday(day) - s.weekStartsOn + 7) % 7));
  return { start, end: addDays(start, 6) };
}

// ── Splitting a window of hours ──────────────────────────────────────────────

export type WindowEntry = { id: string; day: string; hours: number; rateCents: number };
export type EntrySplit = { overtimeHours: number; doubleHours: number; holidayHours: number; premiumCents: number };

/**
 * Walks the window's entries in the order they were worked (the caller sorts
 * them). Straight time fills the day up to the daily threshold and the window
 * up to the weekly one (× weeks when averaging); the hours past either are
 * overtime, past the double threshold double time. Hours on a statutory
 * holiday are paid at the holiday multiplier and count toward neither.
 * Works in hundredths of an hour so 7.25 + 0.75 is exactly 8.
 */
export function splitWindow(entries: WindowEntry[], rules: OvertimeRules, holidays: Set<string>, holidayMultiplier: number, weeks = 1): Map<string, EntrySplit> {
  const cap = (h: number | null) => (h == null ? Number.POSITIVE_INFINITY : Math.round(h * 100));
  const dailyCap = cap(rules.dailyHours);
  const doubleCap = cap(rules.dailyDoubleHours);
  const windowCap = rules.weeklyHours == null ? Number.POSITIVE_INFINITY : Math.round(rules.weeklyHours * 100 * weeks);
  const dayTotals = new Map<string, number>();
  let straightSoFar = 0;
  const out = new Map<string, EntrySplit>();
  for (const e of entries) {
    const h = Math.max(0, Math.round(e.hours * 100));
    let overtime = 0, double = 0, holiday = 0;
    if (holidays.has(e.day)) {
      holiday = h;
    } else {
      const before = dayTotals.get(e.day) ?? 0;
      dayTotals.set(e.day, before + h);
      const dailyStraight = Math.min(h, Math.max(0, dailyCap - before));
      double = Math.min(h - dailyStraight, Math.max(0, before + h - Math.max(doubleCap, before)));
      overtime = h - dailyStraight - double;
      const weeklyOver = Math.max(0, dailyStraight - Math.max(0, windowCap - straightSoFar));
      overtime += weeklyOver;
      straightSoFar += dailyStraight - weeklyOver;
    }
    const premium = (overtime / 100) * e.rateCents * (rules.multiplier - 1) + (double / 100) * e.rateCents * (rules.doubleMultiplier - 1) + (holiday / 100) * e.rateCents * (holidayMultiplier - 1);
    out.set(e.id, { overtimeHours: overtime / 100, doubleHours: double / 100, holidayHours: holiday / 100, premiumCents: Math.round(premium) });
  }
  return out;
}

// ── Holiday pay ──────────────────────────────────────────────────────────────

export type HolidayPayInput = { straightCents: number; straightHours: number; daysWorked: number; firstWorkedDaysAgo: number | null };

/**
 * The holiday pay one employee is owed for one holiday, from their straight-time
 * wages before it (overtime premiums, allowances and earlier holiday pay left
 * out). Null when they don't qualify, with the reason.
 */
export function holidayPay(rules: HolidayRules, input: HolidayPayInput): { cents: number; hours: number } | { cents: null; reason: "method_none" | "not_employed_long_enough" | "too_few_days" } {
  if (rules.method === "none") return { cents: null, reason: "method_none" };
  if (input.firstWorkedDaysAgo == null || input.firstWorkedDaysAgo < rules.minEmployedDays) return { cents: null, reason: "not_employed_long_enough" };
  if (input.daysWorked < Math.max(1, rules.minDaysWorked)) return { cents: null, reason: "too_few_days" };
  if (rules.method === "div20_4w") return { cents: Math.round(input.straightCents / 20), hours: round2(input.straightHours / 20) };
  return { cents: Math.round(input.straightCents / input.daysWorked), hours: round2(input.straightHours / input.daysWorked) };
}

/** Days before the holiday the wages are counted over. */
export const holidayLookbackDays = (method: HolidayRules["method"]) => (method === "avg_day_30d" ? 30 : 28);

export const round2 = (n: number) => Math.round(n * 100) / 100;
