import type { QueryClient } from "@tanstack/react-query";
import { rawFetch } from "./raw-fetch";
import { affectsAny, type Change } from "./affects";
import { isForeground, onForegroundChange } from "@/lib/app-state";

// Phase 117 (docs/APP-PLAN.md "Sync II"): live on every device.
//
// While the signed-in app is on screen and online it keeps one long poll open
// on GET /api/changes (api-server/src/routes/changes.ts): the server answers
// the moment something in the company changes — a foreman ticks a task, a
// client accepts a quote, the office moves a date — and the app refetches
// exactly the answers that show that row (lib/sync/affects.ts). The echo of
// this device's own edits is skipped (the edit already refreshed them). In
// the background it stops; back on screen it asks for everything since its
// cursor, so nothing is missed while the phone was in a pocket. A feed that
// can't be reached backs off (30 s → 5 min); the app still refreshes lists on
// focus as before, so live updates are a bonus, never a dependency.

const WAIT_S = 25;
const OWN_ECHO_MS = 5_000;

/** Rows this device just changed (id → when), so their echo in the feed is not refetched twice. */
const ownWrites = new Map<string, number>();
export function noteOwnWrite(c: Change): void {
  const id = c.id ?? c.parentId;
  if (id) ownWrites.set(id, Date.now());
}
function isOwnEcho(c: Change, now: number): boolean {
  const at = c.id ? ownWrites.get(c.id) : undefined;
  return at !== undefined && now - at < OWN_ECHO_MS;
}

type Feed = { cursor: string; changes: Change[]; more?: boolean; reset?: boolean };

let stopCurrent: (() => void) | null = null;

/** Starts the feed for the signed-in app; returns a stop function (sign-out, unmount). Idempotent. */
export function startLiveUpdates(qc: QueryClient): () => void {
  if (stopCurrent) return stopCurrent;
  if (typeof window === "undefined") return () => undefined;
  let stopped = false;
  let cursor: string | null = null;
  let controller: AbortController | null = null;
  let running = false;
  let backoffMs = 0;
  let wakeTimer: ReturnType<typeof setTimeout> | null = null;

  // Phase 122: not behind another app either (lib/app-state.ts).
  const canRun = () => !stopped && isForeground() && navigator.onLine;

  const apply = (feed: Feed) => {
    if (feed.reset) {
      void qc.invalidateQueries();
      return;
    }
    const now = Date.now();
    for (const [id, at] of ownWrites) if (now - at >= OWN_ECHO_MS) ownWrites.delete(id);
    const others = feed.changes.filter((c) => !isOwnEcho(c, now));
    if (others.length > 0) void qc.invalidateQueries({ predicate: affectsAny(others) });
  };

  const loop = async () => {
    if (running) return;
    running = true;
    try {
      while (canRun()) {
        controller = new AbortController();
        let res: Response;
        try {
          const q = cursor === null ? "" : `?after=${encodeURIComponent(cursor)}&wait=${WAIT_S}`;
          res = await rawFetch(`/api/changes${q}`, { credentials: "include", signal: controller.signal, headers: { Accept: "application/json" } });
        } catch {
          if (!canRun()) break; // aborted (hidden, offline, stopped)
          res = new Response(null, { status: 599 });
        }
        if (res.status === 401) {
          stop(); // signed out; the next sign-in starts a new feed
          break;
        }
        const feed = res.ok ? ((await res.json().catch(() => null)) as Feed | null) : null;
        if (!feed || typeof feed.cursor !== "string") {
          backoffMs = Math.min(300_000, backoffMs ? backoffMs * 2 : 30_000);
          wakeTimer = setTimeout(() => void loop(), backoffMs);
          break;
        }
        backoffMs = 0;
        if (cursor !== null) apply(feed);
        cursor = feed.cursor;
      }
    } finally {
      running = false;
      controller = null;
    }
  };

  const wake = () => {
    if (wakeTimer) clearTimeout(wakeTimer);
    wakeTimer = null;
    if (canRun()) void loop();
    else controller?.abort();
  };

  const stop = () => {
    stopped = true;
    controller?.abort();
    if (wakeTimer) clearTimeout(wakeTimer);
    offForeground();
    window.removeEventListener("online", wake);
    window.removeEventListener("offline", wake);
    stopCurrent = null;
  };

  const offForeground = onForegroundChange(wake);
  window.addEventListener("online", wake);
  window.addEventListener("offline", wake);
  stopCurrent = stop;
  wake();
  return stop;
}


