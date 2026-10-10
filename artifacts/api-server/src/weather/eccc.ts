import type { Attribution, Condition, DayForecast, Forecast, HourForecast, PrecipType, WeatherProvider } from "./types.js";
import { isoOnTheHour } from "./time.js";
import { localDate } from "./summary.js";

// Environment and Climate Change Canada's city-page forecasts (MSC GeoMet OGC API, api.weather.gc.ca): free for commercial use under the Open Government Licence - Canada, bilingual, hourly for the
// next 24 hours and a 5-6 day outlook. It is what runs when no Apple WeatherKit credentials are set. The licence asks for the source to be named, so it comes back as the attribution.

const API = "https://api.weather.gc.ca/collections/citypageweather-realtime/items";
export const ECCC_ATTRIBUTION: Attribution = { name: "Environment and Climate Change Canada", legalUrl: "https://eccc-msc.github.io/open-data/licence/readme_en/" };

type Bi = { en?: string | number; fr?: string | number };
type Props = {
  currentConditions?: { temperature?: { value?: Bi }; iconCode?: { value?: number } };
  hourlyForecastGroup?: { hourlyForecasts?: Array<{ timestamp: string; iconCode?: { value?: number }; temperature?: { value?: Bi }; lop?: { value?: Bi } }> };
  forecastGroup?: { forecasts?: Array<{ period?: { textForecastName?: Bi }; abbreviatedForecast?: { icon?: { value?: number }; pop?: { value?: Bi } } }> };
};

const num = (b: Bi | undefined): number | null => {
  const v = b?.en;
  if (typeof v === "number") return v;
  if (v == null || v === "" || Number.isNaN(Number(v))) return null;
  return Number(v);
};

/** ECCC icon codes → what we draw. https://eccc-msc.github.io/open-data/msc-data/citypage-weather/ */
export function conditionOfCode(code: number | null | undefined): Condition {
  if (code == null) return "cloudy";
  if ([0, 1, 30, 31].includes(code)) return "clear";
  if ([2, 3, 32, 33, 34, 35].includes(code)) return "partly_cloudy";
  if ([9, 19, 39].includes(code)) return "thunder";
  if ([6, 12, 28, 36].includes(code)) return "showers";
  if ([11, 13].includes(code)) return "rain";
  if ([15, 16, 17, 18, 25, 26, 27, 37, 38, 40, 7, 8, 14].includes(code)) return [14, 7, 8, 15].includes(code) ? "sleet" : "snow";
  if ([23, 24, 44, 45].includes(code)) return "fog";
  return "cloudy";
}

export function precipOfCode(code: number | null | undefined): PrecipType {
  const c = conditionOfCode(code);
  return c === "rain" || c === "showers" || c === "thunder" ? "rain" : c === "snow" ? "snow" : c === "sleet" ? "sleet" : "none";
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** The date (YYYY-MM-DD) of ECCC's named periods: "Today", "Tonight", "Thursday", "Thursday night"... counted from today. Nights belong to the day before them. */
export function periodDates(names: string[], today: string): (string | null)[] {
  const base = new Date(`${today}T12:00:00Z`);
  const wd0 = base.getUTCDay();
  return names.map((raw) => {
    const n = raw.toLowerCase().replace(/\s+night$/, "").trim();
    if (n === "today" || n === "tonight" || n === "this afternoon" || n === "this evening") return today;
    const idx = WEEKDAYS.indexOf(n);
    if (idx < 0) return null;
    const ahead = (idx - wd0 + 7) % 7 || 7;
    return new Date(base.getTime() + ahead * 86_400_000).toISOString().slice(0, 10);
  });
}

export function forecastFrom(p: Props, tz: string, now: Date): Forecast {
  const hourly: HourForecast[] = (p.hourlyForecastGroup?.hourlyForecasts ?? []).map((h) => ({
    hour: isoOnTheHour(new Date(h.timestamp), tz), tempC: Math.round(num(h.temperature?.value) ?? 0), precipProb: Math.round(num(h.lop?.value) ?? 0), precipType: precipOfCode(h.iconCode?.value),
  }));
  const fc = p.forecastGroup?.forecasts ?? [];
  const dates = periodDates(fc.map((f) => String(f.period?.textForecastName?.en ?? "")), localDate(now, tz));
  const byDate = new Map<string, DayForecast>();
  fc.forEach((f, i) => {
    const date = dates[i];
    if (!date) return;
    const type = precipOfCode(f.abbreviatedForecast?.icon?.value);
    // ECCC leaves the chance out of a period it does not rate; a rain or snow picture without one counts as likely.
    const prob = Math.round(num(f.abbreviatedForecast?.pop?.value) ?? (type === "none" ? 0 : 60));
    const prev = byDate.get(date);
    if (!prev || prob > prev.precipProb) byDate.set(date, { date, precipProb: prob, precipType: prob > 0 && type === "none" ? "rain" : type });
  });
  return {
    now: { tempC: Math.round(num(p.currentConditions?.temperature?.value) ?? hourly[0]?.tempC ?? 0), condition: conditionOfCode(p.currentConditions?.iconCode?.value) },
    hourly,
    daily7: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7),
  };
}

export class EcccProvider implements WeatherProvider {
  readonly name = "eccc" as const;
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async forecast(lat: number, lng: number, tz: string): Promise<Forecast> {
    // The city page nearest the place (the API's own ids differ from any list we hold): a small box around it.
    const d = 0.15;
    const r = await this.fetcher(`${API}?f=json&limit=10&bbox=${lng - d},${lat - d},${lng + d},${lat + d}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`ECCC ${r.status}`);
    const j = (await r.json()) as { features?: Array<{ geometry?: { coordinates?: [number, number] }; properties: Props }> };
    const near = (j.features ?? []).filter((f) => f.geometry?.coordinates)
      .sort((a, b) => ((a.geometry!.coordinates![0] - lng) ** 2 + (a.geometry!.coordinates![1] - lat) ** 2) - ((b.geometry!.coordinates![0] - lng) ** 2 + (b.geometry!.coordinates![1] - lat) ** 2))[0];
    if (!near) throw new Error("ECCC: no city page near this place");
    return forecastFrom(near.properties, tz, new Date());
  }
}
