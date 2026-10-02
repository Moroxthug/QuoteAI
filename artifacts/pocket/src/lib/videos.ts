// The short videos: which there are, how long, and which have a player (Your first quote and quoteAI in 60 seconds are the two the design draws; the rest read Coming soon).
export type VideoId = "quotes" | "overview" | "jobs" | "crew" | "etransfer" | "qbo";
export type VideoDef = { id: VideoId; secs: number; icon: "mic" | "orb" | "cone" | "users" | "bank" | "link"; tone: "violet" | "indigo" | "amber" | "azure" | "sage" | "teal"; playable: boolean };

export const VIDEOS: VideoDef[] = [
  { id: "quotes", secs: 72, icon: "mic", tone: "violet", playable: true },
  { id: "overview", secs: 60, icon: "orb", tone: "indigo", playable: true },
  { id: "jobs", secs: 94, icon: "cone", tone: "amber", playable: false },
  { id: "crew", secs: 58, icon: "users", tone: "azure", playable: false },
  { id: "etransfer", secs: 65, icon: "bank", tone: "sage", playable: false },
  { id: "qbo", secs: 80, icon: "link", tone: "teal", playable: false },
];

/** 72 seconds as "1:12". */
export function clock(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export type Chapter = { at: number; title: string; caption: string };

/** The chapter playing at a position (the last one that has begun). */
export function chapterAt(chapters: Chapter[], pos: number): number {
  let i = 0;
  chapters.forEach((c, k) => { if (pos >= c.at) i = k; });
  return i;
}

/** How full each chapter's segment of the scrub bar is, 0 to 1. */
export function segmentFill(chapters: Chapter[], total: number, pos: number): number[] {
  return chapters.map((c, i) => {
    const a = c.at;
    const b = i + 1 < chapters.length ? chapters[i + 1]!.at : total;
    return pos >= b ? 1 : pos <= a ? 0 : (pos - a) / (b - a);
  });
}

/** The knob's distance across a bar of this width (gaps of 3 between the segments). */
export function knobX(chapters: Chapter[], total: number, pos: number, width: number, gap = 3): number {
  const w = (width - gap * (chapters.length - 1)) / chapters.length;
  let x = 0;
  chapters.forEach((c, i) => {
    const a = c.at;
    const b = i + 1 < chapters.length ? chapters[i + 1]!.at : total;
    if (pos >= b) x += w + gap;
    else if (pos > a) x += (w * (pos - a)) / (b - a);
  });
  return x;
}

export const SPEEDS = [1, 1.25, 1.5, 2] as const;
export const clampPos = (p: number, total: number): number => Math.max(0, Math.min(total, p));
