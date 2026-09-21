import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  SECTORS,
  ACTIVE_CITIES,
  CITY_SECTORS,
  getCityTitle,
  getCityDesc,
  RELATED_SECTORS,
  CITY_CONTEXT,
  FRENCH_PRIMARY_CITY_SLUGS,
} from "../src/data/seo-data.js";
import type { SectorData, CityData } from "../src/data/seo-data.js";
import { CITY_INTELLIGENCE, DEMAND_TEXT } from "../src/data/seo-intelligence.js";
import type { CityIntelligence } from "../src/data/seo-intelligence.js";
import {
  strHash,
  getCityIntro,
  getCityFaqItems,
  getCityLayout,
  getCityCtaVariant,
  getCityCtaTexts,
  getCityHowItWorksSteps,
  getNearbyAnchors,
  getSameCityOtherSectors,
  getCityContextText,
  getSectorFrContent,
  DEMAND_TEXT_FR,
  buildCityJsonLd as buildCityJsonLdFromEngine,
  getOgImagePath,
} from "../src/data/seo-render-engine.js";
import {
  BLOG_ARTICLES,
  BLOG_CATEGORIES,
  BLOG_LIST_TITLE,
  BLOG_LIST_DESCRIPTION,
  SECTOR_ARTICLES,
  getArticlesByCategory,
} from "../src/data/blog-data.js";
import type { BlogArticle, BlogCategory } from "../src/data/blog-data.js";
import { extractToc, injectHeadingIds } from "../src/data/blog-toc.js";
import {
  TESTIMONIALS,
  AGGREGATE_RATING,
} from "../src/components/testimonials-section.js";
import { translations } from "../src/i18n/translations.js";
import { HELP_ARTICLES } from "../src/data/help-articles.js";

function testimonialText(key: string): string {
  return translations.en[`testimonials.${key}.text`] ?? "";
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "../dist/public");
const templatePath = join(distDir, "index.html");

if (!existsSync(templatePath)) {
  console.error("dist/public/index.html not found — run vite build first");
  process.exit(1);
}

const BASE_URL = "https://quoteai.ca";


// ─── Core utilities ────────────────────────────────────────────────────────

const ogImage = getOgImagePath; // one map for the engine, the OG generator and this script

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHeadBlock(opts: {
  title: string;
  description: string;
  canonical: string;
  ogImagePath: string;
  jsonLd: object[];
  /** This page's own language. Defaults to English. */
  lang?: "en" | "fr";
  /** URL of the other language's version of this same page, if one exists. */
  altUrl?: string;
}): string {
  const { title, description, canonical, ogImagePath, jsonLd, lang = "en", altUrl } = opts;
  const ogImageUrl = ogImagePath.startsWith("http")
    ? ogImagePath
    : `${BASE_URL}${ogImagePath}`;
  const enUrl = lang === "en" ? canonical : altUrl;
  const frUrl = lang === "fr" ? canonical : altUrl;
  const hreflangLines = [
    enUrl ? `  <link rel="alternate" hreflang="en-CA" href="${esc(enUrl)}" />` : null,
    frUrl ? `  <link rel="alternate" hreflang="fr-CA" href="${esc(frUrl)}" />` : null,
    // English is the site's default/fallback locale.
    `  <link rel="alternate" hreflang="x-default" href="${esc(enUrl ?? canonical)}" />`,
  ].filter((l): l is string => l !== null);
  const lines = [
    `  <title>${esc(title)}</title>`,
    `  <meta name="description" content="${esc(description)}" />`,
    `  <link rel="canonical" href="${esc(canonical)}" />`,
    ...hreflangLines,
    `  <meta property="og:title" content="${esc(title)}" />`,
    `  <meta property="og:description" content="${esc(description)}" />`,
    `  <meta property="og:url" content="${esc(canonical)}" />`,
    `  <meta property="og:image" content="${esc(ogImageUrl)}" />`,
    `  <meta property="og:image:width" content="1200" />`,
    `  <meta property="og:image:height" content="630" />`,
    `  <meta property="og:type" content="website" />`,
    `  <meta property="og:locale" content="${lang === "fr" ? "fr_CA" : "en_CA"}" />`,
    `  <meta property="og:site_name" content="quoteai" />`,
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:title" content="${esc(title)}" />`,
    `  <meta name="twitter:description" content="${esc(description)}" />`,
    `  <meta name="twitter:image" content="${esc(ogImageUrl)}" />`,
    ...jsonLd.map((schema) => `  <script type="application/ld+json">${JSON.stringify(schema)}</script>`),
  ];
  return lines.join("\n");
}

/**
 * Strip dashboard and charts chunk modulepreloads so SEO pages don't
 * eagerly fetch code that is only needed inside the authenticated dashboard.
 * Since Phase 61 the Vite config no longer emits a "dashboard" manual chunk
 * (the entry no longer statically reaches it), so this is a no-op guard kept
 * in case a manual chunk is reintroduced.
 */
function pruneModulepreload(html: string): string {
  return html.replace(
    /<link\s+rel="modulepreload"\s+crossorigin\s+href="\/assets\/(dashboard|charts)-[^"]*\.js"[^>]*>/gi,
    ""
  );
}

