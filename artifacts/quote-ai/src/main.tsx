import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import { initAnalytics } from "./lib/analytics.ts";
import { initErrorTracking } from "./lib/error-tracking.ts";
import { initPwa } from "./lib/pwa.ts";

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

// The App chunk is loaded on demand (it is ~2/3 of the entry's JavaScript);
// prerendered pages carry a <link rel="modulepreload"> for it
// (scripts/prerender-seo.ts) so hydration does not wait on a second round trip.
void import("./App.tsx").then(({ default: App }) => {
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
});
