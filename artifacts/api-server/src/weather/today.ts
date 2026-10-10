import { and, asc, eq, gt, isNotNull, lt } from "drizzle-orm";
import { db, businessProfilesTable, projectsTable, scheduleBlocksTable } from "@workspace/db";
import { siteFor, zoneOf, type Site } from "./geo.js";
import { attributionOf, forecastCached, getProvider } from "./provider.js";
import { localDate, summarize } from "./summary.js";
import { addDays, zonedIso } from "./time.js";
import type { SiteWeather, WeatherProvider, WeatherToday } from "./types.js";

// GET /api/v1/weather/today (docs/pocket-design/handoff/WEATHER.md "Backend contract"). Weather is for JOB SITES, never the phone's position:
//  1. the sites with a visit today, the busiest (most crew) first, up to 4; the first is the primary one (the header and the collapsed widget);
//  2. nothing scheduled today: the company address (a new account has no sites yet).
// A site's coordinates are saved on the job the first time they are needed (from its address's city) and never looked up again.

const MAX_SITES = 4;

type Candidate = { projectId: string; name: string; crew: Set<string>; blocks: number; firstStart: number; lat: number | null; lng: number | null; address: string; province: string | null };

export type TodayInput = {
  userId: string;
  lang: "en" | "fr";
  provider?: WeatherProvider;
};

export async function weatherToday({ userId, lang, provider = getProvider() }: TodayInput): Promise<WeatherToday> {
  const [profile] = await db.select({ address: businessProfilesTable.address, province: businessProfilesTable.province, companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  const tz = zoneOf(profile?.province ?? null);
  const now = provider.now?.(tz) ?? new Date();
  const today = localDate(now, tz);
  const dayStart = new Date(zonedIso(today, 0, tz));
  const dayEnd = new Date(zonedIso(addDays(today, 1), 0, tz));
  const weekEnd = new Date(zonedIso(addDays(today, 7), 0, tz));

  // Everything on the board in the next seven days: today's sites, and how many visits each day has (This week).
  const rows = await db
    .select({
      projectId: scheduleBlocksTable.projectId, collaboratorId: scheduleBlocksTable.collaboratorId, startsAt: scheduleBlocksTable.startsAt, endsAt: scheduleBlocksTable.endsAt,
      name: projectsTable.name, address: projectsTable.address, province: projectsTable.province, lat: projectsTable.latitude, lng: projectsTable.longitude,
    })
    .from(scheduleBlocksTable)
    .innerJoin(projectsTable, eq(projectsTable.id, scheduleBlocksTable.projectId))
    .where(and(eq(scheduleBlocksTable.userId, userId), isNotNull(scheduleBlocksTable.projectId), lt(scheduleBlocksTable.startsAt, weekEnd), gt(scheduleBlocksTable.endsAt, dayStart)))
    .orderBy(asc(scheduleBlocksTable.startsAt));

  const visits = new Map<string, number>();
  const sites = new Map<string, Candidate>();
  for (const r of rows) {
    const day = localDate(r.startsAt, tz);
    visits.set(day, (visits.get(day) ?? 0) + 1);
    if (r.startsAt < dayEnd && r.endsAt > dayStart && r.projectId) {
      const c = sites.get(r.projectId) ?? { projectId: r.projectId, name: r.name, crew: new Set<string>(), blocks: 0, firstStart: r.startsAt.getTime(), lat: r.lat == null ? null : Number(r.lat), lng: r.lng == null ? null : Number(r.lng), address: r.address, province: r.province ?? profile?.province ?? null };
      c.blocks += 1;
      if (r.collaboratorId) c.crew.add(r.collaboratorId);
      sites.set(r.projectId, c);
    }
  }

  // The busiest first (most crew; with nobody assigned, the earliest visit).
  const ordered = [...sites.values()].sort((a, b) => b.crew.size - a.crew.size || a.firstStart - b.firstStart);
  const places: { siteId: string; name: string; area: string; crew: number; lat: number; lng: number; isCompany?: boolean }[] = [];
  const cityName = (s: Site) => (lang === "fr" ? s.fr : s.en).split(" (")[0]!;
  for (const c of ordered) {
    if (places.length >= MAX_SITES) break;
    let { lat, lng } = c;
    let city: Site | null = null;
    if (lat == null || lng == null) {
      city = await siteFor(c.address, c.province).catch(() => null);
      if (!city) continue;
      lat = city.lat; lng = city.lon;
      await db.update(projectsTable).set({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) }).where(and(eq(projectsTable.id, c.projectId), eq(projectsTable.userId, userId))).catch(() => undefined);
    } else {
      city = await siteFor(c.address, c.province).catch(() => null);
    }
    places.push({ siteId: c.projectId, name: c.name, area: city ? cityName(city) : "", crew: c.crew.size, lat, lng });
  }
  if (places.length === 0) {
    const city = await siteFor(profile?.address ?? null, profile?.province ?? null).catch(() => null);
    if (city) places.push({ siteId: "company", name: cityName(city), area: cityName(city), crew: 0, lat: city.lat, lng: city.lon, isCompany: true });
  }

  const out: SiteWeather[] = [];
  for (const p of places) {
    const f = await forecastCached(provider, p.lat, p.lng, tz).catch(() => null);
    if (!f) continue;
    const s = summarize(f, now, tz);
    out.push({
      siteId: p.siteId, name: p.name, area: p.area, crewCount: p.crew, ...(p.isCompany ? { isCompany: true } : {}),
      now: f.now, hourly: f.hourly.filter((h) => Date.parse(h.hour) >= dayStart.getTime() && Date.parse(h.hour) < dayEnd.getTime() + 24 * 3_600_000),
      daily7: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(today, i);
        const d = f.daily7.find((x) => x.date === date);
        return { date, precipProb: d?.precipProb ?? 0, precipType: d?.precipType ?? "none", visits: visits.get(date) ?? 0 };
      }),
      ...s,
    });
  }
  if (places.length > 0 && out.length === 0) throw new Error("The weather source did not answer");

  return { fetchedAt: new Date().toISOString(), primarySiteId: out[0]?.siteId ?? null, sites: out, provider: provider.name, attribution: await attributionOf(provider) };
}
