import { focusManager } from "@tanstack/react-query";

// Phase 122 — battery and data: nothing polls while the app is not in front.
//
// A browser tab says so through `document.visibilityState`; the phone app is
// told by the shell (`@capacitor/app` appStateChange, lib/native/shell.ts),
// which is the one signal that is certain on both Android and iOS — a WebView
// behind another app does not always report itself hidden. Everything that
// repeats on a timer asks `isForeground()` first: the live change feed, the
// outbox's retry tick, and React Query's refetch intervals (through its
// focusManager, which refetchInterval consults unless a query asks to run in
// the background — none does).

let appActive = true;
const listeners = new Set<() => void>();

export function isForeground(): boolean {
  return appActive && (typeof document === "undefined" || document.visibilityState !== "hidden");
}

/** The shell reports the app going behind another app (false) or coming back (true). */
export function setAppActive(active: boolean): void {
  if (active === appActive) return;
  appActive = active;
  // false wins over visibility; undefined hands the answer back to visibility
  // (and, being a change, refetches what went stale while away).
  focusManager.setFocused(active ? undefined : false);
  for (const l of listeners) l();
}

/** Called when the answer of isForeground() may have changed. Returns the unsubscribe. */
export function onForegroundChange(listener: () => void): () => void {
  listeners.add(listener);
  document.addEventListener("visibilitychange", listener);
  return () => {
    listeners.delete(listener);
    document.removeEventListener("visibilitychange", listener);
  };
}