function injectHead(template: string, headBlock: string, lang: "en" | "fr" = "en"): string {
  let html = template;
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${lang === "fr" ? "fr-CA" : "en-CA"}"`);
  html = html.replace(/<title>[^<]*<\/title>/, "");
  html = html.replace(/<meta\s+name="description"[^>]*\/?>/i, "");
  html = html.replace(/<link\b[^>]*\brel=["']canonical["'][^>]*\/?>/gi, "");
  html = html.replace(/<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+name="keywords"[^>]*\/?>/gi, "");
  html = html.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
  // After <meta charset> + viewport: the charset declaration must stay within
  // the first 1024 bytes of the document, and a <title> with an en dash was
  // landing in front of it (Phase 68).
  const viewport = /<meta\s+name="viewport"[^>]*>/i.exec(html);
  html = viewport
    ? html.slice(0, viewport.index + viewport[0].length) + `\n${headBlock}` + html.slice(viewport.index + viewport[0].length)
    : html.replace("<head>", `<head>\n${headBlock}`);
  return html;
}

function injectBody(html: string, bodyHtml: string): string {
  if (!bodyHtml) return html;
  return html.replace(/<div id="root"><\/div>/, `<div id="root">${bodyHtml}</div>`);
}

// main.tsx imports the App on demand (static SEO pages never load it). The
// build-time-rendered pages hydrate with it, so they preload the chunk — and
// the chunks it statically pulls in — to avoid a second round trip before
// hydration. The names carry content hashes, so they are read off dist/.
const APP_PRELOADS: string[] = (() => {
  const assets = join(distDir, "assets");
  const app = readdirSync(assets).find((f) => /^App-[\w-]+\.js$/.test(f));
  if (!app) return [];
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(join(assets, file), "utf8");
    for (const m of src.matchAll(/(?:^|[^.\w])import\s*["']\.\/([\w-]+\.js)["']|from\s*["']\.\/([\w-]+\.js)["']/g)) walk((m[1] ?? m[2])!);
  };
  walk(app);
  return [...seen];
})();
function injectAppPreload(html: string): string {
  const links = APP_PRELOADS.map((f) => `<link rel="modulepreload" crossorigin href="/assets/${f}">`).join("\n    ");
  return links ? html.replace("</head>", `    ${links}\n  </head>`) : html;
}

function writeRoute(relPath: string, html: string): void {
  const outDir = join(distDir, relPath);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html, "utf-8");
}

// ─── PublicLayout wrapper ────────────────────────────────────────────────────
// Wraps prerendered body content in the same HTML structure that React renders
// for PublicLayout so hydration finds a matching DOM and produces zero CLS.

const CURRENT_YEAR = new Date().getFullYear();

const STATIC_LOGO = `<img src="/quoteai-logo.png" alt="quoteai" width="144" height="72" style="height: 72px; width: auto; object-fit: contain;">`;

const STATIC_HEADER = `<header class="sticky top-0 z-50 w-full transition-all duration-300 bg-transparent border-b border-transparent">
  <div class="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
    <a href="/" class="flex items-center">${STATIC_LOGO}</a>
    <nav class="flex items-center gap-3">
      <a href="/sign-in/" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full">Sign in</a>
      <a href="/sign-up/" class="btn-gradient inline-flex h-9 items-center justify-center px-5 text-sm font-semibold">Sign up</a>
    </nav>
  </div>
</header>`;

const STATIC_FOOTER = `<footer class="border-t py-12 md:py-16 bg-white">
  <div class="container mx-auto px-4 md:px-6">
    <div class="grid grid-cols-1 md:grid-cols-5 gap-8">
      <div class="md:col-span-2">
        <a href="/" class="flex items-center mb-4">${STATIC_LOGO}</a>
        <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">AI-powered quoting software for Canadian tradespeople and small businesses. Fast, professional, ready in 30 seconds.</p>
      </div>
      <div class="md:col-span-2">
        <h4 class="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">Trades</h4>
        <ul class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <li><a href="/quotes/painter/" class="hover:text-foreground transition-colors">Painter</a></li>
          <li><a href="/quotes/mason/" class="hover:text-foreground transition-colors">Mason</a></li>
          <li><a href="/quotes/electrician/" class="hover:text-foreground transition-colors">Electrician</a></li>
          <li><a href="/quotes/decorative-painter/" class="hover:text-foreground transition-colors">Decorative Painter</a></li>
          <li><a href="/quotes/plumber/" class="hover:text-foreground transition-colors">Plumber</a></li>
          <li><a href="/quotes/tile-installer/" class="hover:text-foreground transition-colors">Tile Installer</a></li>
          <li><a href="/quotes/general-contractor/" class="hover:text-foreground transition-colors">General Contractors</a></li>
          <li><a href="/quotes/landscaper/" class="hover:text-foreground transition-colors">Landscaper</a></li>
          <li><a href="/quotes/renovation-contractor/" class="hover:text-foreground transition-colors">Renovation Contractors</a></li>
          <li><a href="/quotes/window-door-installer/" class="hover:text-foreground transition-colors">Window &amp; Door Installer</a></li>
          <li><a href="/quotes/welder-fabricator/" class="hover:text-foreground transition-colors">Welders &amp; Fabricators</a></li>
          <li><a href="/quotes/roofer/" class="hover:text-foreground transition-colors">Roofing</a></li>
          <li><a href="/quotes/carpenter-cabinetmaker/" class="hover:text-foreground transition-colors">Carpenters</a></li>
          <li><a href="/quotes/air-conditioning-installer/" class="hover:text-foreground transition-colors">Air Conditioning</a></li>
          <li><a href="/quotes/freelance/" class="hover:text-foreground transition-colors">Freelancer</a></li>
          <li><a href="/quotes/flooring-installer/" class="hover:text-foreground transition-colors">Flooring Installer</a></li>
          <li><a href="/quotes/building-consultant/" class="hover:text-foreground transition-colors">Building Consultants</a></li>
          <li><a href="/quotes/hvac-technician/" class="hover:text-foreground transition-colors">HVAC &amp; Heating</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">Guides</h4>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="/blog/" class="hover:text-foreground transition-colors font-medium text-foreground/80">Blog &amp; Guides</a></li>
          <li><a href="/quotes/excel-template/" class="hover:text-foreground transition-colors">Excel Quote Template</a></li>
          <li><a href="/quotes/word-template/" class="hover:text-foreground transition-colors">Word Quote Template</a></li>
          <li><a href="/quotes/how-to-quote/" class="hover:text-foreground transition-colors">How to Write a Quote</a></li>
          <li><a href="/quotes/free-quote/" class="hover:text-foreground transition-colors">Free Quote Software</a></li>
        </ul>
        <h4 class="font-semibold mt-8 mb-4 text-sm uppercase tracking-wider text-foreground">Company</h4>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="/chi-siamo/" class="hover:text-foreground transition-colors">About Us</a></li>
          <li><a href="/contatti/" class="hover:text-foreground transition-colors">Contact</a></li>
          <li><button class="hover:text-foreground transition-colors text-left">Support</button></li>
          <li><a href="/privacy-policy/" class="hover:text-foreground transition-colors">Privacy Policy</a></li>
          <li><a href="/terms/" class="hover:text-foreground transition-colors">Terms of Service</a></li>
          <li><a href="/mappa-sito/" class="hover:text-foreground transition-colors">Site Map</a></li>
        </ul>
      </div>
    </div>
    <div class="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">© ${CURRENT_YEAR} quoteai. All rights reserved.</div>
  </div>
</footer>`;

const STATIC_WHATSAPP = `<a href="/whatsapp/" aria-label="Chat with us on WhatsApp" class="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full shadow-lg shadow-green-200/60 transition-all duration-200 hover:scale-105 active:scale-95" style="background:rgb(37,211,102)"><span class="flex h-14 w-14 items-center justify-center rounded-full" style="background:rgb(37,211,102)"><img src="/wa-icon.svg" alt="" width="28" height="28" loading="lazy" decoding="async"></span><span class="pr-5 text-white text-sm font-semibold whitespace-nowrap hidden sm:inline-block">Need help?</span></a>`;

function wrapInPublicLayout(contentHtml: string): string {
  return `<div class="min-h-[100dvh] flex flex-col bg-background text-foreground">
${STATIC_HEADER}
<main class="flex-1 flex flex-col">${contentHtml}</main>
${STATIC_FOOTER}
${STATIC_WHATSAPP}
</div>`;
}

// ─── French shell (header/footer/WhatsApp button) ──────────────────────────

const STATIC_HEADER_FR = `<header class="sticky top-0 z-50 w-full transition-all duration-300 bg-transparent border-b border-transparent">
  <div class="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
    <a href="/fr" class="flex items-center">${STATIC_LOGO}</a>
    <nav class="flex items-center gap-3">
      <a href="/sign-in/" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full">Se connecter</a>
      <a href="/sign-up/" class="btn-gradient inline-flex h-9 items-center justify-center px-5 text-sm font-semibold">S'inscrire</a>
    </nav>
  </div>
</header>`;

const FR_TRADE_FOOTER_LINKS = Object.entries(SECTORS)
  .filter(([slug]) => CITY_SECTORS.includes(slug))
  .map(([, s]) => `<li><a href="/fr/soumissions/${esc(s.frSlug)}/" class="hover:text-foreground transition-colors">${esc(s.fr.label)}</a></li>`)
  .join("\n          ");

const STATIC_FOOTER_FR = `<footer class="border-t py-12 md:py-16 bg-white">
  <div class="container mx-auto px-4 md:px-6">
    <div class="grid grid-cols-1 md:grid-cols-5 gap-8">
      <div class="md:col-span-2">
        <a href="/fr" class="flex items-center mb-4">${STATIC_LOGO}</a>
        <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">Logiciel de soumission par IA pour les artisans et petites entreprises canadiennes. Rapide, professionnel, prêt en 30 secondes.</p>
      </div>
      <div class="md:col-span-2">
        <h4 class="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">Métiers</h4>
        <ul class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
          ${FR_TRADE_FOOTER_LINKS}
        </ul>
      </div>
      <div>
        <h4 class="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">Guides</h4>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="/blog/" class="hover:text-foreground transition-colors font-medium text-foreground/80">Blogue et guides</a></li>
          <li><a href="/fr/soumissions/${esc(SECTORS["excel-template"].frSlug)}/" class="hover:text-foreground transition-colors">Modèle Excel</a></li>
          <li><a href="/fr/soumissions/${esc(SECTORS["word-template"].frSlug)}/" class="hover:text-foreground transition-colors">Modèle Word</a></li>
          <li><a href="/fr/soumissions/${esc(SECTORS["how-to-quote"].frSlug)}/" class="hover:text-foreground transition-colors">Comment faire une soumission</a></li>
          <li><a href="/fr/soumissions/${esc(SECTORS["free-quote"].frSlug)}/" class="hover:text-foreground transition-colors">Soumission gratuite</a></li>
        </ul>
        <h4 class="font-semibold mt-8 mb-4 text-sm uppercase tracking-wider text-foreground">Entreprise</h4>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="/chi-siamo/" class="hover:text-foreground transition-colors">À propos</a></li>
          <li><a href="/contatti/" class="hover:text-foreground transition-colors">Contact</a></li>
          <li><button class="hover:text-foreground transition-colors text-left">Soutien</button></li>
          <li><a href="/privacy-policy/" class="hover:text-foreground transition-colors">Politique de confidentialité</a></li>
          <li><a href="/terms/" class="hover:text-foreground transition-colors">Conditions d'utilisation</a></li>
          <li><a href="/mappa-sito/" class="hover:text-foreground transition-colors">Plan du site</a></li>
        </ul>
      </div>
    </div>
    <div class="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">© ${CURRENT_YEAR} quoteai. Tous droits réservés.</div>
  </div>
</footer>`;

const STATIC_WHATSAPP_FR = `<a href="/whatsapp/" aria-label="Clavarder avec nous sur WhatsApp" class="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full shadow-lg shadow-green-200/60 transition-all duration-200 hover:scale-105 active:scale-95" style="background:rgb(37,211,102)"><span class="flex h-14 w-14 items-center justify-center rounded-full" style="background:rgb(37,211,102)"><img src="/wa-icon.svg" alt="" width="28" height="28" loading="lazy" decoding="async"></span><span class="pr-5 text-white text-sm font-semibold whitespace-nowrap hidden sm:inline-block">Besoin d'aide?</span></a>`;

function wrapInPublicLayoutFr(contentHtml: string): string {
  return `<div class="min-h-[100dvh] flex flex-col bg-background text-foreground">
${STATIC_HEADER_FR}
<main class="flex-1 flex flex-col">${contentHtml}</main>
${STATIC_FOOTER_FR}
${STATIC_WHATSAPP_FR}
</div>`;
}

// ─── Phase 7: Visible HTML breadcrumb ──────────────────────────────────────

function buildBreadcrumb(items: { name: string; href: string | null }[]): string {
  const crumbs = items
    .map((item, i) => {
      const sep =
        i > 0
          ? `<li aria-hidden="true" class="mx-1.5 text-gray-300 select-none">/</li>`
          : "";
      const content = item.href === null
        ? `<li class="text-gray-900 font-medium truncate max-w-[200px]" aria-current="page">${esc(item.name)}</li>`
        : `<li><a href="${esc(item.href)}" class="hover:text-violet-600 transition-colors">${esc(item.name)}</a></li>`;
      return sep + content;
    })
    .join("\n      ");
  return `<nav aria-label="Breadcrumb" class="bg-white border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
    <ol class="flex items-center text-sm text-gray-500 flex-wrap">
      ${crumbs}
    </ol>
  </div>
</nav>`;
}

// ─── Phase 2B: City grid on sector pages ───────────────────────────────────

function buildSectorCityGrid(s: SectorData): string {
  const byRegion = new Map<string, CityData[]>();
  for (const city of ACTIVE_CITIES) {
    const arr = byRegion.get(city.region) ?? [];
    arr.push(city);
    byRegion.set(city.region, arr);
  }
  const regionBlocks = Array.from(byRegion.entries())
    .map(([region, cities]) => {
      const cityLinks = cities
        .map(
          (c) =>
            `<a href="/quotes/${esc(s.slug)}/${esc(c.slug)}/" class="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-violet-300 hover:text-violet-600 transition-colors">${esc(c.name)}</a>`
        )
        .join("\n            ");
      return `<div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">${esc(region)}</h3>
          <div class="flex flex-wrap gap-2">
            ${cityLinks}
          </div>
        </div>`;
    })
    .join("\n        ");
  return `<section class="py-20 bg-gray-50">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-12">
      <h2 class="text-2xl font-bold text-gray-900">${esc(s.label)} quotes in top cities</h2>
      <p class="text-sm text-gray-500 mt-2">Select your city for local pricing and information</p>
    </div>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      ${regionBlocks}
    </div>
  </div>
</section>`;
}

// ─── Phase 2C: Related sectors (used on both sector + city pages) ───────────

function buildRelatedSectorsSection(s: SectorData, heading?: string): string {
  const related = RELATED_SECTORS[s.slug];
  if (!related || related.length === 0) return "";
  const h = heading ?? "Related services";
  const links = related
    .map(
      (r) =>
        `<a href="/quotes/${esc(r.slug)}/" class="flex items-center gap-2 bg-white border border-gray-100 hover:border-violet-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:text-violet-700 transition-colors">
          <span class="text-violet-400 font-bold" aria-hidden="true">→</span> ${esc(r.label)}
        </a>`
    )
    .join("\n      ");
  return `<section class="py-14 bg-white border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
    <h2 class="text-base font-semibold text-gray-500 mb-5 text-center">${esc(h)}</h2>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      ${links}
    </div>
  </div>
</section>`;
}

// ─── Approfondimenti section (blog articles related to a sector) ─────────────

function buildApprofondimentiSection(sectorSlug: string): string {
  const slugs = SECTOR_ARTICLES[sectorSlug];
  if (!slugs || slugs.length === 0) return "";
  const articles = slugs
    .map((slug) => BLOG_ARTICLES.find((a) => a.slug === slug))
    .filter((a): a is BlogArticle => a !== null && a !== undefined)
    .slice(0, 3);
  if (articles.length === 0) return "";

  const cards = articles
    .map(
      (a) =>
        `<a href="/blog/${esc(a.slug)}/" class="group flex flex-col bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all duration-200 p-5">
          <span class="text-xs font-semibold text-violet-700 mb-2">${esc(a.category)}</span>
          <span class="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors leading-snug mb-3">${esc(a.title)}</span>
          <span class="text-xs text-gray-400 mt-auto">${a.readingTimeMin} min read</span>
        </a>`
    )
    .join("\n      ");

  return `<section class="py-14 bg-gray-50 border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-base font-semibold text-gray-900">Related reading</h2>
      <a href="/blog/" class="text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors">All articles →</a>
    </div>
    <div class="grid sm:grid-cols-3 gap-4">
      ${cards}
    </div>
  </div>
</section>`;
}

// ─── Phase 4: City context block (max 1 per city page) ─────────────────────

function buildCityContextBlock(city: CityData, s: SectorData): string {
  // CITY_CONTEXT entries are lang-aware ({ en, fr? }) — see the note in
  // seo-data.ts. Only `en` is populated today (no locale routing yet), so
  // this always renders the English copy.
  const context = CITY_CONTEXT[city.slug]?.en;
  if (!context) return "";
  return `<section class="py-10 bg-violet-50/50 border-y border-violet-100/60">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <div class="flex gap-4 items-start">
      <div class="shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div>
        <h2 class="text-sm font-semibold text-violet-700 mb-1.5">${esc(s.label)} in ${esc(city.name)} — local market</h2>
        <p class="text-sm text-gray-600 leading-relaxed">${esc(context)}</p>
      </div>
    </div>
  </div>
</section>`;
}

// ─── JSON-LD schema builders ────────────────────────────────────────────────

function buildSectorJsonLd(s: SectorData): object[] {
  const canonical = `${BASE_URL}/quotes/${s.slug}/`;
  const schemas: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "quoteai",
      description: s.jsonLdDescription,
      url: canonical,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "en",
      offers: { "@type": "Offer", price: "0", priceCurrency: "CAD", availability: "https://schema.org/InStock" },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "127",
        bestRating: "5",
        worstRating: "1",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: s.label, item: canonical },
      ],
    },
  ];
  if (s.faq.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: s.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  return schemas;
}

function buildCityJsonLd(s: SectorData, city: CityData, lang: "en-CA" | "fr-CA" = "en-CA"): object[] {
  return buildCityJsonLdFromEngine(s, city, lang);
}

// ─── Phase 3: Sector body — 2 layout variants ──────────────────────────────

