import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { SECTORS, CITIES, ACTIVE_CITIES, CITY_SECTORS } from "../src/data/seo-data.js";
import { BLOG_ARTICLES, BLOG_CATEGORIES } from "../src/data/blog-data.js";
import { PUBLIC_ROUTES } from "../src/data/sitemap-routes.js";

const BASE_URL = "https://quoteai.ca";
const TODAY = new Date().toISOString().split("T")[0];

const TIER1_CITY_SLUGS = new Set([
  "roma", "milano", "napoli", "torino", "palermo", "genova", "bologna",
  "firenze", "bari", "catania", "venezia", "verona", "messina", "padova",
  "trieste", "brescia", "reggio-calabria", "modena", "parma", "prato",
]);

function url(loc: string, priority: string, changefreq: string, lastmod = TODAY): string {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const entries: string[] = [];

// Static public routes — add trailing slash to all paths except root "/"
for (const route of PUBLIC_ROUTES) {
  const loc = route.path === "/" ? `${BASE_URL}/` : `${BASE_URL}${route.path}/`;
  entries.push(url(loc, route.priority, route.changefreq));
}

// SEO sector landing pages
for (const sectorSlug of Object.keys(SECTORS)) {
  entries.push(url(`${BASE_URL}/quotes/${sectorSlug}/`, "0.8", "monthly", "2026-05-01"));
}

// SEO city×sector pages — restricted to ACTIVE_CITIES (see seo-data.ts) to
// concentrate crawl budget instead of spreading it across 1000+ URLs.
for (const sectorSlug of CITY_SECTORS) {
  for (const city of ACTIVE_CITIES) {
    const priority = TIER1_CITY_SLUGS.has(city.slug) ? "0.7" : "0.6";
    entries.push(url(`${BASE_URL}/quotes/${sectorSlug}/${city.slug}/`, priority, "monthly", "2026-05-01"));
  }
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

# City pages outside the active region (see ACTIVE_CITIES in seo-data.ts)
${inactiveCitySlugs.map((slug) => `Disallow: /quotes/*/${slug}/`).join("\n")}

Sitemap: https://quoteai.ca/sitemap.xml
`;

const robotsOutPath = join(__dirname, "../public/robots.txt");
writeFileSync(robotsOutPath, robotsTxt, "utf-8");
console.log(`robots.txt written: ${robotsOutPath} (${inactiveCitySlugs.length} city patterns disallowed)`);
