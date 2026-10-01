// The Schedule screen's logic (Schedule.dc.html): a week of blocks, grouped by person or by job; each lane has a track from 7:00 to 18:00 with its
// blocks drawn on it, clashes in red, and "Free" windows of two hours or more between 7:30 and 16:00. Hours are the phone's local hours. Pure, so it
// is tested without a screen.
import type { SchedBlock } from "./jobsApi.ts";

export const TRACK_FROM = 7;
export const TRACK_TO = 18;
/** A day's working window, for the free gaps and for an all-day block. */
export const DAY_FROM = 7.5;
export const DAY_TO = 16;
export const FREE_MIN_HOURS = 2;

export type Piece = { block: SchedBlock; from: number; to: number };

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const hourOf = (t: number, base: number) => (t - base) / 3_600_000;

/** Monday of the week `d` falls in, at noon. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export const weekDays = (start: Date): Date[] => Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12));

export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The parts of the blocks that fall on `day`, in local hours (an all-day block is the working window). */
export function piecesOn(blocks: SchedBlock[], day: Date): Piece[] {
  const base = dayStart(day);
  return blocks.flatMap((block): Piece[] => {
    const from = Math.max(0, hourOf(+new Date(block.startsAt), base));
    const to = Math.min(24, hourOf(+new Date(block.endsAt), base));
    if (to <= 0 || from >= 24 || to <= from) return [];
    return [block.allDay ? { block, from: DAY_FROM, to: DAY_TO } : { block, from, to }];
  }).sort((a, b) => a.from - b.from || a.to - b.to);
}

/** The hours two pieces share (0 when they don't overlap). */
export const overlap = (a: Piece, b: Piece): number => Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from));

/** The piece it clashes with: the same person on another block at the same time. */
export function clashOf(p: Piece, all: Piece[]): Piece | null {
  if (!p.block.collaboratorId) return null;
  return all.find((o) => o.block.id !== p.block.id && o.block.collaboratorId === p.block.collaboratorId && overlap(p, o) > 0) ?? null;
}

export const trackPct = (h: number): number => Math.max(0, Math.min(100, ((h - TRACK_FROM) / (TRACK_TO - TRACK_FROM)) * 100));

/** "7:30" style, hours as a decimal in. */
export function hhmm(h: number): string {
  const whole = Math.floor(h + 1e-9);
  const m = Math.round((h - whole) * 60);
  return m === 60 ? `${whole + 1}:00` : `${whole}:${m < 10 ? "0" : ""}${m}`;
}

export const hoursOf = (ps: Piece[]): number => ps.reduce((n, p) => n + (p.to - p.from), 0);

export type Lane = { key: string; kind: "person" | "job"; id: string | null; title: string; pieces: Piece[]; free: [number, number][] };

/** Free windows of two hours or more, from 7:30 to 16:00 around what is booked. */
export function freeWindows(pieces: Piece[]): [number, number][] {
  const out: [number, number][] = [];
  let cur = DAY_FROM;
  for (const p of [...pieces].sort((a, b) => a.from - b.from)) {
    if (p.from - cur >= FREE_MIN_HOURS) out.push([cur, p.from]);
    cur = Math.max(cur, p.to);
  }
  if (DAY_TO - cur >= FREE_MIN_HOURS) out.push([cur, DAY_TO]);
  return out;
}

export function lanes(blocks: SchedBlock[], day: Date, by: "person" | "job", people: { id: string; name: string }[], jobs: { id: string; name: string }[], withFree: boolean): Lane[] {
  const ps = piecesOn(blocks, day);
  if (by === "person") {
    const known = people.map((p) => ({ id: p.id as string | null, title: p.name }));
    const strays = [...new Map(ps.filter((p) => !p.block.collaboratorId).map((p) => [p.block.id, p])).values()].length ? [{ id: null as string | null, title: "" }] : [];
    return [...known, ...strays].map((w): Lane => {
      const mine = ps.filter((p) => p.block.collaboratorId === w.id);
      return { key: w.id ?? "none", kind: "person", id: w.id, title: w.title, pieces: mine, free: withFree && w.id ? freeWindows(mine) : [] };
    });
  }
  const known = jobs.map((j) => ({ id: j.id as string | null, title: j.name }));
  const loose = ps.some((p) => !p.block.projectId) ? [{ id: null as string | null, title: "" }] : [];
  return [...known, ...loose].map((j): Lane => ({ key: j.id ?? "none", kind: "job", id: j.id, title: j.title, pieces: ps.filter((p) => p.block.projectId === j.id), free: [] })).filter((l) => l.pieces.length > 0);
}

/** Days of the week with a clash on them (the red dot under the day). */
export function clashDays(blocks: SchedBlock[], days: Date[]): boolean[] {
  return days.map((d) => { const ps = piecesOn(blocks, d); return ps.some((p) => clashOf(p, ps)); });
}

/** A block's start and end as ISO instants for `day` at the given local hours. */
export function instants(day: Date, from: number, to: number): { startsAt: string; endsAt: string } {
  const at = (h: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(h), Math.round((h - Math.floor(h)) * 60)).toISOString();
  return { startsAt: at(from), endsAt: at(to) };
}