function buildSectorBodyHtml(s: SectorData): string {
  const layout = strHash(s.slug) % 2;

  const breadcrumb = buildBreadcrumb([
    { name: "Home", href: "/" },
    { name: s.label, href: null },
  ]);

  const sHero = `<section class="relative overflow-hidden bg-white pt-24 pb-20">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl relative z-10">
      <div class="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Built for Canadian trades
      </div>
      <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl mb-6 leading-[1.1]">
        ${esc(s.h1)} <span class="gradient-text">${esc(s.h1Highlight)}</span>
      </h1>
      <p class="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">${esc(s.intro)}</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Create your free quote
        </a>
        <a href="#come-funziona" class="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          How it works
        </a>
      </div>
      <p class="text-sm text-gray-400 mt-5">No credit card &middot; Quote ready in 30 seconds</p>
    </div>
  </section>`;

  const sBenefits = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900">${esc(s.h2Benefits)}</h2>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        ${s.benefits.map((b) => `<div class="card-soft bg-white p-7 rounded-2xl flex flex-col">
          <div class="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm mb-5 shrink-0" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true"></div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(b.title)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(b.desc)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const sHowItWorks = `<section id="come-funziona" class="py-20 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900">${esc(s.h2HowItWorks)}</h2>
      </div>
      <div class="grid md:grid-cols-3 gap-8">
        ${s.howItWorks.map((step, i) => `<div>
          <div class="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">${i + 1}</div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(step.step)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(step.desc)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const sUseCases = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">${esc(s.h2UseCases)}</h2>
      </div>
      <ul class="grid sm:grid-cols-2 gap-3">
        ${s.useCases.map((uc) => `<li class="flex items-center gap-3 bg-white rounded-xl px-5 py-3.5 card-soft">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          <span class="text-sm text-gray-700">${esc(uc)}</span>
        </li>`).join("")}
      </ul>
    </div>
  </section>`;

  const sItalianMarket = `<section class="py-20 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <div class="rounded-2xl p-10 md:p-14 relative overflow-hidden" style="background:linear-gradient(135deg,rgba(124,58,237,0.06),rgba(6,182,212,0.06))">
        <div class="relative z-10">
          <div class="flex items-center gap-3 mb-6">
            <div class="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
            </div>
            <h2 class="text-2xl font-bold text-gray-900">Built for the Canadian trades market</h2>
          </div>
          <div class="grid md:grid-cols-3 gap-6 text-sm text-gray-600 leading-relaxed">
            <div>
              <div class="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                Canadian tax built in
              </div>
              <p>GST/HST (and PST/QST where it applies) is calculated automatically for the province the work is done in. No mistakes on the total.</p>
            </div>
            <div>
              <div class="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Your business details, saved once
              </div>
              <p>Company name, licence/registration number, address and logo — every field a Canadian quote needs to look professional.</p>
            </div>
            <div>
              <div class="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
                Trade terminology built in
              </div>
              <p>The AI is trained on the terms Canadian contractors and tradespeople actually use, for accurate, specific quotes.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;

  const sFaq = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">${esc(s.h2Faq)}</h2>
      </div>
      <div class="space-y-4">
        ${s.faq.map((f) => `<div class="bg-white rounded-2xl p-6 card-soft">
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(f.q)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(f.a)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const ctaVariant = strHash(s.slug + "cta") % 3;
  const ctaHeading =
    ctaVariant === 0
      ? `Ready to create your first quote <span class="gradient-text">in 30 seconds</span>?`
      : ctaVariant === 1
        ? `Stop losing time to spreadsheets. <span class="gradient-text">Start free</span>.`
        : `Join contractors across Canada already using it. <span class="gradient-text">It's free</span>.`;
  const ctaBtn =
    ctaVariant === 0 ? "Get Started Free" : ctaVariant === 1 ? "Create free account" : "Try free — no commitment";

  const sCta = `<section class="py-24 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
      <h2 class="text-3xl font-bold text-gray-900 mb-4">${ctaHeading}</h2>
      <p class="text-lg text-gray-500 mb-10">
        No credit card. No commitment. Your first quote is free.
      </p>
      <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
        ${ctaBtn}
        <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
    </div>
  </section>`;

  const sRelated = buildRelatedSectorsSection(s, "Related services — generate quotes for");
  const sCityGrid = CITY_SECTORS.includes(s.slug) ? buildSectorCityGrid(s) : "";
  const sApprofondimenti = buildApprofondimentiSection(s.slug);
  const sDeepDive = buildSectorDeepDive(s);

  const middleSections =
    layout === 0
      ? [sBenefits, sHowItWorks, sUseCases, sItalianMarket, sDeepDive, sFaq]
      : [sHowItWorks, sUseCases, sBenefits, sFaq, sItalianMarket, sDeepDive];

  return wrapInPublicLayout(`<div class="flex flex-col min-h-screen bg-white">
  ${breadcrumb}
  ${sHero}
  ${middleSections.join("\n  ")}
  ${sRelated}
  ${sCityGrid}
  ${sApprofondimenti}
  ${sCta}
</div>`);
}

// ─── Sector long-form text section — boosts text/HTML ratio ────────────────
function buildSectorDeepDive(s: SectorData): string {
  const labelL = s.label.toLowerCase();
  const labelPL = s.labelPlural;
  const useCasesText = s.useCases.slice(0, 6).map((u) => u.toLowerCase()).join(", ");
  const benefitsP = s.benefits
    .map((b) => `<strong>${esc(b.title)}.</strong> ${esc(b.desc)}`)
    .join(" ");
  return `<section class="py-20 bg-white" aria-label="More about ${esc(labelL)} quotes">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">Everything a modern ${esc(labelL)} needs to quote fast</h2>
      </div>
      <div class="prose prose-lg max-w-none text-gray-600 leading-relaxed space-y-6">
        <p>For a <strong>${esc(labelL)}</strong> in Canada, putting together a professional quote is often a second job: hours pulled away from the job site, prices looked up from old supplier lists, the same calculations redone on a spreadsheet that's been patched together for years. The result is usually a rough, inconsistently formatted document that loses jobs to a competitor with a clearer, better-presented estimate. <strong>quoteai</strong> exists to close that gap: describe the job in plain English (or French), in a few sentences, and in thirty seconds you have a complete, professional quote ready to send by text, email or WhatsApp.</p>
        <p>The software is built around how <strong>${esc(labelPL)}</strong> actually work day to day. Most quotes start on site or on the phone with the customer, rarely at a desk. That's why quoteai works entirely from a phone browser: no install, no syncing, nothing to configure. Open the page, describe the job while you're still walking the site, and by the time you're back in the truck the PDF is ready to send. The difference between quoting within the hour and quoting two days later is often the difference between winning the job and losing it to whoever answered first.</p>
        <p>Common jobs our users quote every day include ${esc(useCasesText)}. For each of these, quoteai's AI already knows the typical line items, the units contractors actually use — square feet, linear feet, labour hours, per-job flat rates — and prices that are in line with the Canadian market. You can always edit line items, swap in your own price list, and add or remove sections, but you never start from a blank page: you start from a quote that's already structured, saving most of the time a quote normally takes.</p>
        <h3 class="text-xl font-semibold text-gray-900 mt-10 mb-3">Real advantages for people who quote every day</h3>
        <p>${benefitsP}</p>
        <h3 class="text-xl font-semibold text-gray-900 mt-10 mb-3">Built for how Canadian trades actually invoice</h3>
        <p>Unlike generic international tools, quoteai is designed around the practical details a <strong>${esc(labelL)}</strong> deals with on every job in Canada: GST/HST (and PST or QST where it applies) calculated correctly for the province the work is done in, clear separation between materials and labour, and totals that match what customers expect to see on an estimate before signing off. Your business details — company name, licence or registration number, logo and contact info — are saved once and applied to every quote automatically, so every document looks consistent whether the customer is a homeowner, a property manager or a small business.</p>
        <h3 class="text-xl font-semibold text-gray-900 mt-10 mb-3">From quote to signed job</h3>
        <p>A well-made quote isn't just a pricing document — it's a sales tool. Clean formatting, clear line items, your logo and contact information tell the customer they're dealing with a serious professional. Every quote generated with quoteai includes a custom header, sections by phase of work, a technical description for each line item, unit prices and subtotals, tax shown clearly, a final total, and payment terms and validity dates. The customer gets a tidy PDF — one page where possible — that holds up next to quotes from other ${esc(labelPL)} they're comparing, and in most cases the job goes to whoever presented the more professional estimate, even at a similar price.</p>
        <p>Getting started is free: no credit card, no complicated setup. Create an account in thirty seconds, generate your first quote for free, and only decide afterward whether a subscription plan (for anyone quoting daily) or a one-off quote makes more sense. Contractors, tradespeople and small businesses across Canada already use quoteai every week. Try it and see why nobody goes back to the old spreadsheet.</p>
      </div>
    </div>
  </section>`;
}

// ─── Phase 3: City body — 3 layout variants ────────────────────────────────

// ─── Phase 9: Osservatorio Prezzi e Domanda ────────────────────────────────

function buildOsservatorio(s: SectorData, city: CityData, intel: CityIntelligence, lang: "en-CA" | "fr-CA" = "en-CA"): string {
  const pct = Math.round(Math.abs(intel.priceIndex - 1.0) * 100);
  const priceLabel = intel.priceIndex > 1.0 ? `+${pct}%` : intel.priceIndex < 1.0 ? `\u2212${pct}%` : `\u00b10%`;
  const priceColor =
    intel.priceIndex > 1.05 ? "text-amber-600" : intel.priceIndex < 0.95 ? "text-green-600" : "text-gray-800";
  const demandLabels: Record<CityIntelligence["demandLevel"], string> =
    lang === "fr-CA"
      ? { LOW: "Mod\u00e9r\u00e9e", MEDIUM: "Moyenne", HIGH: "\u00c9lev\u00e9e", CRITICAL: "Tr\u00e8s \u00e9lev\u00e9e" }
      : { LOW: "Moderate", MEDIUM: "Average", HIGH: "High", CRITICAL: "Very high" };
  const demandColors: Record<CityIntelligence["demandLevel"], string> = {
    LOW: "text-green-600", MEDIUM: "text-blue-600", HIGH: "text-amber-600", CRITICAL: "text-red-600",
  };
  const [sv1, sv2, sv3] = intel.topServices;
  void s;
  if (lang === "fr-CA") {
    return `<section class="py-10 bg-white border-b border-gray-100" aria-label="Observatoire des prix et de la demande ${esc(city.name)}">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
    <div class="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/40 to-cyan-50/20 p-6 md:p-8">
      <div class="flex items-center gap-3 mb-6">
        <div class="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </div>
        <h2 class="text-base font-bold text-gray-900">Observatoire des prix et de la demande : ${esc(city.name)}</h2>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Indice des prix</div>
          <div class="text-2xl font-bold ${priceColor}">${priceLabel}</div>
          <div class="text-xs text-gray-400 mt-1">vs. moyenne nationale</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Demande</div>
          <div class="text-base font-bold ${demandColors[intel.demandLevel]}">${demandLabels[intel.demandLevel]}</div>
          <div class="text-xs text-gray-400 mt-1">${esc(city.region)}</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">D\u00e9lai</div>
          <div class="text-base font-bold text-gray-800">${esc(intel.avgLeadTime)}</div>
          <div class="text-xs text-gray-400 mt-1">r\u00e9ponse estim\u00e9e</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Services les plus demand\u00e9s</div>
          <ul class="space-y-1.5">
            <li class="flex items-start gap-1 text-xs text-gray-600"><span class="text-violet-400 shrink-0 font-bold" aria-hidden="true">&rsaquo;</span>${esc(sv1)}</li>
            <li class="flex items-start gap-1 text-xs text-gray-600"><span class="text-violet-400 shrink-0 font-bold" aria-hidden="true">&rsaquo;</span>${esc(sv2)}</li>
            <li class="flex items-start gap-1 text-xs text-gray-600"><span class="text-violet-400 shrink-0 font-bold" aria-hidden="true">&rsaquo;</span>${esc(sv3)}</li>
          </ul>
        </div>
      </div>
      <p class="text-sm text-gray-500 leading-relaxed border-t border-violet-100 pt-4">${esc(intel.localInsight)}</p>
    </div>
  </div>
</section>`;
  }
  return `<section class="py-10 bg-white border-b border-gray-100" aria-label="Price and demand observatory ${esc(city.name)}">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
    <div class="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/40 to-cyan-50/20 p-6 md:p-8">
      <div class="flex items-center gap-3 mb-6">
        <div class="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </div>
        <h2 class="text-base font-bold text-gray-900">Price &amp; Demand Observatory: ${esc(city.name)}</h2>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Price index</div>
          <div class="text-2xl font-bold ${priceColor}">${priceLabel}</div>
          <div class="text-xs text-gray-400 mt-1">vs. national average</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Demand</div>
          <div class="text-base font-bold ${demandColors[intel.demandLevel]}">${demandLabels[intel.demandLevel]}</div>
          <div class="text-xs text-gray-400 mt-1">${esc(city.region)}</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Lead time</div>
          <div class="text-base font-bold text-gray-800">${esc(intel.avgLeadTime)}</div>
          <div class="text-xs text-gray-400 mt-1">estimated response</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Top services</div>
          <ul class="space-y-1.5">
            <li class="flex items-start gap-1 text-xs text-gray-600"><span class="text-violet-400 shrink-0 font-bold" aria-hidden="true">&rsaquo;</span>${esc(sv1)}</li>
            <li class="flex items-start gap-1 text-xs text-gray-600"><span class="text-violet-400 shrink-0 font-bold" aria-hidden="true">&rsaquo;</span>${esc(sv2)}</li>
            <li class="flex items-start gap-1 text-xs text-gray-600"><span class="text-violet-400 shrink-0 font-bold" aria-hidden="true">&rsaquo;</span>${esc(sv3)}</li>
          </ul>
        </div>
      </div>
      <p class="text-sm text-gray-500 leading-relaxed border-t border-violet-100 pt-4">${esc(intel.localInsight)}</p>
    </div>
  </div>
</section>`;
}

function buildCityBodyHtml(s: SectorData, city: CityData): string {
  const layout = getCityLayout(s, city);
  const cityName = city.name;
  const regionName = city.region;
  const intel = CITY_INTELLIGENCE[city.slug];
  const intro = getCityIntro(s, city);

  const breadcrumb = buildBreadcrumb([
    { name: "Home", href: "/" },
    { name: s.label, href: `/quotes/${s.slug}/` },
    { name: cityName, href: null },
  ]);

  const sHero = `<section class="relative overflow-hidden bg-white pt-24 pb-20">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl relative z-10">
      <div class="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        ${esc(regionName)}
      </div>
      <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl mb-6 leading-[1.1]">
        ${esc(s.h1)} <span class="gradient-text">${esc(s.h1Highlight)}</span><br />
        <span class="text-gray-500 text-3xl sm:text-4xl font-bold">in ${esc(cityName)}</span>
      </h1>
      <p class="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">${esc(intro)}</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Create your free quote
        </a>
        <a href="/quotes/${esc(s.slug)}/" class="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          See how it works
        </a>
      </div>
      <p class="text-sm text-gray-400 mt-5">No credit card &middot; Quote ready in 30 seconds</p>
    </div>
  </section>`;

  const sOsservatorio = intel ? buildOsservatorio(s, city, intel) : "";

  const sBenefits = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900">Why ${esc(s.labelPlural)} in ${esc(cityName)} choose quoteai</h2>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        ${s.benefits.map((b) => `<div class="card-soft bg-white p-7 rounded-2xl flex flex-col">
          <div class="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm mb-5 shrink-0" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true"></div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(b.title)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(b.desc)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const howItWorksSteps = getCityHowItWorksSteps(cityName);
  const sHowItWorks = `<section class="py-20 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900">A professional quote in ${esc(cityName)} in 3 steps</h2>
      </div>
      <div class="grid md:grid-cols-3 gap-10">
        ${howItWorksSteps.map((step) => `<div>
          <div class="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">${esc(step.n)}</div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(step.title)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(step.desc)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const sUseCases = `<section class="py-20 ${layout === 2 ? "bg-white" : "bg-gray-50"}">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">Quotes for these jobs in ${esc(cityName)}</h2>
      </div>
      <ul class="grid sm:grid-cols-2 gap-3">
        ${s.useCases.map((uc) => `<li class="flex items-center gap-3 bg-white rounded-xl px-5 py-3.5 card-soft">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          <span class="text-sm text-gray-700">${esc(uc)}</span>
        </li>`).join("")}
      </ul>
    </div>
  </section>`;

  const cityFaqItems = getCityFaqItems(s, city);

  const sFaq = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">Frequently asked questions</h2>
      </div>
      <div class="space-y-4">
        ${cityFaqItems.map((f) => `<div class="bg-white rounded-2xl p-6 card-soft">
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(f.q)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(f.a)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const nearbyLinks = getNearbyAnchors(s, city)
    .map(({ slug, anchorText }) =>
      `<a href="/quotes/${esc(s.slug)}/${esc(slug)}/" class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-sm text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors">${esc(anchorText)}</a>`
    )
    .join("\n          ");

  const sNearby = nearbyLinks
    ? `<section class="py-16 bg-white border-t border-gray-100">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <h2 class="text-base font-semibold text-gray-500 mb-5 text-center">
        ${esc(s.labelPlural)} quotes in nearby cities
      </h2>
      <div class="flex flex-wrap gap-2 justify-center">
          ${nearbyLinks}
      </div>
    </div>
  </section>`
    : "";

  const sQuantoCosta = buildQuantoCostaBlock(s, city, intel);
  const sContext = buildCityContextBlock(city, s);
  const sameCityOtherSectors = getSameCityOtherSectors(s.slug, city.slug);
  const sSameCityOther = sameCityOtherSectors.length
    ? `<section class="py-14 bg-gray-50 border-t border-gray-100">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <h2 class="text-base font-semibold text-gray-500 mb-5 text-center">Other services in ${esc(cityName)}</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        ${sameCityOtherSectors
          .map(
            (r) =>
              `<a href="/quotes/${esc(r.slug)}/${esc(city.slug)}/" class="flex items-center gap-2 bg-white border border-gray-100 hover:border-violet-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:text-violet-700 transition-colors">
          <span class="text-violet-400 font-bold" aria-hidden="true">→</span> ${esc(r.label)} in ${esc(cityName)}
        </a>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";
  const sRelated = buildRelatedSectorsSection(s, `Also see: quotes for`);
  const sApprofondimenti = buildApprofondimentiSection(s.slug);

  const ctaTexts = getCityCtaTexts(getCityCtaVariant(s, city), cityName);
  const ctaHeading =
    `${esc(ctaTexts.headingPrefix)}<span class="gradient-text">${esc(ctaTexts.headingGradient)}</span>`;

  const sCta = `<section class="py-24 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
      <h2 class="text-3xl font-bold text-gray-900 mb-4">${ctaHeading}</h2>
      <p class="text-lg text-gray-500 mb-10">
        No credit card required. Your first professional quote is free.
      </p>
      <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
        ${esc(ctaTexts.button)}
        <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
      <p class="text-sm text-gray-400 mt-4">Quote ready in 30 seconds &middot; No commitment</p>
    </div>
  </section>`;

  const mainSections =
    layout === 0
      ? [sBenefits, sHowItWorks, sUseCases, sFaq]
      : layout === 1
        ? [sHowItWorks, sUseCases, sBenefits, sFaq]
        : [sUseCases, sBenefits, sHowItWorks, sFaq];

  return `<div class="flex flex-col min-h-screen bg-white">
  ${breadcrumb}
  ${sHero}
  ${sOsservatorio}
  ${mainSections.join("\n  ")}
  ${sQuantoCosta}
  ${sContext}
  ${sNearby}
  ${sSameCityOther}
  ${sRelated}
  ${sApprofondimenti}
  ${sCta}
</div>`;
}

// ─── "Quanto costa" block: extra unique text for city pages (improves text/HTML ratio) ────

function buildQuantoCostaBlock(
  s: SectorData,
  city: CityData,
  intel: CityIntelligence | undefined,
  lang: "en-CA" | "fr-CA" = "en-CA",
): string {
  const cityName = city.name;
  const regionName = city.region;
  const pricePct = intel ? Math.round((intel.priceIndex - 1.0) * 100) : 0;

  const examples = (lang === "fr-CA" ? s.fr.useCases : s.useCases).slice(0, 4).map((uc, i) => {
    const base = 250 + i * 320 + (strHash(city.slug + s.slug + String(i)) % 180);
    const factor = intel ? intel.priceIndex : 1.0;
    const low = Math.round((base * factor) / 10) * 10;
    const high = Math.round((base * factor * 1.7) / 10) * 10;
    return { label: uc, range: lang === "fr-CA" ? `${low} $ à ${high} $` : `$${low} to $${high}` };
  });
  const examplesList = examples
    .map(
      (e) =>
        `<li class="flex items-start justify-between gap-4 bg-white rounded-xl px-5 py-3.5 border border-gray-100">
          <span class="text-sm text-gray-700 leading-snug">${esc(e.label)}</span>
          <span class="text-sm font-semibold text-violet-700 whitespace-nowrap">${esc(e.range)}</span>
        </li>`,
    )
    .join("\n        ");

  if (lang === "fr-CA") {
    const sectorLabel = s.fr.label.toLowerCase();
    const priceNote = !intel
      ? `conforme à la moyenne nationale`
      : pricePct > 5
        ? `en moyenne <strong>${pricePct}% plus élevé</strong> que la moyenne nationale`
        : pricePct < -5
          ? `en moyenne <strong>${Math.abs(pricePct)}% plus bas</strong> que la moyenne nationale`
          : `conforme à la moyenne nationale (variation limitée à ±5%)`;
    const demandText = intel ? DEMAND_TEXT_FR[intel.demandLevel] : "stable";
    const paragraph1 = `À ${esc(cityName)}, le coût moyen pour des travaux de ${esc(sectorLabel)} est ${priceNote}. La demande au ${esc(regionName)} est actuellement ${esc(demandText.toLowerCase())}, ce qui influence la rapidité de réponse des entrepreneurs et la marge de négociation sur le prix final. Les fourchettes ci-dessous sont des prix de marché moyens tirés de soumissions réelles générées avec quoteai pour des travaux à ${esc(cityName)} et les environs.`;
    const paragraph2 = `Chaque soumission dépend de facteurs propres au travail : l'ampleur exacte des travaux, la qualité des matériaux demandés, l'accessibilité du site, l'urgence et les conditions particulières convenues avec le client. C'est pourquoi nous recommandons toujours une visite ou une description détaillée : avec quoteai, vous pouvez le faire en 30 secondes en décrivant le travail en langage naturel, et obtenir un document professionnel et modifiable, prêt à envoyer au client par WhatsApp ou courriel.`;
    return `<section class="py-20 bg-white border-t border-gray-100" aria-label="Combien coûte ${esc(sectorLabel)} à ${esc(cityName)}">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <div class="text-center mb-10">
      <h2 class="text-2xl font-bold text-gray-900">Combien coûte un ${esc(sectorLabel)} à ${esc(cityName)}</h2>
      <p class="text-sm text-gray-400 mt-2">Fourchettes de prix typiques pour les travaux les plus demandés</p>
    </div>
    <div class="space-y-4 text-gray-600 leading-relaxed text-base mb-8">
      <p>${paragraph1}</p>
      <p>${paragraph2}</p>
    </div>
    <ul class="space-y-2.5">
      ${examplesList}
    </ul>
    <p class="text-xs text-gray-400 mt-6 text-center">Prix de marché moyens à ${esc(cityName)}, mis à jour pour ${CURRENT_YEAR}. Taxes non incluses. Les prix réels varient selon les particularités du travail.</p>
  </div>
</section>`;
  }

  const sectorLabel = s.label.toLowerCase();
  const priceNote = !intel
    ? `in line with the national average`
    : pricePct > 5
      ? `on average <strong>${pricePct}% higher</strong> than the national average`
      : pricePct < -5
        ? `on average <strong>${Math.abs(pricePct)}% lower</strong> than the national average`
        : `in line with the national average (a modest variation within ±5%)`;

  const demandText = intel ? DEMAND_TEXT[intel.demandLevel] : "steady";

  const paragraph1 = `In ${esc(cityName)}, the average cost for ${esc(sectorLabel)} work is ${priceNote}. Demand in ${esc(regionName)} is currently ${esc(demandText)}, which affects how quickly contractors respond and how much room there is to negotiate the final price. The ranges below are average market prices drawn from real quotes generated with quoteai for jobs in ${esc(cityName)} and the surrounding area.`;
  const paragraph2 = `Every quote depends on job-specific factors: the exact scope of work, the quality of materials requested, site accessibility, how urgent the job is, and any custom terms agreed with the client. That's why we always recommend a proper walkthrough or a detailed description: with quoteai you can do that in 30 seconds by describing the job in plain language, and get a professional, editable document ready to send to the client by WhatsApp or email.`;

  return `<section class="py-20 bg-white border-t border-gray-100" aria-label="What ${esc(sectorLabel)} work costs in ${esc(cityName)}">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <div class="text-center mb-10">
      <h2 class="text-2xl font-bold text-gray-900">What does a ${esc(sectorLabel)} cost in ${esc(cityName)}</h2>
      <p class="text-sm text-gray-400 mt-2">Typical price ranges for the most requested jobs</p>
    </div>
    <div class="space-y-4 text-gray-600 leading-relaxed text-base mb-8">
      <p>${paragraph1}</p>
      <p>${paragraph2}</p>
    </div>
    <ul class="space-y-2.5">
      ${examplesList}
    </ul>
    <p class="text-xs text-gray-400 mt-6 text-center">Average market prices in ${esc(cityName)}, updated for ${CURRENT_YEAR}. Tax not included. Actual prices vary based on the specifics of the job.</p>
  </div>
</section>`;
}

// The homepage (dist/index.html, dist/fr/index.html) gets its SEO <head> only.
// It used to also get a hand-written static copy of the hero (buildHomepageBodyHtml),
// which drifted from the real React homepage after the pixel redesign and was served
// as a stale flash on every cold load of "/" AND of every /dashboard/* route (index.html
// is the SPA fallback) until the bundle replaced it. The real page is client-rendered;
// crawlers execute JS. Do not reintroduce a static body here unless it is generated
// from the React tree (renderToString + hydrateRoot), never hand-copied.


// ─── French sector page body ────────────────────────────────────────────────

function buildFrBreadcrumb(items: { name: string; href: string | null }[]): string {
  return buildBreadcrumb(items).replace('aria-label="Breadcrumb"', 'aria-label="Fil d\'Ariane"');
}

function buildSectorBodyHtmlFr(s: SectorData): string {
  const c = getSectorFrContent(s);
  const breadcrumb = buildFrBreadcrumb([
    { name: "Accueil", href: "/fr" },
    { name: c.h1Highlight, href: null },
  ]);

  const sHero = `<section class="relative overflow-hidden bg-white pt-24 pb-20">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl relative z-10">
      <div class="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Conçu pour les artisans canadiens
      </div>
      <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl mb-6 leading-[1.1]">
        ${esc(c.h1)} <span class="gradient-text">${esc(c.h1Highlight)}</span>
      </h1>
      <p class="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">${esc(c.intro)}</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Créer ma soumission gratuite
        </a>
        <a href="#comment-ca-marche" class="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Comment ça marche
        </a>
      </div>
      <p class="text-sm text-gray-400 mt-5">Sans carte de crédit &middot; Soumission prête en 30 secondes</p>
    </div>
  </section>`;

  const sBenefits = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900">${esc(c.h2Benefits)}</h2>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        ${c.benefits.map((b) => `<div class="card-soft bg-white p-7 rounded-2xl flex flex-col">
          <div class="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm mb-5 shrink-0" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true"></div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(b.title)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(b.desc)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const sHowItWorks = `<section id="comment-ca-marche" class="py-20 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900">${esc(c.h2HowItWorks)}</h2>
      </div>
      <div class="grid md:grid-cols-3 gap-8">
        ${c.howItWorks.map((step, i) => `<div>
          <div class="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">${i + 1}</div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(step.step)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(step.desc)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const sUseCases = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">${esc(c.h2UseCases)}</h2>
      </div>
      <ul class="grid sm:grid-cols-2 gap-3">
        ${s.fr.useCases.map((uc) => `<li class="flex items-center gap-3 bg-white rounded-xl px-5 py-3.5 card-soft">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          <span class="text-sm text-gray-700">${esc(uc)}</span>
        </li>`).join("")}
      </ul>
    </div>
  </section>`;

  const sMarket = `<section class="py-20 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <div class="rounded-2xl p-10 md:p-14 relative overflow-hidden" style="background:linear-gradient(135deg,rgba(124,58,237,0.06),rgba(6,182,212,0.06))">
        <div class="relative z-10">
          <h2 class="text-2xl font-bold text-gray-900 mb-6">Conçu pour le marché canadien des métiers</h2>
          <div class="grid md:grid-cols-3 gap-6 text-sm text-gray-600 leading-relaxed">
            <div><div class="font-semibold text-gray-900 mb-2">Taxes canadiennes intégrées</div><p>La TPS/TVH (et la TVP/TVQ le cas échéant) est calculée automatiquement selon la province où le travail est exécuté.</p></div>
            <div><div class="font-semibold text-gray-900 mb-2">Vos informations d'entreprise, sauvegardées une fois</div><p>Nom de l'entreprise, numéro de licence ou d'enregistrement, adresse et logo — chaque champ nécessaire pour une soumission professionnelle.</p></div>
            <div><div class="font-semibold text-gray-900 mb-2">Vocabulaire des métiers intégré</div><p>L'IA est entraînée sur les termes que les entrepreneurs et artisans canadiens utilisent réellement.</p></div>
          </div>
        </div>
      </div>
    </div>
  </section>`;

  const sFaq = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">${esc(c.h2Faq)}</h2>
      </div>
      <div class="space-y-4">
        ${c.faq.map((f) => `<div class="bg-white rounded-2xl p-6 card-soft">
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(f.q)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(f.a)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const sCityGrid = CITY_SECTORS.includes(s.slug) ? (() => {
    const byRegion = new Map<string, CityData[]>();
    for (const city of ACTIVE_CITIES) {
      const arr = byRegion.get(city.region) ?? [];
      arr.push(city);
      byRegion.set(city.region, arr);
    }
    const regionBlocks = Array.from(byRegion.entries())
      .map(([region, cities]) => `<div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">${esc(region)}</h3>
          <div class="flex flex-wrap gap-2">
            ${cities.map((c2) => `<a href="/fr/soumissions/${esc(s.frSlug)}/${esc(c2.slug)}/" class="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-violet-300 hover:text-violet-600 transition-colors">${esc(c2.name)}</a>`).join("\n            ")}
          </div>
        </div>`)
      .join("\n        ");
    return `<section class="py-20 bg-gray-50">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center mb-12">
      <h2 class="text-2xl font-bold text-gray-900">Soumissions ${esc(c.h1Highlight.toLowerCase())} dans les principales villes</h2>
      <p class="text-sm text-gray-500 mt-2">Sélectionnez votre ville pour des prix et informations locales</p>
    </div>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      ${regionBlocks}
    </div>
  </div>
</section>`;
  })() : "";

  const related = RELATED_SECTORS[s.slug];
  const sRelated = related && related.length > 0 ? `<section class="py-14 bg-white border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
    <h2 class="text-base font-semibold text-gray-500 mb-5 text-center">Services connexes</h2>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      ${related.map((r) => {
        const rSector = SECTORS[r.slug];
        const rLabel = rSector ? rSector.fr.label : r.label;
        const rSlug = rSector ? rSector.frSlug : r.slug;
        return `<a href="/fr/soumissions/${esc(rSlug)}/" class="flex items-center gap-2 bg-white border border-gray-100 hover:border-violet-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:text-violet-700 transition-colors">
          <span class="text-violet-400 font-bold" aria-hidden="true">→</span> ${esc(rLabel)}
        </a>`;
      }).join("\n      ")}
    </div>
  </div>
</section>` : "";

  const sCta = `<section class="py-24 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
      <h2 class="text-3xl font-bold text-gray-900 mb-4">Prêt à créer votre première soumission <span class="gradient-text">en 30 secondes</span>?</h2>
      <p class="text-lg text-gray-500 mb-10">
        Sans carte de crédit. Sans engagement. Votre première soumission est gratuite.
      </p>
      <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
        Commencer gratuitement
        <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
    </div>
  </section>`;

  return wrapInPublicLayoutFr(`<div class="flex flex-col min-h-screen bg-white">
  ${breadcrumb}
  ${sHero}
  ${sBenefits}
  ${sHowItWorks}
  ${sUseCases}
  ${sMarket}
  ${sFaq}
  ${sCityGrid}
  ${sRelated}
  ${sCta}
</div>`);
}

function buildSectorJsonLdFr(s: SectorData): object[] {
  const c = getSectorFrContent(s);
  const canonical = `${BASE_URL}/fr/soumissions/${s.frSlug}/`;
  const schemas: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "quoteai",
      description: s.fr.jsonLdDescription,
      url: canonical,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "fr",
      offers: { "@type": "Offer", price: "0", priceCurrency: "CAD", availability: "https://schema.org/InStock" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${BASE_URL}/fr/` },
        { "@type": "ListItem", position: 2, name: s.fr.label, item: canonical },
      ],
    },
  ];
  if (c.faq.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: c.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  return schemas;
}

// ─── French city page body ──────────────────────────────────────────────────

function buildCityBodyHtmlFr(s: SectorData, city: CityData): string {
  const cityName = city.name;
  const regionName = city.region;
  const intel = CITY_INTELLIGENCE[city.slug];
  const c = getSectorFrContent(s);
  const intro = getCityIntro(s, city, "fr-CA");

  const breadcrumb = buildFrBreadcrumb([
    { name: "Accueil", href: "/fr" },
    { name: s.fr.label, href: `/fr/soumissions/${s.frSlug}/` },
    { name: cityName, href: null },
  ]);

  const sHero = `<section class="relative overflow-hidden bg-white pt-24 pb-20">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl relative z-10">
      <div class="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        ${esc(regionName)}
      </div>
      <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl mb-6 leading-[1.1]">
        ${esc(c.h1)} <span class="gradient-text">${esc(c.h1Highlight)}</span><br />
        <span class="text-gray-500 text-3xl sm:text-4xl font-bold">à ${esc(cityName)}</span>
      </h1>
      <p class="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">${esc(intro)}</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Créer ma soumission gratuite
        </a>
        <a href="/fr/soumissions/${esc(s.frSlug)}/" class="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Voir comment ça marche
        </a>
      </div>
      <p class="text-sm text-gray-400 mt-5">Sans carte de crédit &middot; Soumission prête en 30 secondes</p>
    </div>
  </section>`;

  const sOsservatorio = intel ? buildOsservatorio(s, city, intel, "fr-CA") : "";

  const sBenefits = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900">Pourquoi les ${esc(s.fr.labelPlural)} de ${esc(cityName)} choisissent quoteai</h2>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        ${c.benefits.map((b) => `<div class="card-soft bg-white p-7 rounded-2xl flex flex-col">
          <div class="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm mb-5 shrink-0" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true"></div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(b.title)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(b.desc)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const howItWorksSteps = getCityHowItWorksSteps(cityName, "fr-CA");
  const sHowItWorks = `<section class="py-20 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900">Soumission professionnelle à ${esc(cityName)} en 3 étapes</h2>
      </div>
      <div class="grid md:grid-cols-3 gap-10">
        ${howItWorksSteps.map((step) => `<div>
          <div class="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">${esc(step.n)}</div>
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(step.title)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(step.desc)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const sUseCases = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">Soumissions pour ces travaux à ${esc(cityName)}</h2>
      </div>
      <ul class="grid sm:grid-cols-2 gap-3">
        ${s.fr.useCases.map((uc) => `<li class="flex items-center gap-3 bg-white rounded-xl px-5 py-3.5 card-soft">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          <span class="text-sm text-gray-700">${esc(uc)}</span>
        </li>`).join("")}
      </ul>
    </div>
  </section>`;

  const cityFaqItems = getCityFaqItems(s, city, "fr-CA");
  const sFaq = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">Questions fréquentes</h2>
      </div>
      <div class="space-y-4">
        ${cityFaqItems.map((f) => `<div class="bg-white rounded-2xl p-6 card-soft">
          <h3 class="text-base font-semibold text-gray-900 mb-2">${esc(f.q)}</h3>
          <p class="text-sm text-gray-500 leading-relaxed">${esc(f.a)}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;

  const nearbyLinks = getNearbyAnchors(s, city, "fr-CA")
    .map(({ slug, anchorText }) => `<a href="/fr/soumissions/${esc(s.frSlug)}/${esc(slug)}/" class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-sm text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors">${esc(anchorText)}</a>`)
    .join("\n          ");
  const sNearby = nearbyLinks ? `<section class="py-16 bg-white border-t border-gray-100">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <h2 class="text-base font-semibold text-gray-500 mb-5 text-center">
        Soumissions ${esc(s.fr.labelPlural)} dans les villes voisines
      </h2>
      <div class="flex flex-wrap gap-2 justify-center">
          ${nearbyLinks}
      </div>
    </div>
  </section>` : "";

  const sQuantoCosta = buildQuantoCostaBlock(s, city, intel, "fr-CA");
  const contextTextFr = getCityContextText(city.slug, "fr-CA");
  const sContext = contextTextFr ? `<section class="py-10 bg-violet-50/50 border-y border-violet-100/60">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <div class="flex gap-4 items-start">
      <div class="shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div>
        <h2 class="text-sm font-semibold text-violet-700 mb-1.5">${esc(s.fr.label)} à ${esc(cityName)} — marché local</h2>
        <p class="text-sm text-gray-600 leading-relaxed">${esc(contextTextFr)}</p>
      </div>
    </div>
  </div>
</section>` : "";

  const sameCityOtherSectors = getSameCityOtherSectors(s.slug, city.slug, 6, "fr-CA");
  const sSameCityOther = sameCityOtherSectors.length ? `<section class="py-14 bg-gray-50 border-t border-gray-100">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <h2 class="text-base font-semibold text-gray-500 mb-5 text-center">Autres services à ${esc(cityName)}</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        ${sameCityOtherSectors
          .map((r) => `<a href="/fr/soumissions/${esc(SECTORS[r.slug]?.frSlug ?? r.slug)}/${esc(city.slug)}/" class="flex items-center gap-2 bg-white border border-gray-100 hover:border-violet-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:text-violet-700 transition-colors">
          <span class="text-violet-400 font-bold" aria-hidden="true">→</span> ${esc(r.label)} à ${esc(cityName)}
        </a>`)
          .join("\n        ")}
      </div>
    </div>
  </section>` : "";

  const ctaTexts = getCityCtaTexts(getCityCtaVariant(s, city), cityName, "fr-CA");
  const sCta = `<section class="py-24 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
      <h2 class="text-3xl font-bold text-gray-900 mb-4">${esc(ctaTexts.headingPrefix)}<span class="gradient-text">${esc(ctaTexts.headingGradient)}</span></h2>
      <p class="text-lg text-gray-500 mb-10">
        Aucune carte de crédit requise. Votre première soumission professionnelle est gratuite.
      </p>
      <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
        ${esc(ctaTexts.button)}
        <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
      <p class="text-sm text-gray-400 mt-4">Soumission prête en 30 secondes &middot; Sans engagement</p>
    </div>
  </section>`;

  return wrapInPublicLayoutFr(`<div class="flex flex-col min-h-screen bg-white">
  ${breadcrumb}
  ${sHero}
  ${sOsservatorio}
  ${sBenefits}
  ${sHowItWorks}
  ${sUseCases}
  ${sFaq}
  ${sQuantoCosta}
  ${sContext}
  ${sNearby}
  ${sSameCityOther}
  ${sCta}
</div>`);
}

// ─── Main execution ─────────────────────────────────────────────────────────

const template = pruneModulepreload(readFileSync(templatePath, "utf-8"));

// Phase 68: "/", "/fr" and the six static pages (about, contact, privacy,
// terms, WhatsApp, sitemap) are rendered by the real React tree — built with
// `vite build --ssr src/entry-server.tsx --outDir dist/server`, see the
// `build` script — and hydrated by main.tsx, so the hero paints from HTML and
// crawlers see the same DOM users get (the hand-written bodies this replaced
// had drifted to the pre-redesign layout). React 19 hoists <title>/<meta>/
// <link> to the front of the string; the head is authored by buildHeadBlock()
// here, so those are stripped.
const ssrEntry = join(__dirname, "../dist/server/entry-server.js");
if (!existsSync(ssrEntry)) {
  console.error("dist/server/entry-server.js not found — run `vite build --ssr src/entry-server.tsx --outDir dist/server` first");
  process.exit(1);
}
const { renderPage } = (await import(pathToFileURL(ssrEntry).href)) as { renderPage: (path: string, lang: "en" | "fr") => Promise<string> };
function stripHoistedHead(html: string): string {
  return html.replace(/^(?:\s*(?:<(?:link|meta)\b[^>]*\/?>|<title>[^<]*<\/title>))+/, "");
}
let count = 0;

console.log("Prerendering SEO pages...");

// Phase 1: Prerender homepage
const homepageWebSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "quoteai",
  url: BASE_URL,
  description: "AI-powered software for professional quotes in 30 seconds. Built for Canadian contractors, small businesses, and freelancers.",
  inLanguage: "en",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/quotes/{search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};
const homepageSoftwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "quoteai",
  description: "AI-powered quoting software for Canadian contractors, small businesses, and tradespeople.",
  url: `${BASE_URL}/`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "CAD", description: "Free trial available" },
  audience: { "@type": "BusinessAudience", audienceType: "Contractors, Small Businesses, Tradespeople, Freelancers" },
  inLanguage: "en",
  provider: { "@type": "Organization", name: "quoteai", url: BASE_URL },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: AGGREGATE_RATING.ratingValue,
    reviewCount: String(AGGREGATE_RATING.reviewCount),
    bestRating: "5",
    worstRating: "1",
  },
  review: TESTIMONIALS.map((t) => ({
    "@type": "Review",
    author: { "@type": "Person", name: t.name },
    reviewRating: { "@type": "Rating", ratingValue: String(t.rating), bestRating: "5", worstRating: "1" },
    reviewBody: testimonialText(t.key),
  })),
};
const homepageHeadBlock = buildHeadBlock({
  title: "quoteai – Online Quotes for Contractors & Trades | AI in 30s",
  description: "Create professional quotes in 30 seconds with AI. Quoting software for Canadian contractors, small businesses, and tradespeople. No more Excel, no more mistakes. Try it free.",
  canonical: `${BASE_URL}/`,
  ogImagePath: "/opengraph.jpg",
  jsonLd: [homepageWebSiteSchema, homepageSoftwareSchema],
  lang: "en",
  altUrl: `${BASE_URL}/fr/`,
});
const homepageHtml = injectAppPreload(injectBody(injectHead(template, homepageHeadBlock), stripHoistedHead(await renderPage("/", "en"))));
writeFileSync(templatePath, homepageHtml, "utf-8");
count++;
console.log("  ✓ Homepage prerendered");

// French homepage
const homepageWebSiteSchemaFr = {
  ...homepageWebSiteSchema,
  description: "Logiciel IA pour soumissions professionnelles en 30 secondes. Conçu pour les entrepreneurs, petites entreprises et travailleurs autonomes canadiens.",
  inLanguage: "fr",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${BASE_URL}/fr/soumissions/{search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};
const homepageSoftwareSchemaFr = {
  ...homepageSoftwareSchema,
  description: "Logiciel de soumission par IA pour les entrepreneurs, petites entreprises et artisans canadiens.",
  url: `${BASE_URL}/fr/`,
  offers: { "@type": "Offer", price: "0", priceCurrency: "CAD", description: "Essai gratuit disponible" },
  audience: { "@type": "BusinessAudience", audienceType: "Entrepreneurs, petites entreprises, artisans, travailleurs autonomes" },
  inLanguage: "fr",
};
const homepageHeadBlockFr = buildHeadBlock({
  title: "quoteai – Soumissions en ligne pour entrepreneurs | IA en 30s",
  description: "Créez des soumissions professionnelles en 30 secondes avec l'IA. Logiciel de soumission pour les entrepreneurs, petites entreprises et artisans canadiens. Essayez gratuitement.",
  canonical: `${BASE_URL}/fr/`,
  ogImagePath: "/opengraph.jpg",
  jsonLd: [homepageWebSiteSchemaFr, homepageSoftwareSchemaFr],
  lang: "fr",
  altUrl: `${BASE_URL}/`,
});
const homepageHtmlFr = injectAppPreload(injectBody(injectHead(template, homepageHeadBlockFr, "fr"), stripHoistedHead(await renderPage("/fr", "fr"))));
writeRoute("fr", homepageHtmlFr);
count++;
console.log("  ✓ French homepage prerendered");

// Phase 2–8: Sector + city pages
for (const [sectorSlug, sector] of Object.entries(SECTORS)) {
  // Phase 3A: deterministic title/desc variant via hash (not always [0])
  const titleHash = strHash(sectorSlug + "t");
  const title =
    sector.titleVariants.length > 0
      ? sector.titleVariants[titleHash % sector.titleVariants.length]
      : sector.titleTag;
  const descHash = strHash(sectorSlug + "d");
  const description =
    sector.descriptionVariants.length > 0
      ? sector.descriptionVariants[descHash % sector.descriptionVariants.length]
      : sector.metaDescription;

  const canonical = `${BASE_URL}/quotes/${sectorSlug}/`;
  const frCanonical = `${BASE_URL}/fr/soumissions/${sector.frSlug}/`;
  const jsonLd = buildSectorJsonLd(sector);
  const ogImagePath = ogImage(sectorSlug);

  const headBlock = buildHeadBlock({ title, description, canonical, ogImagePath, jsonLd, lang: "en", altUrl: frCanonical });
  const bodyHtml = buildSectorBodyHtml(sector);
  const html = injectBody(injectHead(template, headBlock), bodyHtml);
  writeRoute(`quotes/${sectorSlug}`, html);
  count++;

  // French sector page (every sector gets one)
  const frHeadBlock = buildHeadBlock({
    title: sector.fr.titleTag,
    description: sector.fr.metaDescription,
    canonical: frCanonical,
    ogImagePath,
    jsonLd: buildSectorJsonLdFr(sector),
    lang: "fr",
    altUrl: canonical,
  });
  const frBodyHtml = buildSectorBodyHtmlFr(sector);
  const frHtml = injectBody(injectHead(template, frHeadBlock, "fr"), frBodyHtml);
  writeRoute(`fr/soumissions/${sector.frSlug}`, frHtml);
  count++;

  if (!CITY_SECTORS.includes(sectorSlug)) continue;

  for (const city of ACTIVE_CITIES) {
    const isFrenchPrimaryCity = FRENCH_PRIMARY_CITY_SLUGS.includes(city.slug);
    const cityCanonical = `${BASE_URL}/quotes/${sectorSlug}/${city.slug}/`;
    const cityFrCanonical = `${BASE_URL}/fr/soumissions/${sector.frSlug}/${city.slug}/`;
    const cityTitle = getCityTitle(sector, city.name, city.slug);
    const cityDesc = getCityDesc(sector, city.name, city.slug, city.region);
    const cityJsonLd = buildCityJsonLd(sector, city);

    const cityHeadBlock = buildHeadBlock({
      title: cityTitle,
      description: cityDesc,
      canonical: cityCanonical,
      ogImagePath: ogImage(sectorSlug),
      jsonLd: cityJsonLd,
      lang: "en",
      altUrl: isFrenchPrimaryCity ? cityFrCanonical : undefined,
    });
    // Phase 68: the 210 city pages and the 23 blog pages were written without the site header/footer — in production they showed only the (Italian) nav shell and no footer.
    const cityBodyHtml = wrapInPublicLayout(buildCityBodyHtml(sector, city));
    const cityHtml = injectBody(injectHead(template, cityHeadBlock), cityBodyHtml);
    writeRoute(`quotes/${sectorSlug}/${city.slug}`, cityHtml);
    count++;

    // French city page — only for the French-primary Quebec cities (see
    // FRENCH_PRIMARY_CITY_SLUGS in seo-data.ts). Other cities stay
    // English-only for now; their hreflang tags above correctly omit fr-CA.
    if (!isFrenchPrimaryCity) continue;

    const cityTitleFr = getCityTitle(sector, city.name, city.slug, "fr-CA");
    const cityDescFr = getCityDesc(sector, city.name, city.slug, city.region, "fr-CA");
    const cityJsonLdFr = buildCityJsonLd(sector, city, "fr-CA");

    const cityHeadBlockFr = buildHeadBlock({
      title: cityTitleFr,
      description: cityDescFr,
      canonical: cityFrCanonical,
      ogImagePath: ogImage(sectorSlug),
      jsonLd: cityJsonLdFr,
      lang: "fr",
      altUrl: cityCanonical,
    });
    const cityBodyHtmlFr = buildCityBodyHtmlFr(sector, city);
    const cityHtmlFr = injectBody(injectHead(template, cityHeadBlockFr, "fr"), cityBodyHtmlFr);
    writeRoute(`fr/soumissions/${sector.frSlug}/${city.slug}`, cityHtmlFr);
    count++;
  }
}
console.log("  ✓ French sector + city pages prerendered");

// ─── Blog JSON-LD builders ───────────────────────────────────────────────────

function buildBlogListJsonLd(): object[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: BLOG_LIST_TITLE,
      description: BLOG_LIST_DESCRIPTION,
      url: `${BASE_URL}/blog/`,
      inLanguage: "en",
      publisher: {
        "@type": "Organization",
        name: "quoteai",
        url: BASE_URL,
        logo: { "@type": "ImageObject", url: `${BASE_URL}/icon-192.png`, width: 192, height: 192 },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog/` },
      ],
    },
  ];
}

function buildArticleJsonLd(article: BlogArticle, imagePath: string): object[] {
  const canonical = `${BASE_URL}/blog/${article.slug}/`;
  const imageUrl = imagePath.startsWith("http") ? imagePath : `${BASE_URL}${imagePath}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.metaDescription,
      image: [imageUrl],
      url: canonical,
      mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      inLanguage: "en",
      author: {
        "@type": "Organization",
        name: "quoteai",
        url: BASE_URL,
      },
      publisher: {
        "@type": "Organization",
        name: "quoteai",
        url: BASE_URL,
        logo: { "@type": "ImageObject", url: `${BASE_URL}/icon-192.png`, width: 192, height: 192 },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog/` },
        { "@type": "ListItem", position: 3, name: article.title, item: canonical },
      ],
    },
  ];
}

// ─── Blog list page body HTML ─────────────────────────────────────────────────

const BLOG_CATEGORY_STYLE: Record<string, string> = {
  Trades: "background:#f5f3ff;color:#6d28d9",
  Pricing: "background:#ecfeff;color:#0e7490",
  Advice: "background:#fffbeb;color:#d97706",
  Tools: "background:#f0fdf4;color:#15803d",
  Innovation: "background:#eff6ff;color:#1d4ed8",
  Business: "background:#fff1f2;color:#be123c",
};

function buildBlogListBodyHtml(): string {
  const breadcrumb = `<nav aria-label="Breadcrumb" class="bg-white border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
    <ol class="flex items-center text-sm text-gray-500 flex-wrap">
      <li><a href="/" class="hover:text-violet-600 transition-colors">Home</a></li>
      <li aria-hidden="true" class="mx-1.5 text-gray-300 select-none">/</li>
      <li class="text-gray-900 font-medium" aria-current="page">Blog</li>
    </ol>
  </div>
</nav>`;

  const hero = `<section class="bg-white pt-16 pb-12 border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
    <div class="inline-flex items-center gap-2 rounded-full bg-violet-100 border border-violet-200 px-4 py-1.5 text-sm font-medium text-violet-700 mb-6">
      Resources
    </div>
    <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl mb-4 leading-tight">
      Guides and advice for <span class="gradient-text">Canadian tradespeople</span>
    </h1>
    <p class="text-lg text-gray-500 max-w-2xl mx-auto">${esc(BLOG_LIST_DESCRIPTION)}</p>
  </div>
</section>`;

  const categoryLinks = BLOG_CATEGORIES.map((cat) => {
    const cs = BLOG_CATEGORY_STYLE[cat.name] ?? "background:#f3f4f6;color:#374151";
    return `<a href="/blog/categoria/${esc(cat.slug)}/" class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors" style="${cs}">${esc(cat.name)}</a>`;
  }).join("\n      ");

  const categoryStrip = `<section class="border-b border-gray-100 bg-white py-4">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
    <div class="flex flex-wrap gap-2 items-center">
      <span class="text-xs font-semibold uppercase tracking-wider mr-1" style="color:#9ca3af">Categories:</span>
      ${categoryLinks}
    </div>
  </div>
</section>`;

  const cards = BLOG_ARTICLES.map((a) => {
    const catStyle = BLOG_CATEGORY_STYLE[a.category] ?? "background:#f3f4f6;color:#374151";
    const dateStr = new Date(a.publishedAt).toLocaleDateString("en-CA", { day: "numeric", month: "long", year: "numeric" });
    return `<a href="/blog/${esc(a.slug)}/" class="group flex flex-col bg-white rounded-2xl border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all duration-200 overflow-hidden">
      <div class="p-6 flex flex-col flex-1">
        <div class="flex items-center justify-between mb-4">
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full" style="${catStyle}">${esc(a.category)}</span>
          <span class="text-xs text-gray-400">${a.readingTimeMin} min</span>
        </div>
        <h2 class="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-violet-700 transition-colors flex-1">${esc(a.title)}</h2>
        <p class="text-xs text-gray-500 leading-relaxed mb-4">${esc(a.metaDescription.slice(0, 130))}...</p>
        <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
          <time class="text-xs text-gray-400" datetime="${a.publishedAt}">${dateStr}</time>
          <span class="text-xs font-semibold text-violet-600">Read →</span>
        </div>
      </div>
    </a>`;
  }).join("\n    ");

  const grid = `<section class="py-14">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      ${cards}
    </div>
  </div>
</section>`;

  const cta = `<section class="py-16 bg-gray-50 border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
    <h2 class="text-2xl font-bold text-gray-900 mb-3">
      Ready to create quotes in <span class="gradient-text">30 seconds</span>?
    </h2>
    <p class="text-gray-500 mb-8 text-sm">No credit card. No commitment. Your first quote is free.</p>
    <a href="/sign-up/" class="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold">
      Get Started Free
    </a>
  </div>
</section>`;

  return `<div class="flex flex-col min-h-screen bg-white">
  ${breadcrumb}
  ${hero}
  ${categoryStrip}
  ${grid}
  ${cta}
</div>`;
}

// ─── Blog article page body HTML ──────────────────────────────────────────────

function buildBlogArticleBodyHtml(article: BlogArticle): string {
  const breadcrumb = `<nav aria-label="Breadcrumb" class="bg-white border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
    <ol class="flex items-center text-sm text-gray-500 flex-wrap">
      <li><a href="/" class="hover:text-violet-600 transition-colors">Home</a></li>
      <li aria-hidden="true" class="mx-1.5 text-gray-300 select-none">/</li>
      <li><a href="/blog/" class="hover:text-violet-600 transition-colors">Blog</a></li>
      <li aria-hidden="true" class="mx-1.5 text-gray-300 select-none">/</li>
      <li class="text-gray-900 font-medium truncate max-w-[200px]" aria-current="page">${esc(article.title)}</li>
    </ol>
  </div>
</nav>`;

  const catStyle = BLOG_CATEGORY_STYLE[article.category] ?? "background:#f3f4f6;color:#374151";
  const dateStr = new Date(article.publishedAt).toLocaleDateString("en-CA", { day: "numeric", month: "long", year: "numeric" });

  const header = `<header style="background:linear-gradient(135deg,rgba(124,58,237,0.04),rgba(6,182,212,0.04))" class="pt-14 pb-10 border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <div class="flex items-center gap-3 mb-5">
      <span class="text-xs font-semibold px-2.5 py-1 rounded-full" style="${catStyle}">${esc(article.category)}</span>
      <span class="text-xs text-gray-400">${article.readingTimeMin} min read</span>
      <time class="text-xs text-gray-400" datetime="${article.publishedAt}">${dateStr}</time>
    </div>
    <h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl leading-tight mb-4">${esc(article.title)}</h1>
    <p class="text-base text-gray-500 leading-relaxed">${esc(article.metaDescription)}</p>
  </div>
</header>`;

  const toc = extractToc(article.contentHtml);
  const bodyHtml = injectHeadingIds(article.contentHtml);

  const tocHtml = toc.length >= 2
    ? `<nav aria-label="Table of contents" class="mb-10 rounded-xl border border-violet-100 px-6 py-5" style="background:rgba(124,58,237,0.04)">
  <p class="text-xs font-bold uppercase tracking-wider mb-3" style="color:#7c3aed">Table of contents</p>
  <ol class="space-y-1.5">
    ${toc.map((item) => `<li${item.level === 3 ? ' class="pl-4"' : ""}>
      <a href="#${item.id}" class="text-sm text-gray-700 hover:text-violet-700 transition-colors leading-snug">${item.level === 3 ? '<span class="mr-1 text-gray-400">–</span>' : ""}${esc(item.text)}</a>
    </li>`).join("\n    ")}
  </ol>
</nav>`
    : "";

  const body = `<div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl py-10">
  ${tocHtml}
  <div class="prose prose-gray prose-headings:font-bold prose-h2:text-xl prose-h3:text-base prose-p:leading-relaxed prose-li:leading-relaxed prose-a:text-violet-600 max-w-none">
    ${bodyHtml}
  </div>
</div>`;

  const relatedSectorLinks = article.relatedSectors.map((sectorSlug) => {
    const sector = SECTORS[sectorSlug];
    if (!sector) return "";
    return `<a href="/quotes/${esc(sectorSlug)}/" class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:border-violet-300 hover:text-violet-700 transition-colors">
      <span class="text-violet-400 font-bold">→</span> ${esc(sector.label)} quotes
    </a>`;
  }).filter(Boolean).join("\n    ");

  const relatedSectorsSection = relatedSectorLinks ? `<section class="border-t border-gray-100 bg-gray-50 py-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <h2 class="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Quotes by trade</h2>
    <div class="flex flex-wrap gap-3">
      ${relatedSectorLinks}
    </div>
  </div>
</section>` : "";

  const geoSectorSlug = article.relatedSectors.find((slug) => CITY_SECTORS.includes(slug));
  const geoSector = geoSectorSlug ? SECTORS[geoSectorSlug] : undefined;
  const citySection = geoSector ? `<section class="border-t border-gray-100 bg-white py-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <h2 class="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">${esc(geoSector.labelPlural)} quotes in your city</h2>
    <div class="flex flex-wrap gap-3">
      ${ACTIVE_CITIES
        .map(
          (city) =>
            `<a href="/quotes/${esc(geoSector.slug)}/${esc(city.slug)}/" class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:border-violet-300 hover:text-violet-700 transition-colors">
        <span class="text-violet-400 font-bold">→</span> ${esc(city.name)}
      </a>`
        )
        .join("\n      ")}
    </div>
  </div>
</section>` : "";

  const relatedArticles = BLOG_ARTICLES.filter(
    (a) => a.slug !== article.slug &&
      (a.relatedSectors.some((s) => article.relatedSectors.includes(s)) ||
        a.category === article.category)
  ).slice(0, 3);

  const relatedCards = relatedArticles.map((a) => {
    const cs = BLOG_CATEGORY_STYLE[a.category] ?? "background:#f3f4f6;color:#374151";
    return `<a href="/blog/${esc(a.slug)}/" class="group flex flex-col bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all p-4">
      <span class="text-xs font-semibold px-2 py-0.5 rounded-full self-start mb-2" style="${cs}">${esc(a.category)}</span>
      <span class="text-xs font-semibold text-gray-800 group-hover:text-violet-700 transition-colors leading-snug">${esc(a.title)}</span>
    </a>`;
  }).join("\n    ");

  const relatedArticlesSection = relatedCards ? `<section class="py-12 border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <h2 class="text-lg font-bold text-gray-900 mb-6">Related articles</h2>
    <div class="grid sm:grid-cols-3 gap-4">
      ${relatedCards}
    </div>
  </div>
</section>` : "";

  const cta = `<section class="py-16 border-t border-violet-100/60" style="background:linear-gradient(135deg,rgba(124,58,237,0.04),rgba(6,182,212,0.04))">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
    <h2 class="text-2xl font-bold text-gray-900 mb-3">
      Ready to create quotes in <span class="gradient-text">30 seconds</span>?
    </h2>
    <p class="text-gray-500 mb-8 text-sm">No credit card. No commitment. Your first quote is free.</p>
    <a href="/sign-up/" class="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold">
      Get Started Free
      <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
    </a>
  </div>
</section>`;

  return `<div class="flex flex-col min-h-screen bg-white">
  ${breadcrumb}
  <article class="flex-1">
    ${header}
    ${body}
    ${relatedSectorsSection}
    ${citySection}
    ${relatedArticlesSection}
  </article>
  ${cta}
</div>`;
}

// ─── Blog JSON-LD builder for category pages ──────────────────────────────────

function buildBlogCategoryJsonLd(category: BlogCategory): object[] {
  const canonical = `${BASE_URL}/blog/categoria/${category.slug}/`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${category.name} — Blog quoteai`,
      description: category.description,
      url: canonical,
      inLanguage: "en",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog/` },
        { "@type": "ListItem", position: 3, name: category.name, item: canonical },
      ],
    },
  ];
}

