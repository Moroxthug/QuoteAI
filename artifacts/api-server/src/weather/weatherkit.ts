import { createSign } from "node:crypto";
import type { Attribution, Condition, DayForecast, Forecast, HourForecast, PrecipType, WeatherProvider } from "./types.js";
import { isoOnTheHour } from "./time.js";
import { localDate } from "./summary.js";

// Apple WeatherKit REST API (https://developer.apple.com/documentation/weatherkitrestapi), called from this server so the iPhone and the Android app are served alike. 500,000 calls a month are
// included with the Apple Developer Program. Needs four values (docs/RUNBOOKS.md): WEATHERKIT_TEAM_ID, WEATHERKIT_SERVICE_ID (the Services ID), WEATHERKIT_KEY_ID and WEATHERKIT_PRIVATE_KEY (the .p8 file's text).
// Attribution is required wherever Apple weather is shown: the mark and a link to the legal page (see `attribution()`).

const BASE = "https://weatherkit.apple.com/api/v1";
export const LEGAL_URL = "https://weatherkit.apple.com/legal-attribution.html";

export type WeatherKitConfig = { teamId: string; serviceId: string; keyId: string; privateKey: string };

/** The weather settings, read by name so the environment inventory finds them. */
export const weatherEnv = (): NodeJS.ProcessEnv => ({
  WEATHER_PROVIDER: process.env.WEATHER_PROVIDER, WEATHERKIT_TEAM_ID: process.env.WEATHERKIT_TEAM_ID, WEATHERKIT_SERVICE_ID: process.env.WEATHERKIT_SERVICE_ID,
  WEATHERKIT_KEY_ID: process.env.WEATHERKIT_KEY_ID, WEATHERKIT_PRIVATE_KEY: process.env.WEATHERKIT_PRIVATE_KEY,
});

export function weatherKitConfigFromEnv(env: NodeJS.ProcessEnv = weatherEnv()): WeatherKitConfig | null {
  const { WEATHERKIT_TEAM_ID: teamId, WEATHERKIT_SERVICE_ID: serviceId, WEATHERKIT_KEY_ID: keyId, WEATHERKIT_PRIVATE_KEY: key } = env;
  if (!teamId || !serviceId || !keyId || !key) return null;
  return { teamId, serviceId, keyId, privateKey: key.replace(/\\n/g, "\n") };
}

const b64url = (b: Buffer | string): string => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** The signed token WeatherKit asks for: ES256, valid for an hour. */
export function weatherKitToken(cfg: WeatherKitConfig, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = { alg: "ES256", kid: cfg.keyId, id: `${cfg.teamId}.${cfg.serviceId}` };
  const payload = { iss: cfg.teamId, iat: nowSec, exp: nowSec + 3600, sub: cfg.serviceId };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = createSign("SHA256").update(data).sign({ key: cfg.privateKey, dsaEncoding: "ieee-p1363" });
  return `${data}.${b64url(sig)}`;
}

/** WeatherKit's condition codes → the nine we draw. */
export function conditionOf(code: string | undefined): Condition {
  const c = (code ?? "").toLowerCase();
  if (/thunder|tornado|hurricane|tropicalstorm/.test(c)) return "thunder";
  if (/freezingrain|sleet|wintrymix|mixedrainandsleet|mixedsnowandsleet|mixedrainandsnow|hail/.test(c)) return "sleet";
  if (/snow|flurries|blizzard|frigid/.test(c)) return /frigid/.test(c) ? "clear" : "snow";
  if (/showers|sunshowers/.test(c)) return "showers";
  if (/rain|drizzle/.test(c)) return "rain";
  if (/fog|haze|smoke|dust/.test(c)) return "fog";
  if (/partlycloudy|mostlyclear/.test(c)) return "partly_cloudy";
  if (/cloudy/.test(c)) return "cloudy";
  if (/clear|hot|breezy|windy/.test(c)) return "clear";
  return "cloudy";
}

export function precipTypeOf(t: string | undefined): PrecipType {
  switch ((t ?? "").toLowerCase()) {
    case "rain": case "hail": return "rain";
    case "snow": return "snow";
    case "sleet": case "mixed": return "sleet";
    case "precipitation": return "rain";
    default: return "none";
  }
}

type Hour = { forecastStart: string; temperature: number; precipitationChance: number; precipitationType?: string };
type Day = { forecastStart: string; precipitationChance: number; precipitationType?: string };
type Reply = { currentWeather?: { temperature: number; conditionCode?: string }; forecastHourly?: { hours?: Hour[] }; forecastDaily?: { days?: Day[] } };

/** WeatherKit's reply as our Forecast: hours on the hour in the company's zone, probabilities in percent, up to 7 days by local date. */
export function forecastFrom(r: Reply, tz: string): Forecast {
  const hourly: HourForecast[] = (r.forecastHourly?.hours ?? []).slice(0, 48).map((h) => ({
    hour: isoOnTheHour(new Date(h.forecastStart), tz), tempC: Math.round(h.temperature), precipProb: Math.round((h.precipitationChance ?? 0) * 100), precipType: precipTypeOf(h.precipitationType),
  }));
  const daily7: DayForecast[] = (r.forecastDaily?.days ?? []).slice(0, 7).map((d) => ({
    date: localDate(new Date(d.forecastStart), tz), precipProb: Math.round((d.precipitationChance ?? 0) * 100), precipType: precipTypeOf(d.precipitationType),
  }));
  return { now: { tempC: Math.round(r.currentWeather?.temperature ?? hourly[0]?.tempC ?? 0), condition: conditionOf(r.currentWeather?.conditionCode) }, hourly, daily7 };
}

export class WeatherKitProvider implements WeatherProvider {
  readonly name = "weatherkit" as const;
  constructor(private readonly cfg: WeatherKitConfig, private readonly fetcher: typeof fetch = fetch) {}

  async forecast(lat: number, lng: number, tz: string): Promise<Forecast> {
    const url = `${BASE}/weather/en/${lat.toFixed(4)}/${lng.toFixed(4)}?dataSets=currentWeather,forecastHourly,forecastDaily&timezone=${encodeURIComponent(tz)}&countryCode=CA`;
    const r = await this.fetcher(url, { headers: { authorization: `Bearer ${weatherKitToken(this.cfg)}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`WeatherKit ${r.status}`);
    return forecastFrom((await r.json()) as Reply, tz);
  }

  /** The Apple Weather mark and the legal link, from WeatherKit's own attribution service (kept a day). */
  async attribution(): Promise<Attribution> {
    const fallback: Attribution = { name: "Weather", legalUrl: LEGAL_URL };
    if (cached && Date.now() - cached.at < 86_400_000) return cached.value;
    try {
      const r = await this.fetcher(`${BASE}/attribution/en`, { headers: { authorization: `Bearer ${weatherKitToken(this.cfg)}` }, signal: AbortSignal.timeout(5000) });
      if (!r.ok) return fallback;
      const j = (await r.json()) as { serviceName?: string; logoLight?: string; logoDark?: string; legalPageURL?: string };
      const value: Attribution = { name: j.serviceName ?? "Weather", legalUrl: j.legalPageURL ?? LEGAL_URL, logoLightUrl: j.logoLight, logoDarkUrl: j.logoDark };
      cached = { at: Date.now(), value };
      return value;
    } catch { return fallback; }
  }
}
let cached: { at: number; value: Attribution } | null = null;
