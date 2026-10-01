// CrewMap: who is sharing where, drawn on the board's abstract map (no map tiles: roads, blocks and avatars). Positions are fitted to the map box, keeping the true shape
// (east-west shrinks with latitude). Pure, so the fitting is tested (crewMap.test.ts).
import type { CrewLine } from "./foreman";

export type LocationRow = { workerId: string; name: string; role: string | null; projectId: string | null; projectName: string | null; lat: number; lng: number; updatedAt: string };
export type LocationsView = { enabled: false; requiredPlan?: string } | { enabled: true; items: LocationRow[] };

export type MapKind = "site" | "off";
export type MapPerson = { workerId: string; name: string; kind: MapKind; sub: string; lat: number | null; lng: number | null; updatedAt: string | null };

/** Everyone booked today or sharing now: sharing = "site" (on the clock, location on), the rest = "off". */
export function mapPeople(locations: LocationRow[], lines: CrewLine[]): MapPerson[] {
  const out = new Map<string, MapPerson>();
  for (const l of locations) out.set(l.workerId, { workerId: l.workerId, name: l.name, kind: "site", sub: l.projectName ?? "", lat: l.lat, lng: l.lng, updatedAt: l.updatedAt });
  for (const l of lines) if (!out.has(l.workerId)) out.set(l.workerId, { workerId: l.workerId, name: l.name, kind: "off", sub: l.jobName ?? "", lat: null, lng: null, updatedAt: null });
  return [...out.values()].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "site" ? -1 : 1));
}

/** Fits points into a box of `w` by `h` with `pad` around: the shape is kept; one point, or points on top of each other, go to the middle. */
export function fitPoints(points: { lat: number; lng: number }[], w: number, h: number, pad: number): { x: number; y: number }[] {
  if (points.length === 0) return [];
  const lats = points.map((p) => p.lat);
  const k = Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180);
  const xs = points.map((p) => p.lng * k);
  const ys = points.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX, spanY = maxY - minY;
  const bw = Math.max(1, w - 2 * pad), bh = Math.max(1, h - 2 * pad);
  // A span smaller than ~30 m is the same place.
  const tiny = 0.0003;
  const scale = spanX < tiny && spanY < tiny ? 0 : Math.min(spanX > tiny ? bw / spanX : Infinity, spanY > tiny ? bh / spanY : Infinity);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return points.map((_, i) => ({ x: Math.round(w / 2 + (xs[i]! - cx) * scale), y: Math.round(h / 2 + (ys[i]! - cy) * scale) }));
}

export function counts(people: MapPerson[]): { all: number; site: number; off: number } {
  return { all: people.length, site: people.filter((p) => p.kind === "site").length, off: people.filter((p) => p.kind === "off").length };
}
