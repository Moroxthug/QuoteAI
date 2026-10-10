// Wall-clock helpers for a zone: the weather's hours and dates are the company's own, written with their UTC offset (2026-09-29T07:00:00-04:00).

const pad = (n: number): string => String(n).padStart(2, "0");

/** The zone's UTC offset at an instant, in minutes (Toronto in summer: -240). */
export function offsetMinutes(at: Date, tz: string): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(part);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

const fmtOffset = (min: number): string => `${min < 0 ? "-" : "+"}${pad(Math.floor(Math.abs(min) / 60))}:${pad(Math.abs(min) % 60)}`;

/** `date` (YYYY-MM-DD) at `hour` o'clock on the zone's wall clock, as an ISO string with the zone's offset at that moment. */
export function zonedIso(date: string, hour: number, tz: string): string {
  const wall = Date.parse(`${date}T${pad(hour)}:00:00Z`);
  let off = offsetMinutes(new Date(wall), tz);
  off = offsetMinutes(new Date(wall - off * 60_000), tz); // across a clock change the offset belongs to the moment itself
  return `${date}T${pad(hour)}:00:00${fmtOffset(off)}`;
}

/** An instant written with the zone's offset, to the hour it falls in. */
export function isoOnTheHour(at: Date, tz: string): string {
  const off = offsetMinutes(at, tz);
  const wall = new Date(at.getTime() + off * 60_000).toISOString();
  return `${wall.slice(0, 13)}:00:00${fmtOffset(off)}`;
}

/** The date string `count` days after `from` (YYYY-MM-DD). */
export function addDays(from: string, count: number): string {
  return new Date(Date.parse(`${from}T12:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10);
}
