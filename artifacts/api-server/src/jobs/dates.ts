// Working-day arithmetic for job schedules (Mon–Fri; statutory holidays are
// not modelled — the company adjusts dates on the review screen).

const DAY_MS = 86_400_000;

export function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** First working day on or after `d`. */
export function nextWorkingDay(d: Date): Date {
  let cur = startOfDayUtc(d);
  while (isWeekend(cur)) cur = new Date(cur.getTime() + DAY_MS);
  return cur;
}

/** Adds `n` working days (n ≥ 1 → lands on the n-th working day after `from`, weekends skipped). */
export function addWorkingDays(from: Date, n: number): Date {
  let cur = startOfDayUtc(from);
  let remaining = Math.max(0, Math.round(n));
  while (remaining > 0) {
    cur = new Date(cur.getTime() + DAY_MS);
    if (!isWeekend(cur)) remaining -= 1;
  }
  return cur;
}

export function addCalendarDays(from: Date, n: number): Date {
  return new Date(startOfDayUtc(from).getTime() + Math.round(n) * DAY_MS);
}

/** Parses "YYYY-MM-DD" as a UTC date; null when malformed. */
export function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toIsoDate(d: Date | null | undefined): string | null {
  return d ? startOfDayUtc(d).toISOString().slice(0, 10) : null;
}

/**
 * Lays consecutive milestones out on the calendar from `start`, each taking
 * `durations[i]` working days (min 1). Returns inclusive [start, end] pairs.
 */
export function layoutSequential(start: Date, durations: number[]): { start: Date; end: Date }[] {
  const out: { start: Date; end: Date }[] = [];
  let cursor = nextWorkingDay(start);
  for (const raw of durations) {
    const days = Math.max(1, Math.round(raw));
    const s = cursor;
    const e = days === 1 ? s : addWorkingDays(s, days - 1);
    out.push({ start: s, end: e });
    cursor = addWorkingDays(e, 1);
  }
  return out;
}

// ── Local calendar days ──────────────────────────────────────────────────────

const PROVINCE_TZ: Record<string, string> = {
  BC: "America/Vancouver",
  YT: "America/Whitehorse",
  AB: "America/Edmonton",
  NT: "America/Yellowknife",
  SK: "America/Regina",
  MB: "America/Winnipeg",
  NU: "America/Iqaluit",
  ON: "America/Toronto",
  QC: "America/Toronto",
  NB: "America/Halifax",
  NS: "America/Halifax",
  PE: "America/Halifax",
  NL: "America/St_Johns",
};

export function timeZoneForProvince(province: string | null | undefined): string {
  return PROVINCE_TZ[(province ?? "").toUpperCase()] ?? "America/Toronto";
}

/**
 * The calendar day an instant falls on in the company's province, as the
 * UTC-midnight Date the `date` columns store. A clock-in at 20:18 in Ottawa
 * is 00:18 UTC the next day; before Phase 66 it was logged on that next day.
 */
export function localDayFor(instant: Date, province: string | null | undefined): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZoneForProvince(province), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00Z`);
}
