import type { AdviceKey, Forecast, HourForecast, SummaryKey } from "./types.js";

// What the day looks like in words (WEATHER.md "Copy rules"): the backend decides, the app turns the keys into English or French. No AI call.

const WET = 50; // a probability of 50 % or more is rain (or snow)
const HOUR = 3_600_000;

export type Summary = { summaryKey: SummaryKey; summaryAt: string | null; adviceKey: AdviceKey | null; adviceAt: string | null };

const isWet = (h: HourForecast): boolean => h.precipProb >= WET && h.precipType !== "none";
const wetKind = (h: HourForecast): "rain" | "snow" => (h.precipType === "snow" || h.precipType === "sleet" ? "snow" : "rain");

/** The local calendar date (YYYY-MM-DD) of an instant in a zone. */
export function localDate(instant: number | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/**
 * Today's words. `now` is the current instant; only the hours of today (in `tz`) count. Rain (or snow) that has begun and has not ended is "now", one that is still to come is "after", rain in every
 * remaining hour is "all day", and a dry day at or under freezing is "freezing".
 */
export function summarize(f: Forecast, now: Date, tz: string): Summary {
  const today = localDate(now, tz);
  const hours = f.hourly.filter((h) => localDate(Date.parse(h.hour), tz) === today);
  // The hour that contains `now` (the last one that started at or before it), and the hours after it.
  const t = now.getTime();
  const current = [...hours].reverse().find((h) => Date.parse(h.hour) <= t) ?? null;
  const future = hours.filter((h) => Date.parse(h.hour) > t);
  const wetNow = !!current && isWet(current);

  if (wetNow) {
    const kind = wetKind(current!);
    const endAt = future.find((h) => !isWet(h));
    if (!endAt) return { summaryKey: "rain_all_day", summaryAt: null, adviceKey: "inside_only", adviceAt: null };
    return { summaryKey: kind === "snow" ? "snow_now" : "rain_now", summaryAt: endAt.hour, adviceKey: "exterior_after", adviceAt: endAt.hour };
  }
  const first = future.find(isWet);
  if (first) {
    const kind = wetKind(first);
    // All of the rest of the day is wet: say so rather than "after".
    if (future.length > 0 && future.every(isWet) && future[0] === first && (current === null || !isWet(current)) && Date.parse(first.hour) - t <= HOUR) {
      return { summaryKey: "rain_all_day", summaryAt: null, adviceKey: "inside_only", adviceAt: null };
    }
    const adviceAt = new Date(Date.parse(first.hour) - HOUR);
    return { summaryKey: kind === "snow" ? "snow_after" : "rain_after", summaryAt: first.hour, adviceKey: "exterior_before", adviceAt: offsetLike(adviceAt, first.hour) };
  }
  if (f.now.tempC <= 0) return { summaryKey: "freezing", summaryAt: null, adviceKey: null, adviceAt: null };
  return { summaryKey: "dry_all_day", summaryAt: null, adviceKey: "good_exterior", adviceAt: null };
}

/** `date` written with the same UTC offset as `like` (an ISO string with an offset), so the app reads the same wall-clock hour. */
export function offsetLike(date: Date, like: string): string {
  const m = /([+-])(\d{2}):(\d{2})$/.exec(like);
  if (!m) return date.toISOString();
  const sign = m[1] === "-" ? -1 : 1;
  const off = sign * (Number(m[2]) * 60 + Number(m[3]));
  const local = new Date(date.getTime() + off * 60_000).toISOString().slice(0, 19);
  return `${local}${m[1]}${m[2]}:${m[3]}`;
}
