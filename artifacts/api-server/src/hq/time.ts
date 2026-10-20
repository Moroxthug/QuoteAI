// Owner HQ (Phase 132): dates are stored in UTC and reported in America/Toronto. Pure helpers, no database.

export const HQ_TZ = "America/Toronto";
export type Bucket = "day" | "week" | "month";

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: HQ_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** Offset of Toronto from UTC at an instant, in ms (negative: Toronto is behind UTC). */
function offsetMs(utcMs: number): number {
  const p: Record<string, number> = {};
  for (const x of parts.formatToParts(new Date(utcMs))) if (x.type !== "literal") p[x.type] = Number(x.value);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isYmd(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = YMD.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

const toMs = (ymd: string): number => {
  const m = YMD.exec(ymd)!;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
};
const fromMs = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function addDays(ymd: string, n: number): string {
  return fromMs(toMs(ymd) + n * 86_400_000);
}

/** Whole days from `a` to `b` (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / 86_400_000);
}

/** Days in the range, both ends included. */
export function daysInclusive(from: string, to: string): number {
  return diffDays(from, to) + 1;
}

/** The Toronto calendar date of an instant. */
export function torontoDate(d: Date): string {
  const p: Record<string, string> = {};
  for (const x of parts.formatToParts(d)) if (x.type !== "literal") p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
}

/** The instant a Toronto day begins (00:00 local). */
export function torontoDayStart(ymd: string): Date {
  const guess = toMs(ymd);
  const o1 = offsetMs(guess);
  let t = guess - o1;
  const o2 = offsetMs(t);
  if (o2 !== o1) t = guess - o2;
  return new Date(t);
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export const isLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** First day of the bucket that holds `ymd` (weeks start on Monday, like Postgres date_trunc). */
export function bucketStart(ymd: string, bucket: Bucket): string {
  if (bucket === "day") return ymd;
  if (bucket === "month") return `${ymd.slice(0, 7)}-01`;
  const dow = new Date(toMs(ymd)).getUTCDay(); // 0 = Sunday
  return addDays(ymd, -((dow + 6) % 7));
}

export function nextBucketStart(start: string, bucket: Bucket): string {
  if (bucket === "day") return addDays(start, 1);
  if (bucket === "week") return addDays(start, 7);
  const y = +start.slice(0, 4);
  const m = +start.slice(5, 7);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** Every bucket start that touches [from, to], oldest first. */
export function bucketStarts(from: string, to: string, bucket: Bucket): string[] {
  const out: string[] = [];
  for (let s = bucketStart(from, bucket); s <= to; s = nextBucketStart(s, bucket)) out.push(s);
  return out;
}

/** The bucket's own date span clipped to [from, to]: start and end both inclusive. */
export function bucketSpan(start: string, bucket: Bucket, from: string, to: string): { start: string; end: string; days: number } {
  const s = start < from ? from : start;
  const lastDay = addDays(nextBucketStart(start, bucket), -1);
  const e = lastDay > to ? to : lastDay;
  return { start: s, end: e, days: Math.max(0, daysInclusive(s, e)) };
}

export type HqRange = { from: string; to: string; days: number; startAt: Date; endAt: Date };

/** `endAt` is exclusive: the instant the day after `to` begins in Toronto. */
export function makeRange(from: string, to: string): HqRange {
  return { from, to, days: daysInclusive(from, to), startAt: torontoDayStart(from), endAt: torontoDayStart(addDays(to, 1)) };
}

export const MAX_RANGE_DAYS = 800;

/** Defaults to the last 30 days ending today (Toronto). Returns an error string when the query is not usable. */
export function parseRange(q: { from?: unknown; to?: unknown }, now: Date = new Date()): HqRange | string {
  const today = torontoDate(now);
  const to = q.to === undefined || q.to === "" ? today : q.to;
  if (!isYmd(to)) return "to must be YYYY-MM-DD";
  const from = q.from === undefined || q.from === "" ? addDays(to, -29) : q.from;
  if (!isYmd(from)) return "from must be YYYY-MM-DD";
  if (from > to) return "from must not be after to";
  if (daysInclusive(from, to) > MAX_RANGE_DAYS) return `range is limited to ${MAX_RANGE_DAYS} days`;
  return makeRange(from, to);
}
