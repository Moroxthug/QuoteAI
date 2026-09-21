// Phase 68: posthog-js is ~285 kB minified — a quarter of the public entry
// bundle — so it is loaded on the first user interaction or after 5 s
// (same policy as the Google tag in index.html) instead of being statically
// imported by main.tsx. identify/reset queue behind the load; nothing runs
// at all when VITE_POSTHOG_KEY is unset.
type PostHog = typeof import("posthog-js").default;

let loading: Promise<PostHog | null> | null = null;

export function initAnalytics(): void {
  if (typeof window === "undefined" || !import.meta.env.VITE_POSTHOG_KEY || loading) return;
  const load = () =>
    import("posthog-js").then(({ default: posthog }) => {
      posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: true,
      });
      return posthog;
    });
  loading = new Promise((resolve) => {
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      for (const e of events) window.removeEventListener(e, go);
      resolve(load());
    };
    for (const e of events) window.addEventListener(e, go, { once: true, passive: true });
    window.setTimeout(go, 5000);
  });
  loading.catch(() => null);
}

export function identifyUser(id: string, props: Record<string, unknown>): void {
  loading?.then((ph) => ph?.identify(id, props)).catch(() => undefined);
}

export function resetUser(): void {
  loading?.then((ph) => ph?.reset()).catch(() => undefined);
}
