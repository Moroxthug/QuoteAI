// Where a company or a job is, to the city: the forecast sites of Environment and Climate Change Canada (a list of about 850 cities and towns with their coordinates) matched against an address.
// There is no geocoding service behind this: a job's address names its city, and the weather only needs the city. Coordinates found this way are saved on the job once (projects.latitude/longitude).

import { ECCC_SITES } from "./sites.js";

export type Site = { id: string; en: string; fr: string; lon: number; lat: number };

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


const MAIN: Record<string, string> = { BC: "Vancouver", AB: "Calgary", SK: "Regina", MB: "Winnipeg", ON: "Toronto", QC: "Montréal", NB: "Fredericton", NS: "Halifax", PE: "Charlottetown", NL: "St. John's", YT: "Whitehorse", NT: "Yellowknife", NU: "Iqaluit" };

/** A company with a province but no address (or an address no city is found in): the province's main city, so Home still has weather. */
export function provinceCity(province: string | null): Site | null {
  const p = (province ?? "").toUpperCase();
  const want = MAIN[p];
  if (!want) return null;
  const f = (s: string) => fold(s).replace(/[^a-z0-9]+/g, " ").trim();
  return SITES.find((s) => s.prov === p && f(s.en.split(" (")[0]!) === f(want)) ?? SITES.find((s) => s.prov === p) ?? null;
}

export { timeZoneForProvince as zoneOf } from "../jobs/dates.js";