// ─── Blog category page body HTML ─────────────────────────────────────────────

const BLOG_CATEGORY_COLOR_STYLE: Record<string, string> = {
  Trades: "background:#f5f3ff;color:#6d28d9",
  Pricing: "background:#ecfeff;color:#0e7490",
  Advice: "background:#fffbeb;color:#d97706",
  Tools: "background:#f0fdf4;color:#15803d",
  Innovation: "background:#eff6ff;color:#1d4ed8",
  Business: "background:#fff1f2;color:#be123c",
};

function buildBlogCategoryBodyHtml(category: BlogCategory): string {
  const articles = getArticlesByCategory(category.name);
  const catStyle = BLOG_CATEGORY_COLOR_STYLE[category.name] ?? "background:#f3f4f6;color:#374151";

  const breadcrumb = `<nav aria-label="Breadcrumb" class="bg-white border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
    <ol class="flex items-center text-sm text-gray-500 flex-wrap">
      <li><a href="/" class="hover:text-violet-600 transition-colors">Home</a></li>
      <li aria-hidden="true" class="mx-1.5 text-gray-300 select-none">/</li>
      <li><a href="/blog/" class="hover:text-violet-600 transition-colors">Blog</a></li>
      <li aria-hidden="true" class="mx-1.5 text-gray-300 select-none">/</li>
      <li class="text-gray-900 font-medium" aria-current="page">${esc(category.name)}</li>
    </ol>
  </div>
</nav>`;

  const hero = `<section style="background:linear-gradient(135deg,rgba(124,58,237,0.06),rgba(6,182,212,0.04))" class="pt-14 pb-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
    <span class="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold mb-5" style="${catStyle}">${esc(category.name)}</span>
    <h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl mb-3 leading-tight">
      Articles on <span class="gradient-text">${esc(category.name)}</span>
    </h1>
    <p class="text-base text-gray-500 leading-relaxed max-w-2xl mx-auto">${esc(category.description)}</p>
    <p class="text-xs text-gray-400 mt-3">${articles.length} ${articles.length === 1 ? "article" : "articles"}</p>
  </div>
</section>`;

  const cards = articles.map((a) => {
    const cs = BLOG_CATEGORY_COLOR_STYLE[a.category] ?? "background:#f3f4f6;color:#374151";
    const dateStr = new Date(a.publishedAt).toLocaleDateString("en-CA", { day: "numeric", month: "long", year: "numeric" });
    return `<a href="/blog/${esc(a.slug)}/" class="group flex flex-col bg-white rounded-2xl border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all duration-200 overflow-hidden">
      <div class="p-6 flex flex-col flex-1">
        <div class="flex items-center justify-between mb-4">
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full" style="${cs}">${esc(a.category)}</span>
          <span class="text-xs text-gray-400">${a.readingTimeMin} min</span>
        </div>
        <h2 class="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-violet-700 transition-colors flex-1">${esc(a.title)}</h2>
        <p class="text-xs text-gray-500 leading-relaxed mb-4">${esc(a.metaDescription.slice(0, 130))}...</p>
        <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
          <time class="text-xs text-gray-400" datetime="${a.publishedAt}">${dateStr}</time>
          <span class="text-xs font-semibold text-violet-600">Read →</span>
        </div>
      </div>
    </a>`;
  }).join("\n    ");

  const grid = articles.length > 0
    ? `<section class="py-12">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      ${cards}
    </div>
  </div>
</section>`
    : `<section class="py-20 text-center text-gray-400">
  <p class="text-lg font-medium">No articles in this category yet.</p>
  <a href="/blog/" class="mt-6 inline-block text-violet-600 text-sm font-semibold">Back to the Blog →</a>
</section>`;

  const otherCats = BLOG_CATEGORIES.filter((c) => c.slug !== category.slug);
  const catLinks = otherCats.map((c) => {
    const cs = BLOG_CATEGORY_COLOR_STYLE[c.name] ?? "background:#f3f4f6;color:#374151";
    return `<a href="/blog/categoria/${esc(c.slug)}/" class="inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold transition-colors" style="${cs}">${esc(c.name)}</a>`;
  }).join("\n      ");

  const otherCatsSection = `<section class="py-10 bg-gray-50 border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
    <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">Other categories</h2>
    <div class="flex flex-wrap gap-3">
      ${catLinks}
    </div>
  </div>
</section>`;

  const cta = `<section class="py-16 bg-white border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
    <h2 class="text-2xl font-bold text-gray-900 mb-3">
      Ready to create quotes in <span class="gradient-text">30 seconds</span>?
    </h2>
    <p class="text-gray-500 mb-8 text-sm">No credit card. No commitment. Your first quote is free.</p>
    <a href="/sign-up/" class="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold">
      Get Started Free
    </a>
  </div>
</section>`;

  return `<div class="flex flex-col min-h-screen bg-white">
  ${breadcrumb}
  ${hero}
  ${grid}
  ${otherCatsSection}
  ${cta}
</div>`;
}

