// The weather call (GET /api/v1/weather/today) and the last answer kept on the phone, so Home can show it as "Updated 9:40 am" for up to 6 hours when there is no connection (WEATHER.md "States").
import { api } from "./api";
import { kvGet, kvSet } from "./kv";
import { STALE_MS, type WeatherToday } from "./weather";

const KEY = "weather:last";

export type Loaded = { data: WeatherToday; fromCache: boolean; savedAt: number };

async function remembered(): Promise<{ data: WeatherToday; savedAt: number } | null> {
  try {
    const raw = await kvGet(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { data?: WeatherToday; savedAt?: number };
    return v.data && typeof v.savedAt === "number" ? { data: v.data, savedAt: v.savedAt } : null;
  } catch { return null; }
}

/** The weather for today's sites: the server's answer (kept), or, when it cannot be reached, the kept one if it is under 6 hours old. Throws when there is neither. */
export async function loadWeather(language: "en" | "fr"): Promise<Loaded> {
  try {
    const data = await api<WeatherToday>(`/api/v1/weather/today?lang=${language}`);
    const savedAt = Date.now();
    void kvSet(KEY, JSON.stringify({ data, savedAt }));
    return { data, fromCache: false, savedAt };
  } catch (err) {
    const kept = await remembered();
    if (kept && Date.now() - kept.savedAt < STALE_MS) return { data: kept.data, fromCache: true, savedAt: kept.savedAt };
    throw err;
  }
}
