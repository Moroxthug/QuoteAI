// Phase 120: the decisions behind the app's motion, kept apart from the DOM
// so they can be tested (motion.test.ts). The numbers are docs/APP-DESIGN.md §4.

export type NavKind = "push" | "pop" | "tab" | "none";

const pathOf = (url: string): string => url.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";

/**
 * How moving from `from` to `to` looks. A tab-bar tap says "tab" itself
 * (`marked`); a new query on the same screen (a job's tab, a filter, a
 * `?new=1` sheet) is not a new screen; anything outside the signed-in app
 * (sign-in, a crew link's first load) is not animated.
 */
export function navKind(from: string, to: string, marked: NavKind | null): NavKind {
  if (marked) return marked;
  const a = pathOf(from);
  const b = pathOf(to);
  if (a === b) return "none";
  const inApp = (p: string) => p === "/dashboard" || p.startsWith("/dashboard/") || p.startsWith("/t/");
  if (!inApp(a) || !inApp(b)) return "none";
  return "push";
}

/** A flick: fast enough that the finger meant it, however short the distance. */
const FLICK_PX_PER_MS = 0.5;

/** A sheet dragged down closes past 30 % of its height, or on a downward flick. */
export function sheetCloses(dy: number, height: number, velocity: number): boolean {
  if (dy <= 0) return false;
  return dy > height * 0.3 || velocity > FLICK_PX_PER_MS;
}

/** The iOS edge swipe goes back past 40 % of the width, or on a flick to the right; otherwise it springs home. */
export function edgeGoesBack(dx: number, width: number, velocity: number): boolean {
  if (dx <= 0) return false;
  return dx > width * 0.4 || (velocity > FLICK_PX_PER_MS && dx > 24);
}

/** A swiped row commits past 40 % of its width (at most 140 px), or on a flick. */
export function rowCommits(dx: number, width: number, velocity: number): boolean {
  if (dx <= 0) return false;
  return dx > Math.min(140, width * 0.4) || (velocity > FLICK_PX_PER_MS && dx > 48);
}

/** Drag resistance past a limit: the element keeps following, more and more slowly. */
export function rubberBand(d: number, limit: number): number {
  if (d <= limit) return d;
  return limit + (d - limit) * 0.35;
}

/** Speed of a drag over its last ~80 ms, in px/ms (positive = along the axis). */
export function velocityTracker() {
  let samples: Array<{ v: number; t: number }> = [];
  return {
    add(v: number, t: number = performance.now()) {
      samples.push({ v, t });
      samples = samples.filter((s) => t - s.t <= 80);
    },
    speed(): number {
      if (samples.length < 2) return 0;
      const a = samples[0]!;
      const b = samples[samples.length - 1]!;
      return b.t > a.t ? (b.v - a.v) / (b.t - a.t) : 0;
    },
    reset() {
      samples = [];
    },
  };
}
