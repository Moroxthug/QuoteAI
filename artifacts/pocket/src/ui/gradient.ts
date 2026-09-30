// Turns the handoff's CSS gradients (tokens.ground.options[*].image) into expo-linear-gradient
// props, so the fades come straight from the tokens: "linear-gradient(0deg,#ece6f8 0,#f0edf9 220px,#f3f5f8 560px)".
// Stops in px are measured along the gradient line of a box `width` × `height`, as CSS does.

export type NativeGradient = {
  colors: [string, string, ...string[]];
  locations: [number, number, ...number[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

function splitTop(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export function parseLinearGradient(css: string, width: number, height: number): NativeGradient {
  const inner = css.trim().replace(/^linear-gradient\(/, "").replace(/\)$/, "");
  const [first, ...rest] = splitTop(inner);
  const deg = Number(first!.replace("deg", ""));
  const a = (deg * Math.PI) / 180;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  // CSS: 0deg points up, 90deg right; the line runs through the centre.
  const start = { x: 0.5 - sin / 2, y: 0.5 + cos / 2 };
  const end = { x: 0.5 + sin / 2, y: 0.5 - cos / 2 };
  const length = Math.abs(width * sin) + Math.abs(height * cos);
  const colors: string[] = [];
  const locations: number[] = [];
  for (const stop of rest) {
    const m = stop.match(/^(.*\))\s*(\S+)?$|^(\S+)\s*(\S+)?$/);
    const color = (m?.[1] ?? m?.[3] ?? stop).trim();
    const pos = (m?.[2] ?? m?.[4] ?? "").trim();
    colors.push(color);
    const at = pos.endsWith("%") ? Number(pos.slice(0, -1)) / 100 : pos.endsWith("px") ? Number(pos.slice(0, -2)) / length : pos === "0" ? 0 : NaN;
    locations.push(Math.min(1, Math.max(0, at)));
  }
  // Stops without a position spread evenly, as in CSS.
  locations.forEach((l, i) => {
    if (Number.isNaN(l)) locations[i] = i / Math.max(1, locations.length - 1);
  });
  return { colors: colors as NativeGradient["colors"], locations: locations as NativeGradient["locations"], start, end };
}
