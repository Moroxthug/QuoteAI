import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { SECTORS, CITIES, ACTIVE_CITIES, CITY_SECTORS, FRENCH_PRIMARY_CITY_SLUGS } from "../src/data/seo-data.js";
import { BLOG_ARTICLES, BLOG_CATEGORIES } from "../src/data/blog-data.js";
import { PUBLIC_ROUTES } from "../src/data/sitemap-routes.js";
import { HELP_ARTICLES } from "../src/data/help-articles.js";
import { PILOT_PROVINCES } from "../src/data/province-data.js";

const BASE_URL = "https://quoteai.ca";

// The half-dozen highest-population metros get a slightly higher priority
// than the rest of ACTIVE_CITIES.
const TIER1_CITY_SLUGS = new Set([
  "toronto", "montreal", "vancouver", "calgary", "ottawa", "edmonton",
]);

function url(loc: string, priority: string, changefreq: string, lastmod: string): string {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const entries: string[] = [];

// Static public routes — add trailing slash to all paths except root "/".
// Every lastmod below is a fixed date so the committed sitemap.xml only
// changes when content does (no build-date churn).
for (const route of PUBLIC_ROUTES) {
  const loc = route.path === "/" ? `${BASE_URL}/` : `${BASE_URL}${route.path}/`;
  entries.push(url(loc, route.priority, route.changefreq, route.lastmod));
}
// French homepage
entries.push(url(`${BASE_URL}/fr/`, "1.0", "weekly", PUBLIC_ROUTES.find((r) => r.path === "/")!.lastmod));

// Phase 81 — the French twins of the pilot marketing pages, plus one province
// page per pilot province in each language.
const frOf = (path: string) => PUBLIC_ROUTES.find((r) => r.path === path)!;
entries.push(url(`${BASE_URL}/fr/tarifs/`, frOf("/pricing").priority, frOf("/pricing").changefreq, frOf("/pricing").lastmod));
entries.push(url(`${BASE_URL}/fr/pilote/`, frOf("/pilot").priority, frOf("/pilot").changefreq, frOf("/pilot").lastmod));
entries.push(url(`${BASE_URL}/fr/confidentialite/`, frOf("/privacy-policy").priority, frOf("/privacy-policy").changefreq, frOf("/privacy-policy").lastmod));
entries.push(url(`${BASE_URL}/fr/conditions/`, frOf("/terms").priority, frOf("/terms").changefreq, frOf("/terms").lastmod));
for (const province of PILOT_PROVINCES) {
  entries.push(url(`${BASE_URL}/provinces/${province.slug}/`, "0.8", "monthly", "2026-09-22"));
  entries.push(url(`${BASE_URL}/fr/provinces/${province.frSlug}/`, "0.8", "monthly", "2026-09-22"));
}

// SEO sector landing pages (English + French — every sector has a French page)
for (const [sectorSlug, sector] of Object.entries(SECTORS)) {
  entries.push(url(`${BASE_URL}/quotes/${sectorSlug}/`, "0.8", "monthly", "2026-05-01"));
  entries.push(url(`${BASE_URL}/fr/soumissions/${sector.frSlug}/`, "0.8", "monthly", "2026-05-01"));
}

// SEO city×sector pages — restricted to ACTIVE_CITIES (see seo-data.ts) to
// concentrate crawl budget instead of spreading it across 1000+ URLs. French
// city pages only exist for the French-primary Quebec cities (see
// FRENCH_PRIMARY_CITY_SLUGS) — everything else stays English-only for now.
for (const sectorSlug of CITY_SECTORS) {
  const sector = SECTORS[sectorSlug];
  for (const city of ACTIVE_CITIES) {
    const priority = TIER1_CITY_SLUGS.has(city.slug) ? "0.7" : "0.6";
    entries.push(url(`${BASE_URL}/quotes/${sectorSlug}/${city.slug}/`, priority, "monthly", "2026-05-01"));
    if (FRENCH_PRIMARY_CITY_SLUGS.includes(city.slug)) {
      entries.push(url(`${BASE_URL}/fr/soumissions/${sector.frSlug}/${city.slug}/`, priority, "monthly", "2026-05-01"));
    }
  }
}

// Help centre (Phase 70) — lastmod is each article's updatedAt
for (const article of HELP_ARTICLES) {
  entries.push(url(`${BASE_URL}/help/${article.slug}/`, "0.7", "monthly", article.updatedAt));
}

// Blog — categories get a stable aggregate date; articles use their real publishedAt
for (const cat of BLOG_CATEGORIES) {
  entries.push(url(`${BASE_URL}/blog/categoria/${cat.slug}/`, "0.7", "weekly", "2026-05-01"));
}
for (const article of BLOG_ARTICLES) {
  entries.push(url(`${BASE_URL}/blog/${article.slug}/`, "0.7", "monthly", article.publishedAt));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

const outPath = join(__dirname, "../public/sitemap.xml");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, sitemap, "utf-8");
console.log(`Sitemap written: ${outPath} (${entries.length} URLs)`);

// ─── robots.txt ──────────────────────────────────────────────────────────────
// Disallow crawling of city pages outside ACTIVE_CITIES so Googlebot doesn't
// keep spending crawl budget on the ~960 pages we no longer prerender or list
// in the sitemap (they still resolve to the generic SPA shell if visited
// directly, but carry no unique SEO content worth indexing right now).
const activeSlugSet = new Set(ACTIVE_CITIES.map((c) => c.slug));
const inactiveCitySlugs = CITIES.map((c) => c.slug).filter((slug) => !activeSlugSet.has(slug));

const robotsTxt = `User-agent: *
Allow: /

Disallow: /dashboard
Disallow: /dashboard/
Disallow: /sign-in
Disallow: /sign-up
Disallow: /onboarding
Disallow: /admin
Disallow: /api
Disallow: /p/
Disallow: /i/
Disallow: /sign/
Disallow: /t/
Disallow: /team-invite/

# City pages outside the active region (see ACTIVE_CITIES in seo-data.ts)
${inactiveCitySlugs.map((slug) => `Disallow: /quotes/*/${slug}/`).join("\n")}

Sitemap: https://quoteai.ca/sitemap.xml
`;

const robotsOutPath = join(__dirname, "../public/robots.txt");
writeFileSync(robotsOutPath, robotsTxt, "utf-8");
console.log(`robots.txt written: ${robotsOutPath} (${inactiveCitySlugs.length} city patterns disallowed)`);
