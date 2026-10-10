import { EcccProvider, ECCC_ATTRIBUTION } from "./eccc.js";
import { MockWeatherProvider } from "./mock.js";
import type { Attribution, Forecast, WeatherProvider } from "./types.js";
import { WeatherKitProvider, weatherEnv, weatherKitConfigFromEnv } from "./weatherkit.js";

// Which source answers. WEATHER_PROVIDER = mock | eccc | weatherkit picks one; unset, Apple WeatherKit is used when its four credentials are set, and Environment and Climate Change Canada otherwise
// (so a company in Canada has real weather before Apple's keys exist). The mock is only ever chosen by name (development and the screenshots).

export function getProvider(env: NodeJS.ProcessEnv = weatherEnv()): WeatherProvider {
  const want = (env.WEATHER_PROVIDER ?? "").toLowerCase();
  if (want === "mock") return new MockWeatherProvider();
  if (want === "eccc") return new EcccProvider();
  const cfg = weatherKitConfigFromEnv(env);
  if (cfg) return new WeatherKitProvider(cfg);
  return new EcccProvider();
}

/** The attribution to show next to this provider's weather, or null when the source asks for none. */
export async function attributionOf(p: WeatherProvider): Promise<Attribution | null> {
  if (p instanceof WeatherKitProvider) return p.attribution();
  if (p.name === "eccc") return ECCC_ATTRIBUTION;
  return null;
}

// ── Each place is asked for once every 30 minutes, however many people open Home. ──
const TTL = 30 * 60_000;
const STALE_OK = 6 * 3_600_000;
const cache = new Map<string, { at: number; value: Forecast }>();
const inflight = new Map<string, Promise<Forecast>>();

export function clearForecastCache(): void {
  cache.clear();
  inflight.clear();
}

export async function forecastCached(p: WeatherProvider, lat: number, lng: number, tz: string, nowMs = Date.now()): Promise<Forecast> {
  const key = `${p.name}:${tz}:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && nowMs - hit.at < TTL) return hit.value;
  let pending = inflight.get(key);
  if (!pending) {
    pending = p.forecast(lat, lng, tz).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  try {
    const value = await pending;
    cache.set(key, { at: nowMs, value });
    return value;
  } catch (err) {
    // The provider is down: an answer under six hours old is better than none.
    if (hit && nowMs - hit.at < STALE_OK) return hit.value;
    throw err;
  }
}