// ─── Blog prerendering ────────────────────────────────────────────────────────

// Blog list page
const blogListHeadBlock = buildHeadBlock({
  title: BLOG_LIST_TITLE,
  description: BLOG_LIST_DESCRIPTION,
  canonical: `${BASE_URL}/blog/`,
  ogImagePath: "/opengraph.jpg",
  jsonLd: buildBlogListJsonLd(),
});
const blogListHtml = injectBody(injectHead(template, blogListHeadBlock), wrapInPublicLayout(buildBlogListBodyHtml()));
writeRoute("blog", blogListHtml);
count++;
console.log("  ✓ Blog list page prerendered");

// Blog category pages
for (const category of BLOG_CATEGORIES) {
  const categoryCanonical = `${BASE_URL}/blog/categoria/${category.slug}/`;
  const categoryHeadBlock = buildHeadBlock({
    title: `${category.name} — Blog quoteai`,
    description: category.description,
    canonical: categoryCanonical,
    ogImagePath: "/opengraph.jpg",
    jsonLd: buildBlogCategoryJsonLd(category),
  });
  const categoryHtml = injectBody(injectHead(template, categoryHeadBlock), wrapInPublicLayout(buildBlogCategoryBodyHtml(category)));
  writeRoute(`blog/categoria/${category.slug}`, categoryHtml);
  count++;
}
console.log(`  ✓ ${BLOG_CATEGORIES.length} blog category pages prerendered`);

