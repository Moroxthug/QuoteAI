export interface PublicRoute {
  name: string;
  path: string;
  priority: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  /** ISO date of the last meaningful content change. Bump it when the page copy changes — the sitemap must be deterministic (Phase 68: a build-date lastmod made sitemap.xml churn on every build). */
  lastmod: string;
}

/**
 * Single source of truth for all static indexable public pages.
 *
 * This array drives TWO things simultaneously:
 *   1. `scripts/generate-sitemap.ts` reads it at build time to emit sitemap.xml entries.
 *   2. `App.tsx` imports the `PATHS` constants derived below for type-safe route strings.
 *
 * HOW TO ADD A NEW PUBLIC PAGE:
 *   1. Add an entry here (name, path, priority, changefreq).
 *   2. Add the corresponding <Route path={PATHS.YOUR_NAME} ...> in App.tsx.
 *   3. The sitemap updates automatically on the next build (prebuild hook).
 *
 * DO NOT add here:
 *   - Dashboard / auth / admin / onboarding routes (private, not indexable)
 *   - Dynamic routes for /seo/:type, /seo/:type/:city, /blog/:slug, /blog/categoria/:slug
 *     (those are generated from SECTORS, CITIES, BLOG_ARTICLES, BLOG_CATEGORIES data files)
 */
const _PUBLIC_ROUTES = [
  { name: "HOME",       path: "/",           priority: "1.0", changefreq: "weekly",  lastmod: "2026-09-20" },
  { name: "WHATSAPP",   path: "/whatsapp",   priority: "0.8", changefreq: "weekly",  lastmod: "2026-09-20" },
  { name: "BLOG",       path: "/blog",       priority: "0.8", changefreq: "weekly",  lastmod: "2026-09-20" },
  { name: "CHI_SIAMO",  path: "/chi-siamo",  priority: "0.7", changefreq: "yearly",  lastmod: "2026-09-20" },
  { name: "CONTATTI",   path: "/contatti",   priority: "0.7", changefreq: "yearly",  lastmod: "2026-09-20" },
  { name: "PRIVACY",    path: "/privacy-policy", priority: "0.4", changefreq: "yearly",  lastmod: "2026-09-20" },
  { name: "TERMS",      path: "/terms",       priority: "0.4", changefreq: "yearly",  lastmod: "2026-09-20" },
  { name: "MAPPA_SITO", path: "/mappa-sito", priority: "0.5", changefreq: "monthly", lastmod: "2026-09-20" },
] as const satisfies ReadonlyArray<PublicRoute>;

/** Full route objects used by generate-sitemap.ts */
export const PUBLIC_ROUTES: ReadonlyArray<PublicRoute> = _PUBLIC_ROUTES;

/**
 * Type-safe path constants for use in App.tsx routing.
 * Derived from PUBLIC_ROUTES so they are always in sync.
 *
 * @example
 *   import { PATHS } from "@/data/sitemap-routes";
 *   <Route path={PATHS.HOME} component={...} />
 */
export const PATHS = Object.fromEntries(
  _PUBLIC_ROUTES.map((r) => [r.name, r.path]),
) as { [K in (typeof _PUBLIC_ROUTES)[number]["name"]]: string };
