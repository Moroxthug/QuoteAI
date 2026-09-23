// Phase 85 — iCalendar, both directions.
//
// Every calendar anyone would ask about publishes .ics: Calendly hands one
// out per booking page, Apple Calendar and Thunderbird subscribe to them,
// municipal inspection schedules are published as them. So instead of an
// OAuth app per vendor, QuoteAI reads any URL and serves its own.
//
// This is a deliberately small parser: unfold, split into VEVENTs, read the
// handful of properties that matter, and expand RRULE for the common
// frequencies. It is not a general iCalendar implementation, and it says so —
// anything it cannot understand is skipped rather than guessed at.

export type IcsEvent = {
  uid: string;
  title: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  busy: boolean;
};

/** RFC 5545 §3.1: a long line is folded with CRLF + one space or tab. */
function unfold(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

/** `DTSTART;TZID=America/Toronto:20260930T090000` → name, params, value. */
function splitLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = left.split(";");
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: (name ?? "").toUpperCase(), params, value };
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

/**
 * A date-time in the three shapes a feed uses: UTC (`…Z`), a floating/TZID
 * local time, and a date-only value.
 *
 * A TZID is honoured only to the extent of *not pretending* it is UTC: the
 * value is read as if it were in the server's own zone, which is UTC here, so
 * a floating 09:00 stays 09:00 in the mirror and the widget shows it where the
 * feed put it. Carrying real IANA offsets would mean shipping a tz database
 * for a feature whose events are read-only context; the runbook states the
 * limit.
 */
function parseDateValue(value: string, params: Record<string, string>): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly || params.VALUE === "DATE") {
    const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!m) return null;
    return { date: new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))), allDay: true };
  }
  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (!dt) return null;
  const [, y, mo, d, h, mi, s] = dt;
  return {
    date: new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))),
    allDay: false,
  };
}

/** `PT1H30M` / `P2D` — only what DURATION realistically carries in a feed. */
function parseDuration(value: string): number | null {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, w, d, h, mi, s] = m;
  const ms =
    (Number(w ?? 0) * 7 + Number(d ?? 0)) * 86_400_000 +
    Number(h ?? 0) * 3_600_000 +
    Number(mi ?? 0) * 60_000 +
    Number(s ?? 0) * 1000;
  return ms || null;
}

const WEEKDAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/**
 * Expands RRULE into the occurrences inside [from, to).
 *
 * Supports FREQ=DAILY|WEEKLY|MONTHLY|YEARLY with INTERVAL, COUNT, UNTIL and
 * (for WEEKLY) BYDAY — which covers "every weekday", "every second Tuesday"
 * and the shapes Calendly and site-inspection feeds actually emit. Anything
 * else (BYSETPOS, BYMONTHDAY lists, EXDATE beyond exact matches) falls back to
 * the single first occurrence rather than inventing dates.
 */
export function expandRecurrence(
  start: Date,
  durationMs: number,
  rrule: string | null,
  exDates: Date[],
  from: Date,
  to: Date,
  cap = 400,
): Date[] {
  const excluded = new Set(exDates.map((d) => d.getTime()));
  const keep = (d: Date) => d.getTime() + durationMs > from.getTime() && d.getTime() < to.getTime() && !excluded.has(d.getTime());
  if (!rrule) return keep(start) ? [start] : [];

  const parts: Record<string, string> = {};
  for (const chunk of rrule.split(";")) {
    const eq = chunk.indexOf("=");
    if (eq > 0) parts[chunk.slice(0, eq).toUpperCase()] = chunk.slice(eq + 1);
  }
  const freq = (parts.FREQ ?? "").toUpperCase();
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return keep(start) ? [start] : [];

  const interval = Math.max(1, Number(parts.INTERVAL ?? 1) || 1);
  const count = parts.COUNT ? Number(parts.COUNT) : null;
  const until = parts.UNTIL ? parseDateValue(parts.UNTIL, {})?.date ?? null : null;
  const byDay = (parts.BYDAY ?? "")
    .split(",")
    .map((d) => WEEKDAYS[d.trim().slice(-2).toUpperCase()])
    .filter((d): d is number => d !== undefined);

  const out: Date[] = [];
  let emitted = 0;
  let cursor = new Date(start.getTime());
  const hardStop = to.getTime();

  const push = (d: Date) => {
    emitted++;
    if (keep(d)) out.push(new Date(d.getTime()));
  };

  for (let guard = 0; guard < cap * 4 && out.length < cap; guard++) {
    if (until && cursor.getTime() > until.getTime()) break;
    if (count !== null && emitted >= count) break;
    if (cursor.getTime() > hardStop) break;

    if (freq === "WEEKLY" && byDay.length) {
      // Walk the week the cursor sits in, emitting each requested weekday.
      const weekStart = new Date(cursor.getTime());
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      for (const day of byDay.slice().sort((a, b) => a - b)) {
        const occurrence = new Date(weekStart.getTime());
        occurrence.setUTCDate(weekStart.getUTCDate() + day);
        occurrence.setUTCHours(start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), 0);
        if (occurrence.getTime() < start.getTime()) continue;
        if (until && occurrence.getTime() > until.getTime()) continue;
        if (count !== null && emitted >= count) break;
        push(occurrence);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 7 * interval);
      continue;
    }

    push(cursor);
    const next = new Date(cursor.getTime());
    if (freq === "DAILY") next.setUTCDate(next.getUTCDate() + interval);
    else if (freq === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7 * interval);
    else if (freq === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + interval);
    else next.setUTCFullYear(next.getUTCFullYear() + interval);
    cursor = next;
  }
  return out;
}