// Individual blog articles
for (const article of BLOG_ARTICLES) {
  const articleCanonical = `${BASE_URL}/blog/${article.slug}/`;
  const articleOgImage = `/og/blog/${article.slug}.png`;
  const articleHeadBlock = buildHeadBlock({
    title: `${article.seoTitle ?? article.title} | quoteai`,
    description: article.metaDescription,
    canonical: articleCanonical,
    ogImagePath: articleOgImage,
    jsonLd: buildArticleJsonLd(article, articleOgImage),
  });
  const articleHtml = injectBody(injectHead(template, articleHeadBlock), wrapInPublicLayout(buildBlogArticleBodyHtml(article)));
  writeRoute(`blog/${article.slug}`, articleHtml);
  count++;
}
console.log(`  ✓ ${BLOG_ARTICLES.length} blog articles prerendered`);

// ─── Static SPA pages prerender (bodies from entry-server.tsx, see above) ───

function buildBreadcrumbJsonLd(name: string, path: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
      { "@type": "ListItem", position: 2, name, item: `${BASE_URL}${path}` },
    ],
  };
}

function buildWebPageJsonLd(name: string, description: string, path: string, type = "WebPage"): object {
  return {
    "@context": "https://schema.org",
    "@type": type,
    name,
    description,
    url: `${BASE_URL}${path}`,
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", name: "quoteai", url: BASE_URL },
  };
}

