// Pocket (Phase 149): Settings → Display → Text size (the canvas's A · A · A), kept on this device.
// In the app it multiplies the phone's own text size (Phase 122's text zoom, still capped at 2×);
// in a browser it zooms the page.
import { isNativeApp } from "@/lib/native/env";

export type TextScale = "small" | "default" | "large";
const KEY = "quoteai.textScale";
const FACTOR: Record<TextScale, number> = { small: 0.9, default: 1, large: 1.15 };

export function readTextScale(): TextScale {
  try {
    const v = localStorage.getItem(KEY);
    return v === "small" || v === "large" ? v : "default";
  } catch {
    return "default";
  }
}

export function textScaleFactor(): number {
  return FACTOR[readTextScale()];
}

export function applyTextScale(next?: TextScale): void {
  if (next) {
    try {
      if (next === "default") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch { /* private mode: this session only */ }
  }
  const f = FACTOR[next ?? readTextScale()];
  if (isNativeApp) {
    void import("@/lib/native/text-size").then((m) => m.reapplyTextSize()).catch(() => {});
    return;
  }
  document.body.style.zoom = f === 1 ? "" : String(f);
}
