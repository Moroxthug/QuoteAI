// Send feedback: the pure parts. What was drawn on the screenshot is kept as strokes of points in 0 to 1 (so it fits whatever size the picture is shown at), a note that could not go
// out waits in a short list on the phone, and the reference the server answers with is shown as it is.
export type Kind = "wrong" | "idea" | "question";
export const KINDS: Kind[] = ["wrong", "idea", "question"];
export type Point = [number, number];
export type Stroke = Point[];

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** A touch at (x, y) in a picture of this size as a point in 0 to 1. */
export const pointAt = (x: number, y: number, w: number, h: number): Point => (w > 0 && h > 0 ? [r3(clamp01(x / w)), r3(clamp01(y / h))] : [0, 0]);

/** The SVG path of a stroke drawn at this size (a single touch is a dot). */
export function pathOf(stroke: Stroke, w: number, h: number): string {
  if (stroke.length === 0) return "";
  const pts = stroke.length === 1 ? [stroke[0]!, [stroke[0]![0] + 0.001, stroke[0]![1]] as Point] : stroke;
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${(x * w).toFixed(1)} ${(y * h).toFixed(1)}`).join(" ");
}

/** What goes to the server: the strokes thinned to at most this many points each, and as many strokes as it takes. */
export function thin(strokes: Stroke[], maxPoints = 400): Stroke[] {
  return strokes.filter((s) => s.length > 0).map((s) => {
    if (s.length <= maxPoints) return s;
    const step = s.length / maxPoints;
    return Array.from({ length: maxPoints }, (_, i) => s[Math.floor(i * step)]!);
  });
}

export type Note = { kind: Kind; note: string; replyOk: boolean; includeLogs: boolean; screen: string; markup?: Stroke[]; at: string };
export const OUTBOX_KEY = "quoteai_feedback_outbox";
const MAX_WAITING = 5;

export function parseOutbox(raw: string | null): Note[] {
  try {
    const v = JSON.parse(raw ?? "[]") as unknown;
    return Array.isArray(v) ? (v as Note[]).filter((n) => n && typeof n.note === "string" && typeof n.kind === "string").slice(0, MAX_WAITING) : [];
  } catch { return []; }
}
/** The list with this note at the end (the oldest drops once five are waiting). */
export const queue = (list: Note[], n: Note): Note[] => [...list, n].slice(-MAX_WAITING);

/** "FB-1003" as the server wrote it. */
export const refLabel = (ref: string | null | undefined): string => (ref && /^FB-\d+$/.test(ref) ? ref : "");