async function buildStaticPageHtml(opts: {
  slug: string;
  title: string;
  description: string;
  path: string;
  jsonLd: object[];
  bodyHtml: string;
  ogImagePath?: string;
}): Promise<void> {
  const headBlock = buildHeadBlock({
    title: opts.title,
    description: opts.description,
    canonical: `${BASE_URL}${opts.path}`,
    ogImagePath: opts.ogImagePath ?? "/opengraph.jpg",
    jsonLd: opts.jsonLd,
  });
  const html = injectAppPreload(injectBody(injectHead(template, headBlock), opts.bodyHtml));
  writeRoute(opts.slug, html);
  count++;
}

// /chi-siamo/
const chiSiamoOrgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "quoteai",
  url: `${BASE_URL}/`,
  logo: `${BASE_URL}/icon-192.png`,
  description: "quoteai is the AI quoting software for Canadian contractors and tradespeople. Generate professional quotes in 30 seconds by describing the job in plain English.",
  foundingDate: "2026",
  foundingLocation: { "@type": "Place", name: "Canada" },
  contactPoint: {
    "@type": "ContactPoint",
    email: "info@quoteai.ca",
    contactType: "customer service",
    availableLanguage: "en",
  },
};
await buildStaticPageHtml({
  slug: "chi-siamo",
  title: "About Us | quoteai — AI Quoting Software for Contractors",
  description: "quoteai exists to free Canadian tradespeople from paperwork. Learn our mission: professional quotes in 30 seconds thanks to AI.",
  path: "/chi-siamo/",
  jsonLd: [chiSiamoOrgJsonLd, buildBreadcrumbJsonLd("About Us", "/chi-siamo/")],
  bodyHtml: stripHoistedHead(await renderPage("/chi-siamo", "en")),
});

