// Weather on Home (docs/pocket-design/handoff/WEATHER.md): the pure parts. The server decides what the day is (keys such as rain_after) and sends hours and days; this turns them into what the header, the Site
// weather widget (collapsed and expanded) and This week draw, in English or French. No network, no React, so it is tested on its own.
export type Locale = "en-CA" | "fr-CA";
export type Condition = "clear" | "partly_cloudy" | "cloudy" | "rain" | "showers" | "snow" | "sleet" | "fog" | "thunder";
export type PrecipType = "rain" | "snow" | "sleet" | "none";
export type SummaryKey = "rain_after" | "rain_now" | "rain_all_day" | "snow_after" | "snow_now" | "dry_all_day" | "freezing";
export type AdviceKey = "exterior_before" | "exterior_after" | "inside_only" | "good_exterior";
export type Hour = { hour: string; tempC: number; precipProb: number; precipType: PrecipType };
export type Day = { date: string; precipProb: number; precipType: PrecipType; visits: number };
export type Site = {
  siteId: string; name: string; area: string; crewCount: number; isCompany?: boolean;
  now: { tempC: number; condition: Condition }; hourly: Hour[]; daily7: Day[];
  summaryKey: SummaryKey; summaryAt: string | null; adviceKey: AdviceKey | null; adviceAt: string | null;
};
export type Attribution = { name: string; legalUrl: string; logoLightUrl?: string; logoDarkUrl?: string };
export type WeatherToday = { fetchedAt: string; primarySiteId: string | null; sites: Site[]; provider: "mock" | "weatherkit" | "eccc"; attribution: Attribution | null };

/** The weather is refetched on Home when older than this; the server asks its source once in the same time. */
export const FRESH_MS = 30 * 60_000;
/** An answer kept on the phone is shown (as "Updated ...") for up to this long when there is no connection. */
export const STALE_MS = 6 * 3_600_000;

/** "12°", with the real minus sign: "−4°". */
export const tempText = (c: number): string => `${c < 0 ? "−" : ""}${Math.abs(Math.round(c))}°`;

/** The hour in an ISO string's own wall clock (the company's, not the phone's): "2026-09-29T15:00:00-04:00" → 15. */
export const hourOf = (iso: string): number => Number(iso.slice(11, 13));