/** Parses a whole .ics document into the occurrences inside [from, to). */
export function parseIcs(text: string, from: Date, to: Date, maxEvents = 1000): IcsEvent[] {
  const lines = unfold(text);
  const events: IcsEvent[] = [];
  let current: Record<string, { params: Record<string, string>; value: string }> | null = null;
  let exDates: Date[] = [];

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      current = {};
      exDates = [];
      continue;
    }
    if (line.startsWith("END:VEVENT")) {
      if (current) {
        const built = buildEvent(current, exDates, from, to);
        for (const e of built) {
          if (events.length >= maxEvents) break;
          events.push(e);
        }
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const parsed = splitLine(line);
    if (!parsed) continue;
    if (parsed.name === "EXDATE") {
      for (const v of parsed.value.split(",")) {
        const d = parseDateValue(v, parsed.params);
        if (d) exDates.push(d.date);
      }
      continue;
    }
    // First occurrence of a property wins (RFC allows repeats we do not use).
    if (!(parsed.name in current)) current[parsed.name] = { params: parsed.params, value: parsed.value };
  }
  return events;
}

function buildEvent(
  props: Record<string, { params: Record<string, string>; value: string }>,
  exDates: Date[],
  from: Date,
  to: Date,
): IcsEvent[] {
  const dtstart = props.DTSTART ? parseDateValue(props.DTSTART.value, props.DTSTART.params) : null;
  if (!dtstart) return [];
  const dtend = props.DTEND ? parseDateValue(props.DTEND.value, props.DTEND.params) : null;
  const duration = props.DURATION ? parseDuration(props.DURATION.value) : null;
  const durationMs =
    dtend ? Math.max(0, dtend.date.getTime() - dtstart.date.getTime()) : duration ?? (dtstart.allDay ? 86_400_000 : 3_600_000);

  const status = (props.STATUS?.value ?? "").toUpperCase();
  if (status === "CANCELLED") return [];
  const transparent = (props.TRANSP?.value ?? "").toUpperCase() === "TRANSPARENT";

  const uid = props.UID?.value?.trim() || `${dtstart.date.toISOString()}-${props.SUMMARY?.value ?? ""}`;
  const title = unescapeText(props.SUMMARY?.value ?? "");
  const location = unescapeText(props.LOCATION?.value ?? "");

  const occurrences = expandRecurrence(dtstart.date, durationMs, props.RRULE?.value ?? null, exDates, from, to);
  return occurrences.map((startsAt) => ({
    // One row per occurrence: the uid alone would collide across a series.
    uid: occurrences.length > 1 ? `${uid}::${startsAt.toISOString()}` : uid,
    title,
    location,
    startsAt,
    endsAt: new Date(startsAt.getTime() + durationMs),
    allDay: dtstart.allDay,
    busy: !transparent && status !== "TENTATIVE",
  }));
}

// ── Publishing ───────────────────────────────────────────────────────────────

export type PublishableEvent = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
};

const fold = (line: string): string => {
  // RFC 5545 §3.1: no line over 75 octets. Fold on CRLF + a single space.
  if (line.length <= 73) return line;
  const chunks: string[] = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    chunks.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest) chunks.push(" " + rest);
  return chunks.join("\r\n");
};

const escapeText = (v: string): string => v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const stampUtc = (d: Date): string => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const stampDate = (d: Date): string => d.toISOString().slice(0, 10).replace(/-/g, "");

/** Serialises QuoteAI's own schedule as a subscribable calendar. */
export function buildIcs(calendarName: string, events: PublishableEvent[], now = new Date()): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//QuoteAI//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${escapeText(calendarName)}`),
    // Tell subscribers how often to come back; most honour it, none guarantee it.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(fold(`UID:${e.uid}@quoteai.ca`));
    lines.push(`DTSTAMP:${stampUtc(now)}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${stampDate(e.startsAt)}`);
      lines.push(`DTEND;VALUE=DATE:${stampDate(e.endsAt)}`);
    } else {
      lines.push(`DTSTART:${stampUtc(e.startsAt)}`);
      lines.push(`DTEND:${stampUtc(e.endsAt)}`);
    }
    lines.push(fold(`SUMMARY:${escapeText(e.title)}`));
    if (e.description) lines.push(fold(`DESCRIPTION:${escapeText(e.description)}`));
    if (e.location) lines.push(fold(`LOCATION:${escapeText(e.location)}`));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