// /contatti/
const contattiJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact quoteai",
  url: `${BASE_URL}/contatti/`,
  description: "Contact the quoteai team for support, product questions, or sales inquiries.",
  mainEntity: {
    "@type": "Organization",
    name: "quoteai",
    url: `${BASE_URL}/`,
    email: "info@quoteai.ca",
    contactPoint: [
      { "@type": "ContactPoint", email: "info@quoteai.ca", contactType: "customer support", availableLanguage: "en" },
      { "@type": "ContactPoint", email: "privacy@quoteai.ca", contactType: "privacy inquiries", availableLanguage: "en" },
    ],
  },
};
await buildStaticPageHtml({
  slug: "contatti",
  title: "Contact | quoteai — Help and Support",
  description: "Have questions about quoteai? Contact us by email or WhatsApp. We're here to help you generate professional quotes faster.",
  path: "/contatti/",
  jsonLd: [contattiJsonLd, buildBreadcrumbJsonLd("Contact", "/contatti/")],
  bodyHtml: stripHoistedHead(await renderPage("/contatti", "en")),
});

// /privacy-policy/ — mirrors src/pages/privacy-policy.tsx (the real live route)
await buildStaticPageHtml({
  slug: "privacy-policy",
  title: "Privacy Policy | QuoteAI",
  description: "QuoteAI's privacy policy — how we collect, use, and protect your personal information.",
  path: "/privacy-policy/",
  jsonLd: [buildWebPageJsonLd("Privacy Policy", "QuoteAI's privacy policy — how we collect, use, and protect your personal information.", "/privacy-policy/"), buildBreadcrumbJsonLd("Privacy Policy", "/privacy-policy/")],
  bodyHtml: stripHoistedHead(await renderPage("/privacy-policy", "en")),
});

// /terms/ — mirrors src/pages/terms.tsx (the real live route)
await buildStaticPageHtml({
  slug: "terms",
  title: "Terms of Service | QuoteAI",
  description: "Terms and conditions for using the QuoteAI platform to generate AI-powered quotes.",
  path: "/terms/",
  jsonLd: [buildWebPageJsonLd("Terms of Service", "Terms and conditions for using the QuoteAI platform to generate AI-powered quotes.", "/terms/"), buildBreadcrumbJsonLd("Terms of Service", "/terms/")],
  bodyHtml: stripHoistedHead(await renderPage("/terms", "en")),
});

// /whatsapp/
await buildStaticPageHtml({
  slug: "whatsapp",
  title: "Quotes on WhatsApp – quoteai | AI-Powered Quoting",
  description: "Describe the job by voice, text, or photo on WhatsApp. quoteai generates a professional quote with a PDF in 60 seconds.",
  path: "/whatsapp/",
  jsonLd: [buildWebPageJsonLd("Quotes on WhatsApp", "Describe the job by voice, text, or photo on WhatsApp. quoteai generates a professional quote with a PDF in 60 seconds.", "/whatsapp/"), buildBreadcrumbJsonLd("WhatsApp", "/whatsapp/")],
  bodyHtml: stripHoistedHead(await renderPage("/whatsapp", "en")),
});

// /mappa-sito/
await buildStaticPageHtml({
  slug: "mappa-sito",
  title: "Site Map | quoteai — Full Page Index",
  description: "The complete site map for quoteai. Find every static page, blog article, and guide for contractors and tradespeople across Canadian cities.",
  path: "/mappa-sito/",
  jsonLd: [buildWebPageJsonLd("Site Map", "The complete site map for quoteai.ca. Find every static page, blog article, and guide for contractors and tradespeople across Canadian cities.", "/mappa-sito/"), buildBreadcrumbJsonLd("Site Map", "/mappa-sito/")],
  bodyHtml: stripHoistedHead(await renderPage("/mappa-sito", "en")),
});

console.log(`  ✓ 6 SPA pages prerendered (chi-siamo, contatti, privacy-policy, terms, whatsapp, mappa-sito)`);

// Phase 70: help centre — index + one page per article, rendered by the same
// React tree (the page's own SeoHead title/description are what the head
// block repeats here; keep them identical so crawler and hydrated DOM agree).
const helpIndexTitle = translations.en["help.seoTitle"];
const helpIndexDescription = translations.en["help.seoDescription"];
await buildStaticPageHtml({
  slug: "help",
  title: helpIndexTitle,
  description: helpIndexDescription,
  path: "/help/",
  jsonLd: [buildWebPageJsonLd("Help Centre", helpIndexDescription, "/help/", "CollectionPage"), buildBreadcrumbJsonLd("Help centre", "/help/")],
  bodyHtml: stripHoistedHead(await renderPage("/help", "en")),
});
for (const article of HELP_ARTICLES) {
  const path = `/help/${article.slug}/`;
  await buildStaticPageHtml({
    slug: `help/${article.slug}`,
    title: `${article.title.en} | quoteai`,
    description: article.summary.en,
    path,
    jsonLd: [
      buildWebPageJsonLd(article.title.en, article.summary.en, path, "TechArticle"),
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Help centre", item: `${BASE_URL}/help/` },
          { "@type": "ListItem", position: 3, name: article.title.en, item: `${BASE_URL}${path}` },
        ],
      },
    ],
    bodyHtml: stripHoistedHead(await renderPage(`/help/${article.slug}`, "en")),
  });
}
console.log(`  ✓ ${HELP_ARTICLES.length + 1} help-centre pages prerendered`);

console.log(`Prerendered ${count} pages total (1 homepage + SEO sector pages + ${BLOG_CATEGORIES.length} category pages + ${BLOG_ARTICLES.length + 1} blog pages + 6 SPA pages + ${HELP_ARTICLES.length + 1} help pages).`);