/** "3 pm" / "15 h": for the header and the summary. Never "15:00". */
export function hourText(iso: string, locale: Locale): string {
  const h = hourOf(iso);
  return locale === "fr-CA" ? `${h} h` : `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
}

/** "14:00" in English and "14 h" in French: the practical line's own style ("Plan exterior work before 14:00"). */
export function clockText(iso: string, locale: Locale): string {
  const h = hourOf(iso);
  return locale === "fr-CA" ? `${h} h` : `${String(h).padStart(2, "0")}:00`;
}

export type Words = { key: string; vars: Record<string, string> };

/** The summary's i18n key under `wx.sum` and its time: "rain after 3 pm". */
export function summaryWords(s: Pick<Site, "summaryKey" | "summaryAt">, locale: Locale): Words {
  return { key: `sum.${s.summaryKey}`, vars: { time: s.summaryAt ? hourText(s.summaryAt, locale) : "" } };
}

/** The practical line's key under `wx.adv`, or null (freezing has none). */
export function adviceWords(s: Pick<Site, "adviceKey" | "adviceAt">, locale: Locale): Words | null {
  return s.adviceKey ? { key: `adv.${s.adviceKey}`, vars: { time: s.adviceAt ? clockText(s.adviceAt, locale) : "" } } : null;
}

/** A condition's glyph (from the icons the app has) and whether it rains in the picture. */
export function glyphOf(c: Condition): { glyph: "sun" | "cloud" | "cloudRain"; wet: boolean } {
  switch (c) {
    case "clear": return { glyph: "sun", wet: false };
    case "rain": case "showers": case "thunder": case "snow": case "sleet": return { glyph: "cloudRain", wet: true };
    default: return { glyph: "cloud", wet: false };
  }
}

/** The 8 hourly rain bars: the working day (6 am to 10 pm) of today, spread evenly when there are more than 8; height from the chance, opacity .25 to 1. */
export function rainBars(site: Pick<Site, "hourly">, today: string): { label: string; height: number; opacity: number; prob: number }[] {
  const day = site.hourly.filter((h) => h.hour.slice(0, 10) === today && hourOf(h.hour) >= 6 && hourOf(h.hour) <= 22);
  const pick = day.length <= 8 ? day : Array.from({ length: 8 }, (_, i) => day[Math.round((i * (day.length - 1)) / 7)]!);
  return pick.map((h) => ({ label: String(hourOf(h.hour)), height: Math.max(3, Math.round((h.precipProb / 100) * 34)), opacity: Number((0.25 + (h.precipProb / 100) * 0.75).toFixed(2)), prob: h.precipProb }));
}

/** The expanded card's 6 two-hour slots from 7 am: hour, temperature, rain chance; 50 % or more is marked. */
export function twoHourSlots(site: Pick<Site, "hourly">, today: string): { label: string; temp: string; rain: number; wet: boolean }[] {
  const byHour = new Map(site.hourly.filter((h) => h.hour.slice(0, 10) === today).map((h) => [hourOf(h.hour), h] as const));
  const nearest = (hr: number): Hour | undefined => byHour.get(hr) ?? byHour.get(hr - 1) ?? byHour.get(hr + 1);
  return [7, 9, 11, 13, 15, 17].flatMap((hr) => {
    const h = nearest(hr);
    return h ? [{ label: String(hr), temp: tempText(h.tempC), rain: h.precipProb, wet: h.precipProb >= 50 }] : [];
  });
}

export const RAIN_AT = 50;

/** The 7-day strip of This week: weekday, date, up to 3 visit dots, a rain drop at 50 % or more. */
export function weekDays(site: Pick<Site, "daily7">, locale: Locale): { dow: string; date: number; dots: number; rain: boolean; today: boolean; iso: string; prob: number; visits: number }[] {
  return site.daily7.map((d, i) => {
    const at = new Date(`${d.date}T12:00:00Z`);
    return { dow: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(at).replace(/\.$/, ""), date: at.getUTCDate(), dots: Math.min(3, d.visits), rain: d.precipProb >= RAIN_AT, today: i === 0, iso: d.date, prob: d.precipProb, visits: d.visits };
  });
}

/** Which days have rain and which dry day suits outside work best: the least wet day before the first rain (when rain is in the first four days), else the least wet of all. */
export function weekPlan(days: { iso: string; prob: number }[]): { rainDays: string[]; best: string | null } {
  const rainDays = days.filter((d) => d.prob >= RAIN_AT).map((d) => d.iso);
  const dry = days.filter((d) => d.prob < RAIN_AT);
  if (dry.length === 0) return { rainDays, best: null };
  const firstRain = days.findIndex((d) => d.prob >= RAIN_AT);
  const pool = firstRain > 0 && firstRain <= 3 ? days.slice(0, firstRain) : dry;
  const best = pool.reduce((a, b) => (b.prob < a.prob ? b : a));
  return { rainDays, best: best.iso };
}

export type View = "loading" | "loaded" | "stale" | "unavailable";

/** What Home shows: nothing yet, the answer, an old answer from the phone (under 6 hours), or no weather. */
export function viewOf(o: { fetching: boolean; data: WeatherToday | null; fromCache: boolean; savedAt: number | null; now: number }): View {
  if (o.data && o.data.sites.length > 0) {
    if (o.fromCache) return o.savedAt != null && o.now - o.savedAt < STALE_MS ? "stale" : "unavailable";
    return "loaded";
  }
  return o.fetching ? "loading" : "unavailable";
}

/** Whether a saved answer is old enough to ask again. */
export const isOld = (fetchedAt: string | number, now: number): boolean => now - (typeof fetchedAt === "number" ? fetchedAt : Date.parse(fetchedAt)) > FRESH_MS;

/** The site the header and the collapsed widget use: the primary one. */
export const primaryOf = (w: WeatherToday): Site | null => w.sites.find((s) => s.siteId === w.primarySiteId) ?? w.sites[0] ?? null;
