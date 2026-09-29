// Pocket (docs/POCKET-DESIGN-PLAN.md, Phase 145) — the weather line on the phone's Home
// ("12°, rain after 3 pm"): Environment and Climate Change Canada's city-page forecasts
// (MSC GeoMet OGC API, api.weather.gc.ca — Open Government Licence, free for commercial
// use, bilingual). The company's forecast site is found from its address (a site whose
// name is in it, in its province), else from the phone's position when it sends one.

import { ECCC_SITES } from "./sites.js";

const API = "https://api.weather.gc.ca/collections/citypageweather-realtime/items";
const WX_TTL = 30 * 60_000;

export type WeatherKind = "clear" | "cloud" | "rain" | "snow" | "storm" | "fog";
export type TodayWeather = {
  site: string;
  tempC: number | null;
  kind: WeatherKind;
  /** ECCC's own words for now, both languages ("Mostly Cloudy" / "Généralement nuageux"). */
  condition: { en: string; fr: string };
  /** The first wet (or white) hour still to come today, if any. */
  next: { kind: "rain" | "snow" | "storm"; at: string } | null;
};

type Site = { id: string; en: string; fr: string; lon: number; lat: number };
type Bi = { en?: string | number; fr?: string | number };
type Feature = { geometry?: { coordinates?: [number, number] }; properties: Record<string, unknown> };

/** ECCC icon codes → the six looks the header draws. https://eccc-msc.github.io/open-data/msc-data/citypage-weather/ */
export function kindOf(code: number | null | undefined): WeatherKind {
  if (code == null) return "cloud";
  if ([0, 1, 30, 31].includes(code)) return "clear";
  if ([9, 19, 39].includes(code)) return "storm";
  if ([6, 11, 12, 13, 28, 36].includes(code)) return "rain";
  if ([7, 8, 14, 15, 16, 17, 18, 25, 26, 27, 37, 38, 40].includes(code)) return "snow";
  if ([23, 24, 44, 45].includes(code)) return "fog";
  return "cloud";
}

const cache = new Map<string, { at: number; wx: TodayWeather | null }>();

async function getJson(url: string): Promise<{ features?: Feature[] }> {
  const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`ECCC ${r.status}`);
  return (await r.json()) as { features?: Feature[] };
}

const SITES: Array<Site & { prov: string }> = ECCC_SITES.map(([prov, en, lat, lon, fr], i) => ({ id: String(i), prov, en, fr: fr ?? en, lat, lon }));

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The forecast site for a company: a site named in its address (the longest match, in its province), else the nearest to a position. */
export async function siteFor(address: string | null, province: string | null, pos?: { lat: number; lon: number }): Promise<Site | null> {
  const list = SITES;
  const prov = (province ?? "").toUpperCase();
  if (address) {
    const text = ` ${fold(address).replace(/[^a-z0-9]+/g, " ")} `;
    // The city comes after the street ("1200 rue Sainte-Catherine, Montréal"): the match furthest
    // along wins, then the longest. "Ottawa (Kanata - Orléans)" also answers to "Ottawa".
    let best: Site | null = null, bestAt = -1, bestLen = 0;
    for (const s of list) {
      if (prov && s.prov !== prov) continue;
      for (const name of new Set([s.en, s.fr, s.en.split(" (")[0]!, s.fr.split(" (")[0]!])) {
        const n = fold(name).replace(/[^a-z0-9]+/g, " ").trim();
        if (n.length < 3) continue;
        const at = text.lastIndexOf(` ${n} `);
        if (at >= 0 && (at + n.length > bestAt + bestLen || (at + n.length === bestAt + bestLen && n.length > bestLen))) { best = s; bestAt = at; bestLen = n.length; }
      }
    }
    if (best) return best;
  }
  if (pos) {
    let best: Site | null = null, d = Infinity;
    for (const s of list) {
      const dd = (s.lat - pos.lat) ** 2 + ((s.lon - pos.lon) * Math.cos((pos.lat * Math.PI) / 180)) ** 2;
      if (dd < d) { d = dd; best = s; }
    }
    return best;
  }
  return null;
}

const num = (b: Bi | undefined): number | null => (b && typeof b.en === "number" ? b.en : b && b.en != null && !Number.isNaN(Number(b.en)) ? Number(b.en) : null);

/** Today's weather at a site, cached for half an hour. `zone`: the company's time zone (the end of "today"). */
export async function weatherAt(site: Site, zone: string): Promise<TodayWeather | null> {
  const key = `${site.lat},${site.lon}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < WX_TTL) return hit.wx;
  // The city page nearest the site (the API's own ids differ from the site list's): a small box around it.
  const d = 0.15;
  const j = await getJson(`${API}?f=json&limit=10&bbox=${site.lon - d},${site.lat - d},${site.lon + d},${site.lat + d}`).catch(() => null);
  const near = (j?.features ?? []).map((f) => ({ f, c: f.geometry?.coordinates })).filter((x) => x.c)
    .sort((a, b) => ((a.c![0] - site.lon) ** 2 + (a.c![1] - site.lat) ** 2) - ((b.c![0] - site.lon) ** 2 + (b.c![1] - site.lat) ** 2))[0]?.f;
  const p = (near?.properties ?? null) as null | {
    currentConditions?: { temperature?: { value?: Bi }; condition?: Bi; iconCode?: { value?: number } };
    hourlyForecastGroup?: { hourlyForecasts?: Array<{ timestamp: string; iconCode?: { value?: number }; lop?: { value?: Bi } }> };
  };
  if (!p) { cache.set(key, { at: Date.now(), wx: null }); return null; }
  const cc = p.currentConditions ?? {};
  const nowKind = kindOf(cc.iconCode?.value);
  const endOfDay = new Date(new Date().toLocaleString("en-US", { timeZone: zone }));
  endOfDay.setHours(23, 59, 59, 999);
  const offset = new Date().getTime() - new Date(new Date().toLocaleString("en-US", { timeZone: zone })).getTime();
  const end = endOfDay.getTime() + offset;
  let next: TodayWeather["next"] = null;
  if (nowKind !== "rain" && nowKind !== "snow" && nowKind !== "storm") {
    for (const h of p.hourlyForecastGroup?.hourlyForecasts ?? []) {
      const at = Date.parse(h.timestamp);
      if (!(at > Date.now()) || at > end) continue;
      const k = kindOf(h.iconCode?.value);
      if (k === "rain" || k === "snow" || k === "storm") { next = { kind: k, at: h.timestamp }; break; }
    }
  }
  const wx: TodayWeather = {
    site: site.en,
    tempC: num(cc.temperature?.value),
    kind: nowKind,
    condition: { en: String(cc.condition?.en ?? ""), fr: String(cc.condition?.fr ?? "") },
    next,
  };
  cache.set(key, { at: Date.now(), wx });
  return wx;
}

export { timeZoneForProvince as zoneOf } from "../jobs/dates.js";
