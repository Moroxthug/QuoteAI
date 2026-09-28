import { QueryClient } from "@tanstack/react-query";
import { classify, STALE_MS } from "@/lib/offline/query-policy";

// The one QueryClient of the browser app (was created inside App.tsx; main.tsx
// now fills it from the device before the first render — Phase 116).
//
// Phase 77: TanStack pauses queries and mutations while navigator.onLine is
// false ("online" network mode). Offline is a first-class state here — the
// service worker answers cached reads and the outbox owns writes — so both run
// regardless and fail fast (with the SW's OFFLINE stand-in) when there is
// really nothing to talk to.
//
// Phase 116: freshness per kind of answer instead of "everything is stale at
// once" (lib/offline/query-policy.ts): reference data a day, lists 30 s (and
// on coming back to the front), details on every open. A page that sets its
// own staleTime keeps it. Unused answers stay in memory for a day (was 5 min),
// so a screen restored from the device is still there when it is opened.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "always",
      staleTime: (query) => {
        const cls = classify(query.queryKey);
        return cls ? STALE_MS[cls] : 0;
      },
      // (Not on the server — prerender: an explicit gcTime there schedules a real
      // timer that keeps Node alive for a day; TanStack uses none by default.)
      gcTime: typeof window === "undefined" ? Infinity : 24 * 60 * 60_000,
      // With no signal a retry can't succeed: fail at once, keep showing the
      // saved answer, and try again when the connection comes back
      // (refetchOnReconnect). Otherwise TanStack's default, three tries.
      retry: (failureCount, error) => {
        if (typeof navigator !== "undefined" && !navigator.onLine) return false;
        const e = error as { code?: string; data?: { error?: string } } | null;
        if (e?.code === "OFFLINE" || e?.data?.error === "OFFLINE") return false;
        return failureCount < 3;
      },
    },
    mutations: { networkMode: "always" },
  },
});
