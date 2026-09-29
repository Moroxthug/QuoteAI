// Phase 118: first — in the phone app this puts the API fetch in place before anything captures window.fetch.
import "./lib/native/boot.ts";
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import { initAnalytics } from "./lib/analytics.ts";
import { initErrorTracking } from "./lib/error-tracking.ts";
import { initPwa } from "./lib/pwa.ts";
import { detectInitialLang } from "./i18n/detect.ts";
import { ensureStrings } from "./i18n/registry.ts";
import { isNativeApp } from "./lib/native/env.ts";

initErrorTracking();
initAnalytics();
// Phase 77: service worker + install prompt capture (before React, so the
// early beforeinstallprompt event is not missed). The outbox starts with the App.
initPwa();

// Pages rendered at build time by entry-server.tsx (Phase 68/80) carry the
// route they were rendered for on the root element; the Vercel rewrite serves
// index.html — the homepage — for every route without its own file, so the
// marker (not merely "has children") decides whether to hydrate.
const rootEl = document.getElementById("root")!;
const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
const hydrate = rootEl.dataset.ssr === pathname && rootEl.children.length > 0;

// Phase 115: the strings come one language at a time (i18n/registry.ts). The
// first render's language is known now, so its dictionary loads alongside the
// App chunk instead of after it; the signed-in app's own dictionary starts too
// (the dashboard layout waits for it, App.tsx).
const lang = detectInitialLang();
const strings = ensureStrings(lang);
if (/^\/(dashboard|onboarding)(\/|$)/.test(pathname)) void ensureStrings(lang, ["dashboard"]).catch(() => {});

// The App chunk is loaded on demand (it is ~2/3 of the entry's JavaScript);
// prerendered pages carry a <link rel="modulepreload"> for it
// (scripts/prerender-seo.ts) so hydration does not wait on a second round trip.
// Phase 116: the signed-in app opens to what it showed last time — the saved
// answers are put back into the QueryClient before the first render (capped:
// a slow disk shows the skeleton frame rather than holding it back).
const RESTORE_CAP_MS = 400;
const restored = /^\/dashboard(\/|$)/.test(pathname)
  ? Promise.race([
      Promise.all([import("./lib/query-client.ts"), import("./lib/offline/query-cache.ts")]).then(([{ queryClient }, { restoreQueryCache }]) => restoreQueryCache(queryClient)),
      new Promise<void>((resolve) => setTimeout(resolve, RESTORE_CAP_MS)),
    ]).catch(() => undefined)
  : undefined;

// Pocket (Phase 151): the phone app wears the chosen design everywhere, its welcome and sign-in too.
if (isNativeApp) document.documentElement.classList.add("pocket");

void Promise.all([import("./App.tsx"), strings, restored]).then(([{ default: App }]) => {
  const tree = (
    <StrictMode>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </StrictMode>
  );
  if (hydrate) {
    // Server-rendered at build time — hydrate so the hero paints from the
    // HTML and nothing shifts. On a mismatch React 19 re-renders the tree
    // client-side, so the worst case is a console warning, never a blank page.
    hydrateRoot(rootEl, tree);
  } else {
    createRoot(rootEl).render(tree);
  }
  if (isNativeApp) requestAnimationFrame(() => void import("./lib/native/shell.ts").then((m) => m.hideSplash()));
});
