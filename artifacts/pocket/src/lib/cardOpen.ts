// COMPONENTS §6b: a Home widget card opens full screen as a container transform. The geometry only: where the full-screen page starts (exactly over the card), how it moves to fill the screen,
// what a swipe down does to it, and when a release closes it. Pure, so it is tested without a screen. The numbers are the spec's and SmartHomeOpen.dc.html's (`zAnimate`, `zDrag`).
export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

export const OPEN_MS = 540;
export const CLOSE_MS = 440;
export const SPRING_MS = 420;
export const CLOSE_THRESHOLD = 110;
export const CARD_RADIUS = 22;
export const HOME_SCALE = 0.94;
export const HOME_RADIUS = 34;
/** The drag distance at which the page has shrunk as far as it will (.86) and the scrim has dimmed to 20 %. */
export const DRAG_FULL = 400;

/** What the page looks like at one moment: where its top-left corner is, how much it is scaled, how tall its clip is (in its own, unscaled pixels) and how round its corners are (also unscaled). */
export type Geom = { x: number; y: number; scale: number; height: number; radius: number };

/** The page's first frame: translated to the card's corner, scaled to the card's width, clipped to the card's height, with the card's corner radius. */
export function closedGeom(src: Rect, screen: Size): Geom {
  "worklet";
  const scale = src.w / screen.w;
  return { x: src.x, y: src.y, scale, height: src.h / scale, radius: CARD_RADIUS / scale };
}

export function openGeom(screen: Size): Geom {
  "worklet";
  return { x: 0, y: 0, scale: 1, height: screen.h, radius: 0 };
}

function lerp(a: number, b: number, t: number): number {
  "worklet";
  return a + (b - a) * t;
}

export function lerpGeom(a: Geom, b: Geom, t: number): Geom {
  "worklet";
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), scale: lerp(a.scale, b.scale, t), height: lerp(a.height, b.height, t), radius: lerp(a.radius, b.radius, t) };
}

/** The page while a finger drags it down by `dy` points: it follows at .85x, shrinks to .86 at 400, and its corners grow from 12. */
export function dragGeom(dy: number, screen: Size): Geom & { k: number; scrim: number; homeScale: number } {
  "worklet";
  const k = Math.min(Math.max(dy, 0), DRAG_FULL) / DRAG_FULL;
  const scale = 1 - k * 0.14;
  return { x: (screen.w * (1 - scale)) / 2, y: dy * 0.85, scale, height: screen.h, radius: Math.round(k * 120 + 12), k, scrim: 1 - k * 0.8, homeScale: HOME_SCALE + k * 0.04 };
}

/** A release past 110 points closes the page from where it is; under it, the page springs back. */
export function shouldClose(dy: number): boolean {
  "worklet";
  return dy > CLOSE_THRESHOLD;
}

/** The tab bar's slide as the page opens: gone (30 down, faded) by 70 % of the way. `open` is how far open the page is, 0 to 1. */
export function barSlide(open: number): { opacity: number; translateY: number } {
  "worklet";
  const t = Math.min(1, Math.max(0, open) / 0.7);
  return { opacity: 1 - t, translateY: 30 * t };
}

/** How much of the expanded content shows, from the clock (0 to 1 through the open): it starts at 35 % of the duration. */
export const bodyStart = (): number => 0.35;
