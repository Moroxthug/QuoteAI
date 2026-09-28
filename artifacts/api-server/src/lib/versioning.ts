import type { Request, Response } from "express";

// Phase 117 (docs/APP-PLAN.md "Sync II"): conflicts, honestly handled.
//
// An edit may say which version of the row it was made against:
// `X-Base-Version: <the row's updatedAt as the app last saw it>`. When the
// row has been changed since (another device, the office, a crew link), the
// edit is not applied: the answer is 409 `STALE` with the row as it is now,
// in the same shape the route's GET returns. The app then merges field by
// field — sends its edit again on the new version when the two changes
// touched different fields, and asks the person only when they collide.
// Edits without the header behave as before (last write wins).

const BASE_VERSION_HEADER = "x-base-version";

/** Timestamps are compared to the millisecond: what the API hands out and what Postgres keeps (µs) agree there. */
function sameVersion(base: string, current: Date): boolean {
  const t = Date.parse(base);
  return Number.isNaN(t) || t === current.getTime();
}

/**
 * True when the edit was made against an older version — the 409 has then
 * been sent and the route must stop. `current` builds the row as the route's
 * GET shows it (only called when stale).
 */
export function rejectStale<P>(req: Request<P>, res: Response, updatedAt: Date, current: () => unknown): boolean {
  const header = req.headers[BASE_VERSION_HEADER];
  const base = Array.isArray(header) ? header[0] : header;
  if (!base || sameVersion(base, updatedAt)) return false;
  res.status(409).json({
    error: "STALE",
    code: "STALE",
    message: "This was changed on another device since you opened it.",
    updatedAt: updatedAt.toISOString(),
    current: current(),
  });
  return true;
}
