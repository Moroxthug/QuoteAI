// Phase 69: browser error tracking without the 30 kB SDK — window `error`
// and `unhandledrejection` plus the React error boundary, posted to Sentry
// through @workspace/error-reporting (≈2 kB). Inert unless VITE_SENTRY_DSN is
// set. Per page load: duplicates are dropped and at most MAX_EVENTS leave, so
// a render loop cannot burn the quota.

import { buildEvent, parseDsn, sendEvent, type EventContext } from "@workspace/error-reporting";

const dsn = parseDsn(import.meta.env.VITE_SENTRY_DSN);
const MAX_EVENTS = 10;
const seen = new Set<string>();
let sent = 0;
let installed = false;

function fingerprint(err: unknown): string {
  if (err instanceof Error) return `${err.name}:${err.message}:${(err.stack ?? "").split("\n")[1] ?? ""}`;
  return typeof err === "string" ? err : JSON.stringify(err);
}

function context(extra: Partial<EventContext> = {}): EventContext {
  return {
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || (import.meta.env.PROD ? "production" : "development"),
    release: import.meta.env.VITE_RELEASE || undefined,
    logger: "quote-ai",
    request: { url: window.location.href.split("?")[0] },
    ...extra,
    tags: { app: "quote-ai", route: window.location.pathname, lang: document.documentElement.lang || "en", ...extra.tags },
  };
}

/** Reports one error. Safe to call from anywhere; never throws. */
export function reportError(err: unknown, extra: Partial<EventContext> = {}): void {
  if (!dsn || sent >= MAX_EVENTS) return;
  try {
    const key = fingerprint(err);
    if (seen.has(key)) return;
    seen.add(key);
    sent++;
    const event = buildEvent({ error: err }, "javascript", context({ mechanism: "generic", handled: true, ...extra }));
    void sendEvent(dsn, event, fetch as never, { keepalive: true });
  } catch {
    // never let the tracker be the error
  }
}

/** Hooks the global handlers once. Called from main.tsx before anything renders. */
export function initErrorTracking(): void {
  if (!dsn || installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    // Resource-load failures (img/script) fire `error` too but carry no Error;
    // those are noise (ad blockers, flaky networks), not bugs.
    if (!e.error && !e.message) return;
    reportError(e.error ?? new Error(e.message), { mechanism: "onerror", handled: false, extra: { filename: e.filename, lineno: e.lineno, colno: e.colno } });
  });
  window.addEventListener("unhandledrejection", (e) => {
    reportError(e.reason ?? new Error("Unhandled promise rejection"), { mechanism: "onunhandledrejection", handled: false });
  });
}
