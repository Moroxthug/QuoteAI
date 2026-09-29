// Phase 122: how far the app follows the phone's text size (text-size.ts).
// Up to 2× — what every screen is checked at — and not below the smallest
// standard iOS size, so a stray value never makes the app unreadable.
const MAX_TEXT_ZOOM = 2;
const MIN_TEXT_ZOOM = 0.8;

export function clampTextZoom(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.round(Math.min(MAX_TEXT_ZOOM, Math.max(MIN_TEXT_ZOOM, value)) * 100) / 100;
}
