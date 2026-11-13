import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { SECTORS, CITIES, ACTIVE_CITIES, CITY_SECTORS, FRENCH_PRIMARY_CITY_SLUGS } from "../src/data/seo-data.js";
import { BLOG_ARTICLES, BLOG_CATEGORIES } from "../src/data/blog-data.js";
import { PUBLIC_ROUTES } from "../src/data/sitemap-routes.js";
import { HELP_ARTICLES } from "../src/data/help-articles.js";
import { PILOT_PROVINCES } from "../src/data/province-data.js";
import { TOOL_SLUG_PAIRS } from "../src/data/seo-slugs.js";
import { TOOL_PAGES } from "../src/data/tool-pages.js";

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

// Free calculators: the hub and each tool, both languages.
const toolsUpdated = Object.values(TOOL_PAGES).map((p) => p.updatedAt).sort().at(-1)!;
entries.push(url(`${BASE_URL}/tools/`, "0.8", "monthly", toolsUpdated));
entries.push(url(`${BASE_URL}/fr/outils/`, "0.8", "monthly", toolsUpdated));
for (const t of TOOL_SLUG_PAIRS) {
  entries.push(url(`${BASE_URL}/tools/${t.en}/`, "0.8", "monthly", TOOL_PAGES[t.id].updatedAt));
  entries.push(url(`${BASE_URL}/fr/outils/${t.fr}/`, "0.8", "monthly", TOOL_PAGES[t.id].updatedAt));
}

// lastmod for the templated pages = the day their template or data last
// changed (seo-render-engine.ts / seo-data.ts). Bump it when those change so
// the date tells Google something true instead of a fixed placeholder.
const SEO_TEMPLATE_UPDATED = "2026-11-12";

// SEO sector landing pages (English + French — every sector has a French page)
for (const [sectorSlug, sector] of Object.entries(SECTORS)) {
  entries.push(url(`${BASE_URL}/quotes/${sectorSlug}/`, "0.8", "monthly", SEO_TEMPLATE_UPDATED));
  entries.push(url(`${BASE_URL}/fr/soumissions/${sector.frSlug}/`, "0.8", "monthly", SEO_TEMPLATE_UPDATED));
}

// SEO city×sector pages — restricted to ACTIVE_CITIES (see seo-data.ts) to
// concentrate crawl budget instead of spreading it across 1000+ URLs. French
// city pages only exist for the French-primary Quebec cities (see
// FRENCH_PRIMARY_CITY_SLUGS) — everything else stays English-only for now.
for (const sectorSlug of CITY_SECTORS) {
  const sector = SECTORS[sectorSlug];
  for (const city of ACTIVE_CITIES) {
    const priority = TIER1_CITY_SLUGS.has(city.slug) ? "0.7" : "0.6";
    entries.push(url(`${BASE_URL}/quotes/${sectorSlug}/${city.slug}/`, priority, "monthly", SEO_TEMPLATE_UPDATED));
    if (FRENCH_PRIMARY_CITY_SLUGS.includes(city.slug)) {
      entries.push(url(`${BASE_URL}/fr/soumissions/${sector.frSlug}/${city.slug}/`, priority, "monthly", SEO_TEMPLATE_UPDATED));
    }
  }
}

// Help centre (Phase 70) — lastmod is each article's updatedAt
for (const article of HELP_ARTICLES) {
  entries.push(url(`${BASE_URL}/help/${article.slug}/`, "0.7", "monthly", article.updatedAt));
}

// Blog — a category changes when its newest article does; articles use their
// last update (or publish) date.
const articleDate = (a: { publishedAt: string; updatedAt?: string }) => a.updatedAt ?? a.publishedAt;
for (const cat of BLOG_CATEGORIES) {
  const dates = BLOG_ARTICLES.filter((a) => a.category === cat.name || a.category === cat.slug).map(articleDate).sort();
  entries.push(url(`${BASE_URL}/blog/categoria/${cat.slug}/`, "0.7", "weekly", dates[dates.length - 1] ?? SEO_TEMPLATE_UPDATED));
}
for (const article of BLOG_ARTICLES) {
  entries.push(url(`${BASE_URL}/blog/${article.slug}/`, "0.7", "monthly", articleDate(article)));
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

// ─── City pages outside ACTIVE_CITIES ────────────────────────────────────────
// They were indexed once, so they 301 to their trade page (vercel.json) rather
// than being blocked in robots.txt: a disallowed URL is never fetched, so
// Google would never see the redirect and the old copies would linger.
// Fail the build if vercel.json and ACTIVE_CITY_SLUGS drift apart.
const activeSlugSet = new Set(ACTIVE_CITIES.map((c) => c.slug));
const inactiveCitySlugs = CITIES.map((c) => c.slug).filter((slug) => !activeSlugSet.has(slug));
{
  const vercel = JSON.parse(readFileSync(join(__dirname, "../../../vercel.json"), "utf-8")) as { redirects: { source: string }[] };
  const cityRedirects = vercel.redirects.map((r) => r.source).filter((s) => s.startsWith("/quotes/([^/]+)/("));
  const covered = new Set(cityRedirects.flatMap((s) => s.split("(")[2]?.split(")")[0]?.split("|") ?? []));
  const missing = inactiveCitySlugs.filter((slug) => !covered.has(slug));
  const stale = [...covered].filter((slug) => activeSlugSet.has(slug));
  if (missing.length || stale.length) {
    throw new Error(`vercel.json city redirects out of step with ACTIVE_CITY_SLUGS — missing: ${missing.join(", ") || "none"}; redirecting active cities: ${stale.join(", ") || "none"}`);
  }
}

// ─── robots.txt ──────────────────────────────────────────────────────────────
const privateRules = [
  "/dashboard", "/dashboard/", "/sign-in", "/sign-up", "/onboarding", "/admin", "/api",
  "/p/", "/i/", "/sign/", "/t/", "/team-invite/",
].map((path) => `Disallow: ${path}`);
const rules = privateRules.join("\n");

// AI search and answer engines are welcome on the public pages (GEO). A
// crawler that finds a group naming it ignores the `*` group, so each group
// repeats the private rules.
const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "Bingbot", "CCBot",
];

const robotsTxt = `User-agent: *
Allow: /
${rules}

# AI search and assistants
${AI_CRAWLERS.map((bot) => `User-agent: ${bot}`).join("\n")}
Allow: /
${rules}

Sitemap: https://quoteai.ca/sitemap.xml
`;

const robotsOutPath = join(__dirname, "../public/robots.txt");
writeFileSync(robotsOutPath, robotsTxt, "utf-8");
console.log(`robots.txt written: ${robotsOutPath} (${inactiveCitySlugs.length} inactive cities redirect via vercel.json)`);
