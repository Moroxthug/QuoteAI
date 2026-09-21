import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { SeoNavShell } from "./components/seo-header.tsx";
import "./index.css";
import { initAnalytics } from "./lib/analytics.ts";

initAnalytics();

// Statically prerendered pages (hand-built bodies in scripts/prerender-seo.ts):
// English + French sector/city landing pages and the blog.
const STATIC_SEO_RE = /^\/(?:quotes\/[^/]+(?:\/[^/]+)?|fr\/soumissions\/[^/]+(?:\/[^/]+)?|blog(?:\/.*)?)\/?$/;
// Pages rendered at build time by entry-server.tsx (keep in sync with SSR_PAGES there).
const SSR_PAGE_RE = /^\/(?:fr|whatsapp|chi-siamo|contatti|privacy-policy|terms|mappa-sito)?\/?$/;

const rootEl = document.getElementById("root")!;
const pathname = window.location.pathname;
const hasPrerendered = rootEl.children.length > 0;

if (STATIC_SEO_RE.test(pathname) && hasPrerendered) {
  // Static page: the body is not React-rendered, so it is not hydrated (a
  // mismatch would blank it). Only the header becomes interactive: the
  // session-aware SeoNavShell is mounted INTO the static <header>, replacing
  // identical markup, so nothing moves (Phase 68 — it used to be inserted as
  // a second, Italian-labelled header above the page; /fr/soumissions pages
  // were not matched at all and got the whole App re-rendered over them,
  // CLS 0.79).
  // The site header (sticky, from wrapInPublicLayout) — not an article <header>.
  const staticHeader = rootEl.querySelector<HTMLElement>("header.sticky");
  const lang = pathname.startsWith("/fr/") ? "fr" : "en";
  if (staticHeader) {
    const mount = document.createElement("div");
    mount.className = "contents";
    staticHeader.before(mount);
    createRoot(mount).render(<SeoNavShell lang={lang} replaces={staticHeader} />);
  }
} else {
  // Everything React-rendered loads the App chunk on demand: the static SEO
  // pages above never pay for it (it is ~2/3 of the entry's JavaScript), and
  // the build-time-rendered pages carry a <link rel="modulepreload"> for it
  // (scripts/prerender-seo.ts) so hydration does not wait on a second
  // round trip.
  const hydrate = SSR_PAGE_RE.test(pathname) && hasPrerendered;
  void import("./App.tsx").then(({ default: App }) => {
    const tree = (
      <StrictMode>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </StrictMode>
    );
    if (hydrate) {
      // "/", "/fr" and the static public pages: server-rendered at build time
      // (Phase 68) — hydrate so the hero paints from the HTML and nothing
      // shifts. On a mismatch React 19 re-renders the tree client-side, so
      // the worst case is a console warning, never a blank page.
      hydrateRoot(rootEl, tree);
    } else {
      createRoot(rootEl).render(tree);
    }
  });
}
