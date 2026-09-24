// Phase 80: every public page rendered to static HTML at build time by
// scripts/prerender-seo.ts through entry-server.tsx — the same React tree
// the browser hydrates. Keep this in step with scripts/generate-sitemap.ts
// (the sitemap lists exactly these URLs).
import type { Lang } from "@/i18n/translations";
import { SECTORS, ACTIVE_CITIES, CITY_SECTORS, FRENCH_PRIMARY_CITY_SLUGS } from "./seo-data";
import { BLOG_ARTICLES, BLOG_CATEGORIES } from "./blog-data";
import { HELP_ARTICLES } from "./help-articles";
import { PILOT_PROVINCES } from "./province-data";

interface PrerenderRoute {
  /** Route path without the trailing slash ("/" for the homepage). */
  path: string;
  lang: Lang;
}

export function listPrerenderRoutes(): PrerenderRoute[] {
  const routes: PrerenderRoute[] = [
    { path: "/", lang: "en" },
    { path: "/fr", lang: "fr" },
    // Phase 81: the marketing pages built for the pilot, both languages.
    { path: "/pricing", lang: "en" },
    { path: "/fr/tarifs", lang: "fr" },
    { path: "/pilot", lang: "en" },
    { path: "/fr/pilote", lang: "fr" },
    ...PILOT_PROVINCES.flatMap((p) => [
      { path: `/provinces/${p.slug}`, lang: "en" as const },
      { path: `/fr/provinces/${p.frSlug}`, lang: "fr" as const },
    ]),
    { path: "/whatsapp", lang: "en" },
    { path: "/chi-siamo", lang: "en" },
    { path: "/contatti", lang: "en" },
    { path: "/privacy-policy", lang: "en" },
    { path: "/terms", lang: "en" },
    { path: "/fr/confidentialite", lang: "fr" },
    { path: "/fr/conditions", lang: "fr" },
    { path: "/mappa-sito", lang: "en" },
    // Help centre (Phase 70): index + every article (EN; the toggle re-renders FR client-side).
    { path: "/help", lang: "en" },
    ...HELP_ARTICLES.map((a) => ({ path: `/help/${a.slug}`, lang: "en" as const })),
    // Blog: list, categories, articles (EN only).
    { path: "/blog", lang: "en" },
    ...BLOG_CATEGORIES.map((c) => ({ path: `/blog/categoria/${c.slug}`, lang: "en" as const })),
    ...BLOG_ARTICLES.map((a) => ({ path: `/blog/${a.slug}`, lang: "en" as const })),
  ];
  // Sector pages: every sector in both languages; city pages for the
  // CITY_SECTORS × ACTIVE_CITIES grid, French only for the French-primary
  // Québec cities (the hreflang tags follow the same rule, see city-landing.tsx).
  for (const [slug, sector] of Object.entries(SECTORS)) {
    routes.push({ path: `/quotes/${slug}`, lang: "en" }, { path: `/fr/soumissions/${sector.frSlug}`, lang: "fr" });
    if (!CITY_SECTORS.includes(slug)) continue;
    for (const city of ACTIVE_CITIES) {
      routes.push({ path: `/quotes/${slug}/${city.slug}`, lang: "en" });
      if (FRENCH_PRIMARY_CITY_SLUGS.includes(city.slug)) routes.push({ path: `/fr/soumissions/${sector.frSlug}/${city.slug}`, lang: "fr" });
    }
  }
  return routes;
}
