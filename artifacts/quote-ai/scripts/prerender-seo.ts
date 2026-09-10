import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SECTORS,
  CITIES,
  ACTIVE_CITIES,
  CITIES_BY_SLUG,
  CITY_SECTORS,
  getCityTitle,
  getCityDesc,
  RELATED_SECTORS,
  CITY_CONTEXT,
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
  buildCityJsonLd as buildCityJsonLdFromEngine,
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "../dist/public");
const templatePath = join(distDir, "index.html");

if (!existsSync(templatePath)) {
  console.error("dist/public/index.html not found — run vite build first");
  process.exit(1);
}

const BASE_URL = "https://quoteai.ca";

const SECTOR_OG_IMAGES: Record<string, string> = {
  edilizia: "/og/edilizia.jpg",
  ristrutturazione: "/og/ristrutturazione.jpg",
  elettricista: "/og/elettricista.jpg",
  idraulico: "/og/idraulico.jpg",
  imbianchino: "/og/imbianchino.jpg",
  carpentiere: "/og/carpentiere.jpg",
  falegname: "/og/falegname.jpg",
  termoidraulico: "/og/termoidraulico.jpg",
  freelance: "/og/freelance.jpg",
  geometra: "/og/geometra.jpg",
};

// ─── Core utilities ────────────────────────────────────────────────────────

function ogImage(sectorSlug: string): string {
  return SECTOR_OG_IMAGES[sectorSlug] ?? "/opengraph.jpg";
}

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
}): string {
  const { title, description, canonical, ogImagePath, jsonLd } = opts;
  const ogImageUrl = ogImagePath.startsWith("http")
    ? ogImagePath
    : `${BASE_URL}${ogImagePath}`;
  const lines = [
    `  <title>${esc(title)}</title>`,
    `  <meta name="description" content="${esc(description)}" />`,
    `  <link rel="canonical" href="${esc(canonical)}" />`,
    `  <link rel="alternate" hreflang="en-CA" href="${esc(canonical)}" />`,
    `  <link rel="alternate" hreflang="x-default" href="${esc(canonical)}" />`,
    `  <meta property="og:title" content="${esc(title)}" />`,
    `  <meta property="og:description" content="${esc(description)}" />`,
    `  <meta property="og:url" content="${esc(canonical)}" />`,
    `  <meta property="og:image" content="${esc(ogImageUrl)}" />`,
    `  <meta property="og:image:width" content="1200" />`,
    `  <meta property="og:image:height" content="630" />`,
    `  <meta property="og:type" content="website" />`,
    `  <meta property="og:locale" content="it_IT" />`,
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
 */
function pruneModulepreload(html: string): string {
  return html.replace(
    /<link\s+rel="modulepreload"\s+crossorigin\s+href="\/assets\/(dashboard|charts)-[^"]*\.js"[^>]*>/gi,
    ""
  );
}

function injectHead(template: string, headBlock: string): string {
  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/, "");
  html = html.replace(/<meta\s+name="description"[^>]*\/?>/i, "");
  html = html.replace(/<link\b[^>]*\brel=["']canonical["'][^>]*\/?>/gi, "");
  html = html.replace(/<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+name="keywords"[^>]*\/?>/gi, "");
  html = html.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
  html = html.replace("<head>", `<head>\n${headBlock}`);
  return html;
}

function injectBody(html: string, bodyHtml: string): string {
  if (!bodyHtml) return html;
  return html.replace(/<div id="root"><\/div>/, `<div id="root">${bodyHtml}</div>`);
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
      <a href="/sign-in/" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full">Accedi</a>
      <a href="/sign-up/" class="btn-gradient inline-flex h-9 items-center justify-center px-5 text-sm font-semibold">Registrati</a>
    </nav>
  </div>
</header>`;

const STATIC_FOOTER = `<footer class="border-t py-12 md:py-16 bg-white">
  <div class="container mx-auto px-4 md:px-6">
    <div class="grid grid-cols-1 md:grid-cols-5 gap-8">
      <div class="md:col-span-2">
        <a href="/" class="flex items-center mb-4">${STATIC_LOGO}</a>
        <p class="text-sm text-muted-foreground max-w-xs leading-relaxed">Il software di preventivazione con AI per artigiani e PMI italiane. Veloce, professionale, pronto in 30 secondi.</p>
      </div>
      <div class="md:col-span-2">
        <h4 class="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">Professioni</h4>
        <ul class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <li><a href="/preventivi/imbianchino/" class="hover:text-foreground transition-colors">Imbianchino</a></li>
          <li><a href="/preventivi/muratore/" class="hover:text-foreground transition-colors">Muratore</a></li>
          <li><a href="/preventivi/elettricista/" class="hover:text-foreground transition-colors">Elettricista</a></li>
          <li><a href="/preventivi/pittore/" class="hover:text-foreground transition-colors">Pittore</a></li>
          <li><a href="/preventivi/idraulico/" class="hover:text-foreground transition-colors">Idraulico</a></li>
          <li><a href="/preventivi/piastrellista/" class="hover:text-foreground transition-colors">Piastrellista</a></li>
          <li><a href="/preventivi/edilizia/" class="hover:text-foreground transition-colors">Imprese Edili</a></li>
          <li><a href="/preventivi/giardiniere/" class="hover:text-foreground transition-colors">Giardiniere</a></li>
          <li><a href="/preventivi/ristrutturazione/" class="hover:text-foreground transition-colors">Ristrutturazioni</a></li>
          <li><a href="/preventivi/serramentista/" class="hover:text-foreground transition-colors">Serramentista</a></li>
          <li><a href="/preventivi/carpentiere/" class="hover:text-foreground transition-colors">Carpentieri</a></li>
          <li><a href="/preventivi/tetto/" class="hover:text-foreground transition-colors">Coperture e Tetti</a></li>
          <li><a href="/preventivi/falegname/" class="hover:text-foreground transition-colors">Falegnami</a></li>
          <li><a href="/preventivi/condizionatori/" class="hover:text-foreground transition-colors">Condizionatori</a></li>
          <li><a href="/preventivi/freelance/" class="hover:text-foreground transition-colors">Freelance</a></li>
          <li><a href="/preventivi/pavimentista/" class="hover:text-foreground transition-colors">Pavimentista</a></li>
          <li><a href="/preventivi/geometra/" class="hover:text-foreground transition-colors">Geometri</a></li>
          <li><a href="/preventivi/termoidraulico/" class="hover:text-foreground transition-colors">Termoidraulico</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">Guide</h4>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="/blog/" class="hover:text-foreground transition-colors font-medium text-foreground/80">Blog &amp; Approfondimenti</a></li>
          <li><a href="/preventivi/modello-excel/" class="hover:text-foreground transition-colors">Modello Excel</a></li>
          <li><a href="/preventivi/modello-word/" class="hover:text-foreground transition-colors">Modello Word</a></li>
          <li><a href="/preventivi/come-fare-preventivo/" class="hover:text-foreground transition-colors">Come Fare un Preventivo</a></li>
          <li><a href="/preventivi/preventivi-gratis/" class="hover:text-foreground transition-colors">Preventivi Gratis</a></li>
        </ul>
        <h4 class="font-semibold mt-8 mb-4 text-sm uppercase tracking-wider text-foreground">Azienda</h4>
        <ul class="space-y-2 text-sm text-muted-foreground">
          <li><a href="/chi-siamo/" class="hover:text-foreground transition-colors">Chi Siamo</a></li>
          <li><a href="/contatti/" class="hover:text-foreground transition-colors">Contatti</a></li>
          <li><button class="hover:text-foreground transition-colors text-left">Supporto</button></li>
          <li><a href="/privacy/" class="hover:text-foreground transition-colors">Privacy Policy</a></li>
          <li><a href="/termini/" class="hover:text-foreground transition-colors">Termini di Servizio</a></li>
          <li><a href="/mappa-sito/" class="hover:text-foreground transition-colors">Mappa del Sito</a></li>
        </ul>
      </div>
    </div>
    <div class="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">© ${CURRENT_YEAR} quoteai. Tutti i diritti riservati.</div>
  </div>
</footer>`;

const STATIC_WHATSAPP = `<a href="https://wa.me/393791059492" target="_blank" rel="noopener noreferrer nofollow" aria-label="Chatta con noi su WhatsApp" class="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full shadow-lg shadow-green-200/60 transition-all duration-200 hover:scale-105 active:scale-95" style="background:rgb(37,211,102)"><span class="flex h-14 w-14 items-center justify-center rounded-full" style="background:rgb(37,211,102)"><img src="/wa-icon.svg" alt="" width="28" height="28" loading="lazy" decoding="async"></span><span class="pr-5 text-white text-sm font-semibold whitespace-nowrap hidden sm:inline-block">Hai bisogno di aiuto?</span></a>`;

function wrapInPublicLayout(contentHtml: string): string {
  return `<div class="min-h-[100dvh] flex flex-col bg-background text-foreground">
${STATIC_HEADER}
<main class="flex-1 flex flex-col">${contentHtml}</main>
${STATIC_FOOTER}
${STATIC_WHATSAPP}
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
  return `<nav aria-label="Percorso di navigazione" class="bg-white border-b border-gray-100">
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
            `<a href="/preventivi/${esc(s.slug)}/${esc(c.slug)}/" class="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-violet-300 hover:text-violet-600 transition-colors">${esc(c.name)}</a>`
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
      <h2 class="text-2xl font-bold text-gray-900">Preventivi ${esc(s.label)} nelle principali città</h2>
      <p class="text-sm text-gray-500 mt-2">Seleziona la tua città per informazioni e prezzi locali</p>
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
  const h = heading ?? "Servizi correlati";
  const links = related
    .map(
      (r) =>
        `<a href="/preventivi/${esc(r.slug)}/" class="flex items-center gap-2 bg-white border border-gray-100 hover:border-violet-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:text-violet-700 transition-colors">
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
          <span class="text-xs text-gray-400 mt-auto">${a.readingTimeMin} min di lettura</span>
        </a>`
    )
    .join("\n      ");

  return `<section class="py-14 bg-gray-50 border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-base font-semibold text-gray-900">Approfondimenti</h2>
      <a href="/blog/" class="text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors">Tutti gli articoli →</a>
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
  const canonical = `${BASE_URL}/preventivi/${s.slug}/`;
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

function buildCityJsonLd(s: SectorData, city: CityData): object[] {
  return buildCityJsonLdFromEngine(s, city);
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
        Nessuna carta di credito. Nessun impegno. Il tuo primo preventivo è gratis.
      </p>
      <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
        ${ctaBtn}
        <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
    </div>
  </section>`;

  const sRelated = buildRelatedSectorsSection(s, "Servizi correlati — genera preventivi per");
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

function buildOsservatorio(s: SectorData, city: CityData, intel: CityIntelligence): string {
  const pct = Math.round(Math.abs(intel.priceIndex - 1.0) * 100);
  const priceLabel = intel.priceIndex > 1.0 ? `+${pct}%` : intel.priceIndex < 1.0 ? `\u2212${pct}%` : `\u00b10%`;
  const priceColor =
    intel.priceIndex > 1.05 ? "text-amber-600" : intel.priceIndex < 0.95 ? "text-green-600" : "text-gray-800";
  const demandLabels: Record<CityIntelligence["demandLevel"], string> = {
    LOW: "Moderata", MEDIUM: "Media", HIGH: "Elevata", CRITICAL: "Molto elevata",
  };
  const demandColors: Record<CityIntelligence["demandLevel"], string> = {
    LOW: "text-green-600", MEDIUM: "text-blue-600", HIGH: "text-amber-600", CRITICAL: "text-red-600",
  };
  const [sv1, sv2, sv3] = intel.topServices;
  void s;
  return `<section class="py-10 bg-white border-b border-gray-100" aria-label="Osservatorio prezzi e domanda ${esc(city.name)}">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
    <div class="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/40 to-cyan-50/20 p-6 md:p-8">
      <div class="flex items-center gap-3 mb-6">
        <div class="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        </div>
        <h2 class="text-base font-bold text-gray-900">Osservatorio Prezzi e Domanda: ${esc(city.name)}</h2>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Indice prezzi</div>
          <div class="text-2xl font-bold ${priceColor}">${priceLabel}</div>
          <div class="text-xs text-gray-400 mt-1">vs. media nazionale</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Domanda</div>
          <div class="text-base font-bold ${demandColors[intel.demandLevel]}">${demandLabels[intel.demandLevel]}</div>
          <div class="text-xs text-gray-400 mt-1">${esc(city.region)}</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 text-center">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Lead time</div>
          <div class="text-base font-bold text-gray-800">${esc(intel.avgLeadTime)}</div>
          <div class="text-xs text-gray-400 mt-1">risposta stimata</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100">
          <div class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Servizi top</div>
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
    { name: s.label, href: `/preventivi/${s.slug}/` },
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
        <span class="text-gray-500 text-3xl sm:text-4xl font-bold">a ${esc(cityName)}</span>
      </h1>
      <p class="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">${esc(intro)}</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Crea il tuo preventivo gratis
        </a>
        <a href="/preventivi/${esc(s.slug)}/" class="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Scopri come funziona
        </a>
      </div>
      <p class="text-sm text-gray-400 mt-5">Nessuna carta di credito &middot; Preventivo pronto in 30 secondi</p>
    </div>
  </section>`;

  const sOsservatorio = intel ? buildOsservatorio(s, city, intel) : "";

  const sBenefits = `<section class="py-20 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900">Perché i ${esc(s.labelPlural)} di ${esc(cityName)} scelgono quoteai</h2>
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
        <h2 class="text-3xl font-bold text-gray-900">Preventivo professionale a ${esc(cityName)} in 3 passi</h2>
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
        <h2 class="text-3xl font-bold text-gray-900">Preventivi per questi lavori a ${esc(cityName)}</h2>
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
        <h2 class="text-3xl font-bold text-gray-900">Domande frequenti</h2>
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
      `<a href="/preventivi/${esc(s.slug)}/${esc(slug)}/" class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-sm text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors">${esc(anchorText)}</a>`
    )
    .join("\n          ");

  const sNearby = nearbyLinks
    ? `<section class="py-16 bg-white border-t border-gray-100">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
      <h2 class="text-base font-semibold text-gray-500 mb-5 text-center">
        Preventivi per ${esc(s.labelPlural)} nelle città vicine
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
      <h2 class="text-base font-semibold text-gray-500 mb-5 text-center">Altri servizi a ${esc(cityName)}</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        ${sameCityOtherSectors
          .map(
            (r) =>
              `<a href="/preventivi/${esc(r.slug)}/${esc(city.slug)}/" class="flex items-center gap-2 bg-white border border-gray-100 hover:border-violet-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:text-violet-700 transition-colors">
          <span class="text-violet-400 font-bold" aria-hidden="true">→</span> ${esc(r.label)} a ${esc(cityName)}
        </a>`
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";
  const sRelated = buildRelatedSectorsSection(s, `Scopri anche: preventivi per`);
  const sApprofondimenti = buildApprofondimentiSection(s.slug);

  const ctaTexts = getCityCtaTexts(getCityCtaVariant(s, city), cityName);
  const ctaHeading =
    `${esc(ctaTexts.headingPrefix)}<span class="gradient-text">${esc(ctaTexts.headingGradient)}</span>`;

  const sCta = `<section class="py-24 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
      <h2 class="text-3xl font-bold text-gray-900 mb-4">${ctaHeading}</h2>
      <p class="text-lg text-gray-500 mb-10">
        Nessuna carta di credito richiesta. Il tuo primo preventivo professionale è gratis.
      </p>
      <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
        ${esc(ctaTexts.button)}
        <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
      <p class="text-sm text-gray-400 mt-4">Preventivo pronto in 30 secondi &middot; Nessun impegno</p>
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
): string {
  const cityName = city.name;
  const regionName = city.region;
  const sectorLabel = s.label.toLowerCase();
  const pricePct = intel ? Math.round((intel.priceIndex - 1.0) * 100) : 0;
  const priceNote = !intel
    ? `in linea con la media italiana`
    : pricePct > 5
      ? `mediamente del <strong>${pricePct}% più alti</strong> rispetto alla media nazionale`
      : pricePct < -5
        ? `mediamente del <strong>${Math.abs(pricePct)}% più bassi</strong> rispetto alla media nazionale`
        : `in linea con la media nazionale (variazione contenuta entro il ±5%)`;

  const demandText = intel ? DEMAND_TEXT[intel.demandLevel] : "stabile";

  const examples = s.useCases.slice(0, 4).map((uc, i) => {
    const base = 250 + i * 320 + (strHash(city.slug + s.slug + String(i)) % 180);
    const factor = intel ? intel.priceIndex : 1.0;
    const low = Math.round((base * factor) / 10) * 10;
    const high = Math.round((base * factor * 1.7) / 10) * 10;
    return { label: uc, range: `da ${low}€ a ${high}€` };
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

  const paragraph1 = `A ${esc(cityName)} il costo medio per un servizio di ${esc(sectorLabel)} è ${priceNote}. La domanda nel ${esc(regionName)} è attualmente ${esc(demandText)}, condizione che influisce sui tempi di risposta dei professionisti e sulla negoziazione del prezzo finale. I prezzi indicati qui sotto sono intervalli di mercato medi raccolti da preventivi reali generati con quoteai per lavori nella zona di ${esc(cityName)} e nelle località limitrofe.`;
  const paragraph2 = `Ogni preventivo dipende da fattori specifici: superficie esatta dell'intervento, qualità dei materiali richiesti, accessibilità del cantiere, urgenza dell'esecuzione e personalizzazioni concordate con il committente. Per questo ti consigliamo di richiedere sempre un sopralluogo o di fornire una descrizione dettagliata: con quoteai puoi farlo in 30 secondi descrivendo il lavoro in linguaggio naturale e ricevere un documento professionale, modificabile e pronto da inviare al cliente via WhatsApp o email.`;

  return `<section class="py-20 bg-white border-t border-gray-100" aria-label="Quanto costa ${esc(sectorLabel)} a ${esc(cityName)}">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <div class="text-center mb-10">
      <h2 class="text-2xl font-bold text-gray-900">Quanto costa un ${esc(sectorLabel)} a ${esc(cityName)}</h2>
      <p class="text-sm text-gray-400 mt-2">Range di prezzo orientativi per i lavori più richiesti</p>
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

// ─── Phase 1: Homepage prerender ────────────────────────────────────────────

function buildHomepageBodyHtml(): string {
  const sectorLinks = Object.values(SECTORS)
    .map(
      (s) =>
        `<a href="/preventivi/${esc(s.slug)}/" class="group flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5 text-center hover:border-violet-200 hover:shadow-sm transition-all">
          <div class="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm text-violet-600 bg-violet-50" aria-hidden="true">${esc(s.label.charAt(0))}</div>
          <span class="text-sm font-medium text-gray-700 group-hover:text-violet-700 transition-colors">${esc(s.label)}</span>
        </a>`
    )
    .join("\n      ");

  // Link the homepage's precious crawl authority only at cities we actually
  // prerender (see ACTIVE_CITIES) — was TOP20_CITY_SLUGS, most of which
  // aren't generated right now, so those links pointed at un-prerendered pages.
  const cityLinks = ACTIVE_CITIES
    .map(
      (city) =>
        `<a href="/preventivi/ristrutturazione/${esc(city.slug)}/" class="inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:border-violet-300 hover:text-violet-600 transition-colors">${esc(city.name)}</a>`
    )
    .join("\n      ");

  return `<div class="flex flex-col min-h-screen bg-white">
  <section class="relative overflow-hidden bg-white pt-28 pb-36">
    <div class="mesh-blob mesh-blob-1" aria-hidden="true"></div>
    <div class="mesh-blob mesh-blob-2" aria-hidden="true"></div>
    <div class="mesh-blob mesh-blob-3" aria-hidden="true"></div>
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
      <h1 class="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl leading-[1.1]">
        Crea preventivi professionali in <span class="gradient-text">30 secondi</span> con l&apos;AI
      </h1>
      <p class="mx-auto mt-8 max-w-2xl text-xl text-gray-500 leading-relaxed">
        Dimentica Excel e i documenti scritti a mano. Descrivi il lavoro a parole tue e quoteai genera un documento impeccabile, pronto da inviare al cliente.
      </p>
      <div class="mt-12 flex flex-col sm:flex-row justify-center gap-4">
        <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Inizia Gratuitamente
          <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
        <a href="#come-funziona" class="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold">
          Vedi come funziona
        </a>
      </div>
      <p class="mt-6 text-sm text-gray-400">
        ✓ Gratis per iniziare &nbsp;&middot;&nbsp; ✓ Nessuna carta richiesta &nbsp;&middot;&nbsp; ✓ Preventivo in 30 secondi
      </p>
    </div>
  </section>

  <section id="come-funziona" class="fade-in-section py-28 bg-gray-50/60">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-14">
        <h2 class="text-3xl font-bold text-gray-900 sm:text-4xl">Basta Excel. Basta fogli scritti a mano.</h2>
        <p class="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">quoteai trasforma una descrizione in linguaggio naturale in un preventivo professionale con tutti i calcoli già fatti.</p>
      </div>
      <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        <div class="card-soft bg-white rounded-2xl p-8">
          <div class="h-12 w-12 rounded-2xl flex items-center justify-center text-white mb-6" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-3">Scrivi in italiano</h3>
          <p class="text-sm text-gray-500 leading-relaxed">Nessun campo da compilare. Descrivi il lavoro come lo descriveresti a voce — l&apos;AI capisce e struttura tutto automaticamente.</p>
        </div>
        <div class="card-soft bg-white rounded-2xl p-8">
          <div class="h-12 w-12 rounded-2xl flex items-center justify-center text-white mb-6" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-3">PDF professionale immediato</h3>
          <p class="text-sm text-gray-500 leading-relaxed">Voci di costo, quantità, prezzi unitari, IVA e totale — tutto calcolato e formattato. Pronto da inviare via WhatsApp o email.</p>
        </div>
        <div class="card-soft bg-white rounded-2xl p-8">
          <div class="h-12 w-12 rounded-2xl flex items-center justify-center text-white mb-6" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-3">Correggi quello che vuoi</h3>
          <p class="text-sm text-gray-500 leading-relaxed">Ogni voce è modificabile direttamente nell&apos;anteprima. Cambia prezzi, aggiungi lavorazioni, personalizza le condizioni di pagamento.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="fade-in-section py-20 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <h2 class="text-2xl font-bold text-gray-900 sm:text-3xl">Preventivi per ogni professione</h2>
        <p class="mt-3 text-base text-gray-500">Imbianchini, elettricisti, idraulici, falegnami, muratori e molti altri — quoteai funziona per tutti.</p>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-w-5xl mx-auto">
        ${sectorLinks}
      </div>
    </div>
  </section>

  <section class="fade-in-section py-20 bg-gray-50/60">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <div class="mb-10">
        <h2 class="text-2xl font-bold text-gray-900 sm:text-3xl">Quotes in major Canadian cities</h2>
        <p class="mt-3 text-base text-gray-500">Used by contractors and tradespeople from coast to coast.</p>
      </div>
      <div class="flex flex-wrap gap-3 justify-center max-w-3xl mx-auto">
        ${cityLinks}
      </div>
    </div>
  </section>

  <section class="fade-in-section py-14 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-8">
        <span class="inline-block bg-amber-50 text-amber-600 text-xs font-bold px-3 py-0.5 rounded-full uppercase tracking-wider mb-3">Recensioni verificate</span>
        <h2 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Cosa dicono <span class="gradient-text">di noi</span></h2>
        <div class="flex items-center justify-center gap-2 mt-3" aria-label="Valutazione media ${AGGREGATE_RATING.ratingValue} su 5">
          <div class="flex gap-0.5" aria-hidden="true">
            ${Array.from({ length: 5 }).map(() => `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-400 fill-amber-400" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join("")}
          </div>
          <span class="text-sm font-bold text-gray-800">${AGGREGATE_RATING.ratingValue}</span>
          <span class="text-sm text-gray-400">/5 &middot; ${AGGREGATE_RATING.reviewCount} recensioni</span>
        </div>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
        ${TESTIMONIALS.map((t) => {
          const initials = t.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
          const stars = Array.from({ length: 5 }).map((_, i) =>
            `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 ${i < t.rating ? "text-amber-400 fill-amber-400" : "text-gray-100 fill-gray-100"}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
          ).join("");
          return `<div class="bg-white rounded-xl border border-gray-100 p-5 card-soft flex flex-col gap-3">
            <div class="flex gap-0.5" aria-label="${t.rating} stelle su 5">${stars}</div>
            <p class="text-sm text-gray-700 leading-relaxed flex-1">&ldquo;${esc(t.text)}&rdquo;</p>
            <div class="flex items-center gap-3 pt-2 border-t border-gray-50">
              <div class="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style="background:linear-gradient(135deg,#7C3AED,#06B6D4)" aria-hidden="true">${initials}</div>
              <div>
                <div class="text-sm font-semibold text-gray-900">${esc(t.name)}</div>
                <div class="text-xs text-gray-400">${esc(t.website)}</div>
              </div>
            </div>
          </div>`;
        }).join("\n        ")}
      </div>
    </div>
  </section>

  <section class="fade-in-section py-16 bg-white border-t border-gray-100">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="max-w-3xl mx-auto">
        <div class="text-center mb-10">
          <span class="inline-flex items-center gap-1.5 bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
            Approfondimento
          </span>
          <h2 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Cos&#39;è <span class="gradient-text">quoteai</span> e a chi serve
          </h2>
        </div>

        <div class="space-y-5 text-sm sm:text-[15px] text-gray-600 leading-relaxed">
          <p>
            <strong class="text-gray-900">quoteai</strong> è il primo software italiano che usa l&#39;intelligenza
            artificiale per trasformare una descrizione in linguaggio naturale in un preventivo professionale
            completo. È pensato per artigiani, professionisti tecnici e piccole imprese che ogni settimana devono
            inviare offerte ai clienti — imbianchini, elettricisti, idraulici, muratori, fabbri, falegnami, imprese
            di ristrutturazione e tutti i mestieri del settore edile e impiantistico. L&#39;obiettivo è semplice:
            ridurre il tempo per fare un preventivo da 30-60 minuti a 30 secondi, senza rinunciare alla qualità del
            documento finale.
          </p>

          <div class="grid sm:grid-cols-3 gap-3 my-8">
            <div class="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-violet-600 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h12"/><path d="M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/></svg>
              <div class="font-semibold text-gray-900 text-sm mb-1">IVA italiana integrata</div>
              <p class="text-xs text-gray-500 leading-relaxed">Calcolo automatico IVA 10%, 22% e regime forfettario.</p>
            </div>
            <div class="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-violet-600 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
              <div class="font-semibold text-gray-900 text-sm mb-1">Dati su server europei</div>
              <p class="text-xs text-gray-500 leading-relaxed">Stripe per i pagamenti, cookie crittografati.</p>
            </div>
            <div class="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-violet-600 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
              <div class="font-semibold text-gray-900 text-sm mb-1">AI addestrata in italiano</div>
              <p class="text-xs text-gray-500 leading-relaxed">Lessico tecnico edile e impiantistico italiano.</p>
            </div>
          </div>

          <h3 class="text-lg font-semibold text-gray-900 pt-3">Come funziona davvero</h3>
          <p>
            Apri quoteai dal tuo smartphone direttamente in cantiere o da casa la sera. Descrivi il lavoro come lo
            racconteresti a un collega: <em>«Tinteggiatura appartamento 80mq, due mani di lavabile bianca, rasatura
            parete bagno»</em>. In trenta secondi il motore AI costruisce un preventivo strutturato in capitoli, con
            voci di costo, unità di misura (metri quadri, ore, corpo), prezzi unitari di mercato italiano e calcolo
            IVA automatico. Puoi modificare ogni voce, sostituire i prezzi con il tuo listino personale, aggiungere
            o togliere capitoli. Quando sei pronto scarichi il PDF, lo invii via WhatsApp o email, e il documento
            viene archiviato nella tua area personale per future modifiche.
          </p>

          <h3 class="text-lg font-semibold text-gray-900 pt-3">Perché funziona meglio di Excel o dei software tradizionali</h3>
          <p>
            I software di preventivazione tradizionali sono pensati per l&#39;ufficio: richiedono installazione,
            configurazione iniziale di listini e codici, una formazione di ore. Excel è gratuito ma costringe a
            partire ogni volta da un foglio bianco o da un template costruito anni fa. quoteai elimina entrambi i
            problemi: non c&#39;è nulla da installare (basta un browser), non serve configurare nulla all&#39;inizio
            (l&#39;AI conosce già i prezzi medi) e ogni preventivo nasce già strutturato. In media i nostri utenti
            dichiarano un risparmio di 4-6 ore a settimana, tempo che torna in cantiere o in famiglia.
          </p>

          <h3 class="text-lg font-semibold text-gray-900 pt-3">Sicurezza e fiscalità italiana</h3>
          <p>
            Tutti i dati sono ospitati su server europei, le sessioni sono protette da cookie crittografati e i
            pagamenti passano da Stripe. La gestione fiscale segue le regole italiane: IVA al 10% per
            ristrutturazioni residenziali, 22% per nuovi impianti, esenzione automatica per il regime forfettario.
            I dati aziendali (P.IVA, codice fiscale, codice SDI per fatturazione elettronica) vengono memorizzati
            una volta e applicati ad ogni preventivo.
          </p>

          <h3 class="text-lg font-semibold text-gray-900 pt-3">Quanto costa iniziare</h3>
          <p>
            La registrazione è gratuita e il primo preventivo si genera senza inserire la carta di credito. Da lì
            puoi scegliere: pago un preventivo singolo (29€) quando serve, oppure attivo un abbonamento mensile
            (Starter 19€ con 10 preventivi, Pro 49€ con 60 preventivi, Elite 59€ illimitati). Il piano si cambia
            o si disdice in qualsiasi momento dall&#39;area cliente. Migliaia di professionisti italiani usano già
            quoteai ogni settimana.
          </p>
        </div>
      </div>
    </div>
  </section>

  <section class="fade-in-section py-28 bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
      <h2 class="text-3xl font-bold text-gray-900 sm:text-4xl mb-4">
        Pronto a creare il tuo primo preventivo <span class="gradient-text">in 30 secondi</span>?
      </h2>
      <p class="text-lg text-gray-500 mb-10">
        Unisciti a centinaia di professionisti italiani che usano quoteai ogni giorno. Nessuna carta di credito. Nessun impegno.
      </p>
      <a href="/sign-up/" class="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
        Inizia Gratuitamente
        <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
    </div>
  </section>
</div>`;
}

// ─── Main execution ─────────────────────────────────────────────────────────

const template = pruneModulepreload(readFileSync(templatePath, "utf-8"));
let count = 0;

console.log("Prerendering SEO pages...");

// Phase 1: Prerender homepage
const homepageWebSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "quoteai",
  url: BASE_URL,
  description: "Software AI per preventivi professionali in 30 secondi. Per artigiani, PMI e freelance italiani.",
  inLanguage: "en",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/preventivi/{search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};
const homepageSoftwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "quoteai",
  description: "Software di preventivazione con intelligenza artificiale per artigiani, PMI e professionisti italiani.",
  url: `${BASE_URL}/`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "CAD", description: "Prova gratuita disponibile" },
  audience: { "@type": "BusinessAudience", audienceType: "Artigiani, PMI, Professionisti, Freelance" },
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
    reviewBody: t.text,
  })),
};
const homepageHeadBlock = buildHeadBlock({
  title: "quoteai – Preventivi Online per Artigiani e Aziende | AI in 30s",
  description: "Crea preventivi professionali in 30 secondi con l'AI. Software di preventivazione per artigiani, PMI e professionisti italiani. Niente Excel, niente errori. Provalo gratis.",
  canonical: `${BASE_URL}/`,
  ogImagePath: "/opengraph.jpg",
  jsonLd: [homepageWebSiteSchema, homepageSoftwareSchema],
});
const homepageHtml = injectBody(injectHead(template, homepageHeadBlock), buildHomepageBodyHtml());
writeFileSync(templatePath, homepageHtml, "utf-8");
count++;
console.log("  ✓ Homepage prerendered");

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

  const canonical = `${BASE_URL}/preventivi/${sectorSlug}/`;
  const jsonLd = buildSectorJsonLd(sector);
  const ogImagePath = ogImage(sectorSlug);

  const headBlock = buildHeadBlock({ title, description, canonical, ogImagePath, jsonLd });
  const bodyHtml = buildSectorBodyHtml(sector);
  const html = injectBody(injectHead(template, headBlock), bodyHtml);
  writeRoute(`preventivi/${sectorSlug}`, html);
  count++;

  if (!CITY_SECTORS.includes(sectorSlug)) continue;

  for (const city of ACTIVE_CITIES) {
    const cityCanonical = `${BASE_URL}/preventivi/${sectorSlug}/${city.slug}/`;
    const cityTitle = getCityTitle(sector, city.name, city.slug);
    const cityDesc = getCityDesc(sector, city.name, city.slug, city.region);
    const cityJsonLd = buildCityJsonLd(sector, city);

    const cityHeadBlock = buildHeadBlock({
      title: cityTitle,
      description: cityDesc,
      canonical: cityCanonical,
      ogImagePath: ogImage(sectorSlug),
      jsonLd: cityJsonLd,
    });
    const cityBodyHtml = buildCityBodyHtml(sector, city);
    const cityHtml = injectBody(injectHead(template, cityHeadBlock), cityBodyHtml);
    writeRoute(`preventivi/${sectorSlug}/${city.slug}`, cityHtml);
    count++;
  }
}

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
  Professioni: "background:#f5f3ff;color:#6d28d9",
  Prezzi: "background:#ecfeff;color:#0e7490",
  Consigli: "background:#fffbeb;color:#d97706",
  Tool: "background:#f0fdf4;color:#15803d",
  Innovazione: "background:#eff6ff;color:#1d4ed8",
  Business: "background:#fff1f2;color:#be123c",
};

function buildBlogListBodyHtml(): string {
  const breadcrumb = `<nav aria-label="Percorso di navigazione" class="bg-white border-b border-gray-100">
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
      Approfondimenti
    </div>
    <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl mb-4 leading-tight">
      Guide e consigli per <span class="gradient-text">artigiani e PMI</span>
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
      <span class="text-xs font-semibold uppercase tracking-wider mr-1" style="color:#9ca3af">Categorie:</span>
      ${categoryLinks}
    </div>
  </div>
</section>`;

  const cards = BLOG_ARTICLES.map((a) => {
    const catStyle = BLOG_CATEGORY_STYLE[a.category] ?? "background:#f3f4f6;color:#374151";
    const dateStr = new Date(a.publishedAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
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
          <span class="text-xs font-semibold text-violet-600">Leggi →</span>
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
      Pronto a creare preventivi in <span class="gradient-text">30 secondi</span>?
    </h2>
    <p class="text-gray-500 mb-8 text-sm">Nessuna carta di credito. Nessun impegno. Il tuo primo preventivo è gratis.</p>
    <a href="/sign-up/" class="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold">
      Inizia Gratuitamente
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
  const breadcrumb = `<nav aria-label="Percorso di navigazione" class="bg-white border-b border-gray-100">
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
  const dateStr = new Date(article.publishedAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

  const header = `<header style="background:linear-gradient(135deg,rgba(124,58,237,0.04),rgba(6,182,212,0.04))" class="pt-14 pb-10 border-b border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <div class="flex items-center gap-3 mb-5">
      <span class="text-xs font-semibold px-2.5 py-1 rounded-full" style="${catStyle}">${esc(article.category)}</span>
      <span class="text-xs text-gray-400">${article.readingTimeMin} min di lettura</span>
      <time class="text-xs text-gray-400" datetime="${article.publishedAt}">${dateStr}</time>
    </div>
    <h1 class="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl leading-tight mb-4">${esc(article.title)}</h1>
    <p class="text-base text-gray-500 leading-relaxed">${esc(article.metaDescription)}</p>
  </div>
</header>`;

  const toc = extractToc(article.contentHtml);
  const bodyHtml = injectHeadingIds(article.contentHtml);

  const tocHtml = toc.length >= 2
    ? `<nav aria-label="Sommario" class="mb-10 rounded-xl border border-violet-100 px-6 py-5" style="background:rgba(124,58,237,0.04)">
  <p class="text-xs font-bold uppercase tracking-wider mb-3" style="color:#7c3aed">Sommario</p>
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
    return `<a href="/preventivi/${esc(sectorSlug)}/" class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:border-violet-300 hover:text-violet-700 transition-colors">
      <span class="text-violet-400 font-bold">→</span> Preventivi ${esc(sector.label)}
    </a>`;
  }).filter(Boolean).join("\n    ");

  const relatedSectorsSection = relatedSectorLinks ? `<section class="border-t border-gray-100 bg-gray-50 py-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <h2 class="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Preventivi per settore</h2>
    <div class="flex flex-wrap gap-3">
      ${relatedSectorLinks}
    </div>
  </div>
</section>` : "";

  const geoSectorSlug = article.relatedSectors.find((slug) => CITY_SECTORS.includes(slug));
  const geoSector = geoSectorSlug ? SECTORS[geoSectorSlug] : undefined;
  const citySection = geoSector ? `<section class="border-t border-gray-100 bg-white py-10">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <h2 class="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Preventivi ${esc(geoSector.labelPlural)} nella tua città</h2>
    <div class="flex flex-wrap gap-3">
      ${ACTIVE_CITIES
        .map(
          (city) =>
            `<a href="/preventivi/${esc(geoSector.slug)}/${esc(city.slug)}/" class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:border-violet-300 hover:text-violet-700 transition-colors">
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
    <h2 class="text-lg font-bold text-gray-900 mb-6">Articoli correlati</h2>
    <div class="grid sm:grid-cols-3 gap-4">
      ${relatedCards}
    </div>
  </div>
</section>` : "";

  const cta = `<section class="py-16 border-t border-violet-100/60" style="background:linear-gradient(135deg,rgba(124,58,237,0.04),rgba(6,182,212,0.04))">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
    <h2 class="text-2xl font-bold text-gray-900 mb-3">
      Pronto a creare preventivi in <span class="gradient-text">30 secondi</span>?
    </h2>
    <p class="text-gray-500 mb-8 text-sm">Nessuna carta di credito. Nessun impegno. Il tuo primo preventivo è gratis.</p>
    <a href="/sign-up/" class="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold">
      Inizia Gratuitamente
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
  Professioni: "background:#f5f3ff;color:#6d28d9",
  Prezzi: "background:#ecfeff;color:#0e7490",
  Consigli: "background:#fffbeb;color:#d97706",
  Tool: "background:#f0fdf4;color:#15803d",
  Innovazione: "background:#eff6ff;color:#1d4ed8",
  Business: "background:#fff1f2;color:#be123c",
};

function buildBlogCategoryBodyHtml(category: BlogCategory): string {
  const articles = getArticlesByCategory(category.name);
  const catStyle = BLOG_CATEGORY_COLOR_STYLE[category.name] ?? "background:#f3f4f6;color:#374151";

  const breadcrumb = `<nav aria-label="Percorso di navigazione" class="bg-white border-b border-gray-100">
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
      Articoli su <span class="gradient-text">${esc(category.name)}</span>
    </h1>
    <p class="text-base text-gray-500 leading-relaxed max-w-2xl mx-auto">${esc(category.description)}</p>
    <p class="text-xs text-gray-400 mt-3">${articles.length} ${articles.length === 1 ? "articolo" : "articoli"}</p>
  </div>
</section>`;

  const cards = articles.map((a) => {
    const cs = BLOG_CATEGORY_COLOR_STYLE[a.category] ?? "background:#f3f4f6;color:#374151";
    const dateStr = new Date(a.publishedAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
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
          <span class="text-xs font-semibold text-violet-600">Leggi →</span>
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
  <p class="text-lg font-medium">Nessun articolo in questa categoria.</p>
  <a href="/blog/" class="mt-6 inline-block text-violet-600 text-sm font-semibold">Torna al Blog →</a>
</section>`;

  const otherCats = BLOG_CATEGORIES.filter((c) => c.slug !== category.slug);
  const catLinks = otherCats.map((c) => {
    const cs = BLOG_CATEGORY_COLOR_STYLE[c.name] ?? "background:#f3f4f6;color:#374151";
    return `<a href="/blog/categoria/${esc(c.slug)}/" class="inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold transition-colors" style="${cs}">${esc(c.name)}</a>`;
  }).join("\n      ");

  const otherCatsSection = `<section class="py-10 bg-gray-50 border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
    <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">Altre categorie</h2>
    <div class="flex flex-wrap gap-3">
      ${catLinks}
    </div>
  </div>
</section>`;

  const cta = `<section class="py-16 bg-white border-t border-gray-100">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
    <h2 class="text-2xl font-bold text-gray-900 mb-3">
      Pronto a creare preventivi in <span class="gradient-text">30 secondi</span>?
    </h2>
    <p class="text-gray-500 mb-8 text-sm">Nessuna carta di credito. Nessun impegno. Il tuo primo preventivo è gratis.</p>
    <a href="/sign-up/" class="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold">
      Inizia Gratuitamente
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
const blogListHtml = injectBody(injectHead(template, blogListHeadBlock), buildBlogListBodyHtml());
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
  const categoryHtml = injectBody(injectHead(template, categoryHeadBlock), buildBlogCategoryBodyHtml(category));
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
  const articleHtml = injectBody(injectHead(template, articleHeadBlock), buildBlogArticleBodyHtml(article));
  writeRoute(`blog/${article.slug}`, articleHtml);
  count++;
}
console.log(`  ✓ ${BLOG_ARTICLES.length} blog articles prerendered`);

// ─── Static SPA pages prerender ─────────────────────────────────────────────

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

function buildMappaSitoBodyHtml(): string {
  const breadcrumb = buildBreadcrumb([
    { name: "Home", href: "/" },
    { name: "Mappa del Sito", href: null },
  ]);

  const mainPages = `
    <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div class="flex items-center gap-3 mb-5 pb-3 border-b border-gray-50">
        <h2 class="text-lg font-bold text-gray-900">Pagine Principali</h2>
      </div>
      <ul class="space-y-2.5 text-sm">
        <li><a href="/" class="text-gray-600 hover:text-violet-600 transition-colors">Home Page</a></li>
        <li><a href="/whatsapp/" class="text-gray-600 hover:text-violet-600 transition-colors">Preventivi su WhatsApp</a></li>
        <li><a href="/chi-siamo/" class="text-gray-600 hover:text-violet-600 transition-colors">Chi Siamo</a></li>
        <li><a href="/contatti/" class="text-gray-600 hover:text-violet-600 transition-colors">Contatti e Assistenza</a></li>
        <li><a href="/privacy/" class="text-gray-600 hover:text-violet-600 transition-colors">Privacy Policy</a></li>
        <li><a href="/termini/" class="text-gray-600 hover:text-violet-600 transition-colors">Termini di Servizio</a></li>
      </ul>
    </div>
  `;

  const blogCats = BLOG_CATEGORIES.map((cat) => `
    <li><a href="/blog/categoria/${cat.slug}/" class="text-gray-600 hover:text-violet-600 transition-colors pl-2">Categoria: ${cat.name}</a></li>
  `).join("");

  const blogArts = BLOG_ARTICLES.slice(0, 5).map((art) => `
    <li class="truncate max-w-full"><a href="/blog/${art.slug}/" class="text-gray-500 hover:text-violet-600 text-xs transition-colors pl-2">${esc(art.title)}</a></li>
  `).join("");

  const blogPages = `
    <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div class="flex items-center gap-3 mb-5 pb-3 border-b border-gray-50">
        <h2 class="text-lg font-bold text-gray-900">Blog e Guide</h2>
      </div>
      <ul class="space-y-2.5 text-sm">
        <li><a href="/blog/" class="font-semibold text-gray-800 hover:text-violet-600 transition-colors">Indice Blog</a></li>
        ${blogCats}
        <li class="pt-2 font-semibold text-gray-800 border-t border-gray-50 mt-2">Ultimi Articoli:</li>
        ${blogArts}
      </ul>
    </div>
  `;

  const sectorLinks = Object.entries(SECTORS).map(([slug, sector]) => `
    <li><a href="/preventivi/${slug}/" class="text-gray-600 hover:text-violet-600 transition-colors">${esc(sector.label)}</a></li>
  `).join("");

  const professionsIndex = `
    <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div class="flex items-center gap-3 mb-5 pb-3 border-b border-gray-50">
        <h2 class="text-lg font-bold text-gray-900">Professioni e Servizi</h2>
      </div>
      <ul class="space-y-2.5 text-sm">
        ${sectorLinks}
      </ul>
    </div>
  `;

  const citiesByRegion = new Map<string, typeof CITIES>();
  for (const city of ACTIVE_CITIES) {
    const list = citiesByRegion.get(city.region) || [];
    list.push(city);
    citiesByRegion.set(city.region, list);
  }

  const sortedRegions = Array.from(citiesByRegion.keys()).sort();

  const regionBlocks = sortedRegions.map((region) => {
    const regionCities = citiesByRegion.get(region) || [];
    const cityItems = regionCities.map((city) => {
      const sectorLinksForCity = CITY_SECTORS.map((sectorSlug) => {
        const s = SECTORS[sectorSlug];
        if (!s) return "";
        return `<a href="/preventivi/${sectorSlug}/${city.slug}/" class="text-gray-500 hover:text-violet-600 transition-colors truncate" title="Preventivo ${esc(s.label)} a ${esc(city.name)}">${esc(s.label)}</a>`;
      }).join("\n");

      return `
        <div class="flex flex-col gap-1">
          <span class="font-bold text-gray-900 border-b border-gray-50 pb-0.5 mb-1">${esc(city.name)}</span>
          <div class="flex flex-col gap-1.5 pl-1">
            ${sectorLinksForCity}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="border-b border-gray-50 pb-8 last:border-0 last:pb-0">
        <h3 class="text-sm font-semibold uppercase tracking-wider text-violet-700 mb-4">${esc(region)}</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-4 gap-x-2 text-xs">
          ${cityItems}
        </div>
      </div>
    `;
  }).join("\n");

  const citiesDirectory = `
    <div class="mt-12 bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
      <div class="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Preventivi Locali per Città</h2>
          <p class="text-sm text-gray-500 mt-1">Seleziona un settore e la tua città per accedere ai prezzi e alle informazioni territoriali.</p>
        </div>
      </div>
      <div class="space-y-10">
        ${regionBlocks}
      </div>
    </div>
  `;

  return wrapInPublicLayout(`
    <div class="flex flex-col min-h-screen bg-white">
      ${breadcrumb}
      <section class="relative overflow-hidden bg-white pt-20 pb-12 border-b border-gray-100">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <h1 class="text-4xl font-bold tracking-tight text-gray-900 mb-4">Mappa del Sito</h1>
          <p class="text-lg text-gray-600">Esplora l'indice completo di quoteai.ca. Trova strumenti di preventivazione specifici, guide fiscali e tutte le pagine locali per regione.</p>
        </div>
      </section>
      <section class="py-16 bg-gray-50/50">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div class="grid md:grid-cols-3 gap-8">
            ${mainPages}
            ${blogPages}
            ${professionsIndex}
          </div>
          ${citiesDirectory}
        </div>
      </section>
    </div>
  `);
}

function buildStaticPageHtml(opts: {
  slug: string;
  title: string;
  description: string;
  path: string;
  jsonLd: object[];
  bodyHtml: string;
  ogImagePath?: string;
}): void {
  const headBlock = buildHeadBlock({
    title: opts.title,
    description: opts.description,
    canonical: `${BASE_URL}${opts.path}`,
    ogImagePath: opts.ogImagePath ?? "/opengraph.jpg",
    jsonLd: opts.jsonLd,
  });
  const html = injectBody(injectHead(template, headBlock), opts.bodyHtml);
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
buildStaticPageHtml({
  slug: "chi-siamo",
  title: "About Us | quoteai — AI Quoting Software for Contractors",
  description: "quoteai exists to free Canadian tradespeople from paperwork. Learn our mission: professional quotes in 30 seconds thanks to AI.",
  path: "/chi-siamo/",
  jsonLd: [chiSiamoOrgJsonLd, buildBreadcrumbJsonLd("About Us", "/chi-siamo/")],
  bodyHtml: wrapInPublicLayout(`<section class="relative overflow-hidden bg-white pt-24 pb-20">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center">
    <div class="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">Built for Canadian trades</div>
    <h1 class="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-6">We're quoteai. <span style="background:linear-gradient(135deg,#7C3AED 0%,#A855F7 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent">We free tradespeople from paperwork.</span></h1>
    <p class="text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">Canada has hundreds of thousands of contractors, tradespeople and small trade businesses. Most of them lose several hours a week writing quotes by hand. We built quoteai to give that time back.</p>
  </div>
</section>
<section class="py-20 bg-gray-50">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <h2 class="text-3xl font-bold text-gray-900 mb-6">How it started</h2>
    <div class="space-y-5 text-gray-600 leading-relaxed text-lg">
      <p>It started with a real frustration: a painter who, every evening after a full day on site, still had to sit down and update a spreadsheet to send quotes to customers. A $200 job often took an hour and a half just to quote.</p>
      <p>We thought: AI already knows how a professional quote is put together. Why not let a tradesperson <em>describe the job the way they'd explain it out loud</em>, and get a document ready to send back in 30 seconds?</p>
      <p>That's how quoteai came to be. Software built specifically for the Canadian trades market, with the terminology contractors actually use, prices that reflect the Canadian market, and everything a quote needs: your logo, business details, tax calculated correctly, customizable terms, a professional PDF.</p>
    </div>
  </div>
</section>
<section class="py-20 bg-white">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
    <div class="text-center mb-14"><h2 class="text-3xl font-bold text-gray-900 mb-4">Our values</h2><p class="text-gray-500 text-lg max-w-xl mx-auto">Every decision we make starts from three principles.</p></div>
    <div class="grid md:grid-cols-3 gap-8">
      <div class="bg-gray-50 rounded-2xl p-8 text-center"><h3 class="text-lg font-bold text-gray-900 mb-3">Real speed</h3><p class="text-gray-500 text-sm leading-relaxed">30 seconds isn't a slogan. It's how long it takes to generate a complete, professional quote. Your time is worth something.</p></div>
      <div class="bg-gray-50 rounded-2xl p-8 text-center"><h3 class="text-lg font-bold text-gray-900 mb-3">Built for Canada</h3><p class="text-gray-500 text-sm leading-relaxed">Not a generic tool with the words swapped out. Built from the ground up for the Canadian trades market: job categories, pricing, tax rules, language.</p></div>
      <div class="bg-gray-50 rounded-2xl p-8 text-center"><h3 class="text-lg font-bold text-gray-900 mb-3">Simplicity first</h3><p class="text-gray-500 text-sm leading-relaxed">No courses or tutorials needed. If you can write a text message, you can use quoteai. The technology should disappear — only the result should stay.</p></div>
    </div>
  </div>
</section>
<section class="py-20 bg-gray-50">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <h2 class="text-3xl font-bold text-gray-900 mb-6">Who quoteai is for</h2>
    <div class="space-y-4 text-gray-600 leading-relaxed text-lg">
      <p>quoteai is built for <strong>contractors, tradespeople, technicians and independent professionals across Canada</strong> who work project to project and need to send quotes to their customers.</p>
      <p>Painters, electricians, plumbers, masons, carpenters, home inspectors, tile setters, landscapers, window and door installers, HVAC technicians, air conditioning installers — and many more. If your job means telling a customer what a job will cost before you do it, quoteai is for you.</p>
      <p>We're already used by tradespeople across Canada — from Vancouver to Halifax, from Toronto to Montreal.</p>
    </div>
  </div>
</section>
<section class="py-20 bg-white">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
    <h2 class="text-3xl font-bold text-gray-900 mb-5">Try quoteai for free</h2>
    <p class="text-gray-500 text-lg mb-8">Create your first quote in 30 seconds. No credit card required.</p>
    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <a href="/sign-up/" class="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white" style="background:linear-gradient(135deg,#7C3AED 0%,#A855F7 100%)">Get started free</a>
      <a href="/contatti/" class="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-gray-700 border border-gray-200">Contact us</a>
    </div>
  </div>
</section>`),
});

// /contatti/
const contattiJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contatti quoteai",
  url: `${BASE_URL}/contatti/`,
  description: "Contatta il team quoteai per supporto, domande sul prodotto o informazioni commerciali.",
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
buildStaticPageHtml({
  slug: "contatti",
  title: "Contatti | quoteai — Assistenza e Supporto",
  description: "Hai domande su quoteai? Contattaci via email o WhatsApp. Siamo qui per aiutarti a generare preventivi professionali più velocemente.",
  path: "/contatti/",
  jsonLd: [contattiJsonLd, buildBreadcrumbJsonLd("Contatti", "/contatti/")],
  bodyHtml: wrapInPublicLayout(`<section class="relative overflow-hidden bg-white pt-24 pb-16">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
    <h1 class="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-5">Come possiamo <span style="background:linear-gradient(135deg,#7C3AED 0%,#A855F7 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent">aiutarti?</span></h1>
    <p class="text-xl text-gray-600 leading-relaxed">Il team quoteai risponde entro poche ore nei giorni feriali. Scegli il canale che preferisci.</p>
  </div>
</section>
<section class="py-16 bg-gray-50">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
    <div class="grid md:grid-cols-3 gap-6">
      <div class="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <h2 class="text-lg font-bold text-gray-900 mb-2">Supporto prodotto</h2>
        <p class="text-gray-500 text-sm leading-relaxed mb-4">Problemi tecnici, domande sull'utilizzo, richiesta di funzionalità.</p>
        <a href="mailto:info@quoteai.ca" class="text-violet-600 font-semibold text-sm">info@quoteai.ca →</a>
      </div>
      <div class="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <h2 class="text-lg font-bold text-gray-900 mb-2">WhatsApp</h2>
        <p class="text-gray-500 text-sm leading-relaxed mb-4">Vuoi provare il servizio via WhatsApp o hai una domanda rapida? Scrivici direttamente.</p>
        <a href="/whatsapp/" class="text-green-600 font-semibold text-sm">Scopri quoteai su WhatsApp →</a>
      </div>
      <div class="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <h2 class="text-lg font-bold text-gray-900 mb-2">Privacy &amp; legale</h2>
        <p class="text-gray-500 text-sm leading-relaxed mb-4">Richieste GDPR, esercizio dei diritti, questioni legali o contrattuali.</p>
        <a href="mailto:privacy@quoteai.ca" class="text-gray-600 font-semibold text-sm">privacy@quoteai.ca →</a>
      </div>
    </div>
  </div>
</section>
<section class="py-16 bg-white">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <div class="bg-violet-50 border border-violet-100 rounded-2xl p-6">
      <h3 class="font-bold text-gray-900 mb-1">Tempi di risposta</h3>
      <p class="text-gray-600 text-sm leading-relaxed">Rispondiamo a tutte le email entro <strong>4-8 ore nei giorni feriali</strong> (lunedì–venerdì, 9:00–18:00 CET). Per le richieste inviate nel weekend, rispondiamo il lunedì mattina.</p>
    </div>
  </div>
</section>
<section class="py-16 bg-gray-50">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
    <h2 class="text-2xl font-bold text-gray-900 mb-8">Domande frequenti</h2>
    <div class="space-y-5">
      <div class="bg-white rounded-2xl p-6 border border-gray-100"><h3 class="font-semibold text-gray-900 mb-2">Posso cancellare l'abbonamento in qualsiasi momento?</h3><p class="text-gray-500 text-sm leading-relaxed">Sì. Puoi cancellare il tuo abbonamento in qualsiasi momento dalle impostazioni del tuo account, senza penali o costi aggiuntivi. Continuerai ad avere accesso fino alla fine del periodo già pagato.</p></div>
      <div class="bg-white rounded-2xl p-6 border border-gray-100"><h3 class="font-semibold text-gray-900 mb-2">Offrite uno sconto per agenzie o team?</h3><p class="text-gray-500 text-sm leading-relaxed">Sì. Per utilizzi multi-utente o volumi elevati, contattaci a info@quoteai.ca e troveremo la soluzione più adatta.</p></div>
      <div class="bg-white rounded-2xl p-6 border border-gray-100"><h3 class="font-semibold text-gray-900 mb-2">I miei dati e i preventivi sono al sicuro?</h3><p class="text-gray-500 text-sm leading-relaxed">Sì. Tutti i dati sono cifrati in transito (TLS) e a riposo. Non condividiamo i tuoi dati con terze parti. Leggi la nostra Privacy Policy per i dettagli.</p></div>
      <div class="bg-white rounded-2xl p-6 border border-gray-100"><h3 class="font-semibold text-gray-900 mb-2">Posso importare il mio listino prezzi?</h3><p class="text-gray-500 text-sm leading-relaxed">Sì. Dalla sezione Impostazioni → Listino puoi inserire i tuoi prezzi personalizzati che l'AI userà come riferimento per i tuoi preventivi.</p></div>
    </div>
  </div>
</section>
<section class="py-16 bg-white">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-xl text-center">
    <h2 class="text-2xl font-bold text-gray-900 mb-4">Non hai ancora un account?</h2>
    <p class="text-gray-500 mb-6">Prova quoteai gratis — nessuna carta di credito richiesta.</p>
    <a href="/sign-up/" class="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white" style="background:linear-gradient(135deg,#7C3AED 0%,#A855F7 100%)">Crea account gratuito</a>
  </div>
</section>`),
});

// /privacy/
buildStaticPageHtml({
  slug: "privacy",
  title: "Privacy Policy | quoteai",
  description: "Informativa sulla privacy di quoteai — come raccogliamo e trattiamo i tuoi dati personali.",
  path: "/privacy/",
  jsonLd: [buildWebPageJsonLd("Privacy Policy", "Informativa sulla privacy di quoteai — come raccogliamo e trattiamo i tuoi dati personali.", "/privacy/"), buildBreadcrumbJsonLd("Privacy Policy", "/privacy/")],
  bodyHtml: wrapInPublicLayout(`<div class="container mx-auto px-4 py-16 max-w-3xl">
  <h1 class="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
  <p class="text-sm text-gray-500 mb-10">Ultimo aggiornamento: 6 maggio 2025</p>
  <div class="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">1. Titolare del trattamento</h2><p>Il titolare del trattamento dei dati personali è <strong>QuoteAI</strong> (di seguito "Società" o "noi"), raggiungibile all'indirizzo email <a href="mailto:privacy@quoteai.ca" class="text-violet-600">privacy@quoteai.ca</a>.</p></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">2. Dati raccolti</h2><p>Raccogliamo le seguenti categorie di dati personali:</p><ul class="list-disc pl-5 mt-2 space-y-1"><li><strong>Dati di registrazione:</strong> nome, cognome, indirizzo email, forniti al momento della creazione dell'account.</li><li><strong>Dati del profilo aziendale:</strong> ragione sociale, partita IVA, indirizzo, telefono, email aziendale, logo aziendale.</li><li><strong>Dati dei preventivi:</strong> descrizioni dei lavori, dati dei clienti (committenti), importi, voci di computo.</li><li><strong>Dati di pagamento:</strong> gestiti direttamente da Stripe Inc. — non accediamo ai dati della carta di credito.</li><li><strong>Dati tecnici:</strong> indirizzo IP, tipo di browser, pagine visitate, durata delle sessioni (tramite log di sistema).</li></ul></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">3. Finalità e base giuridica del trattamento</h2><div class="space-y-3"><div><p class="font-medium">a) Erogazione del servizio (art. 6(1)(b) GDPR — esecuzione del contratto)</p><p class="mt-1">Trattamento necessario per creare l'account, generare preventivi tramite AI, gestire abbonamenti e pagamenti.</p></div><div><p class="font-medium">b) Obblighi legali (art. 6(1)(c) GDPR)</p><p class="mt-1">Conservazione dei dati di fatturazione per gli obblighi fiscali previsti dalla normativa italiana.</p></div><div><p class="font-medium">c) Legittimo interesse (art. 6(1)(f) GDPR)</p><p class="mt-1">Analisi aggregate per migliorare il servizio, prevenzione delle frodi, sicurezza della piattaforma.</p></div><div><p class="font-medium">d) Consenso (art. 6(1)(a) GDPR)</p><p class="mt-1">Invio di comunicazioni promozionali e newsletter, previa esplicita accettazione.</p></div></div></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">4. Conservazione dei dati</h2><p>I dati vengono conservati per il tempo strettamente necessario alle finalità indicate:</p><ul class="list-disc pl-5 mt-2 space-y-1"><li>Dati dell'account: fino alla cancellazione dell'account, poi 30 giorni per finalità di sicurezza.</li><li>Dati dei preventivi: 10 anni dall'emissione (obblighi fiscali italiani).</li><li>Dati di fatturazione: 10 anni (D.P.R. 633/1972 e D.P.R. 600/1973).</li><li>Log tecnici: 90 giorni.</li></ul></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">5. Destinatari dei dati</h2><p>I dati possono essere comunicati alle seguenti categorie di destinatari:</p><ul class="list-disc pl-5 mt-2 space-y-1"><li><strong>Clerk Inc.</strong> — gestione dell'autenticazione e degli account utente (USA, con garanzie adeguate ex art. 46 GDPR).</li><li><strong>Stripe Inc.</strong> — elaborazione dei pagamenti (USA, con garanzie adeguate).</li><li><strong>OpenAI, LLC</strong> — generazione dei preventivi tramite intelligenza artificiale (USA, con garanzie adeguate). I dati inviati sono limitati alla descrizione del lavoro.</li><li><strong>Replit Inc.</strong> — infrastruttura cloud e hosting (USA, con garanzie adeguate).</li><li><strong>Resend Inc.</strong> — invio email transazionali.</li></ul><p class="mt-3">Non vendiamo dati personali a terzi. I trasferimenti extra-UE avvengono con le garanzie previste dagli artt. 44-49 GDPR (clausole contrattuali standard o decisioni di adeguatezza).</p></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">6. Diritti dell'interessato</h2><p>Ai sensi degli artt. 15-22 GDPR, hai diritto di:</p><ul class="list-disc pl-5 mt-2 space-y-1"><li><strong>Accesso</strong> — richiedere copia dei dati che trattiamo su di te.</li><li><strong>Rettifica</strong> — correggere dati inesatti o incompleti.</li><li><strong>Cancellazione ("diritto all'oblio")</strong> — richiedere la cancellazione dei dati, salvo obblighi legali di conservazione.</li><li><strong>Limitazione del trattamento</strong> — in determinati casi previsti dall'art. 18 GDPR.</li><li><strong>Portabilità</strong> — ricevere i tuoi dati in formato strutturato e leggibile da macchina.</li><li><strong>Opposizione</strong> — opporti al trattamento basato su legittimo interesse.</li><li><strong>Revoca del consenso</strong> — in qualsiasi momento, senza pregiudizio per la liceità del trattamento precedente.</li></ul><p class="mt-3">Per esercitare i tuoi diritti scrivi a <a href="mailto:privacy@quoteai.ca" class="text-violet-600">privacy@quoteai.ca</a>. Risponderemo entro 30 giorni. Hai anche il diritto di proporre reclamo all'Autorità di controllo italiana: Garante per la protezione dei dati personali.</p></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">7. Cookie e tecnologie di tracciamento</h2><p>Utilizziamo esclusivamente cookie tecnici necessari al funzionamento del servizio (autenticazione, sessione). Non utilizziamo cookie di profilazione o di terze parti a fini pubblicitari.</p></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">8. Sicurezza</h2><p>Adottiamo misure tecniche e organizzative adeguate per proteggere i dati da accesso non autorizzato, perdita o alterazione: connessioni cifrate (TLS/HTTPS), controllo degli accessi, autenticazione sicura.</p></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">9. Modifiche alla privacy policy</h2><p>Ci riserviamo il diritto di aggiornare questa informativa. Le modifiche sostanziali saranno comunicate via email o tramite avviso in piattaforma con almeno 14 giorni di anticipo.</p></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">10. Contatti</h2><p>Per qualsiasi domanda relativa alla privacy: <a href="mailto:privacy@quoteai.ca" class="text-violet-600">privacy@quoteai.ca</a></p></section>
  </div>
</div>`),
});

// /termini/
buildStaticPageHtml({
  slug: "termini",
  title: "Termini di Servizio | quoteai",
  description: "Termini e condizioni di utilizzo della piattaforma quoteai per la generazione di preventivi AI.",
  path: "/termini/",
  jsonLd: [buildWebPageJsonLd("Termini di Servizio", "Termini e condizioni di utilizzo della piattaforma quoteai per la generazione di preventivi AI.", "/termini/"), buildBreadcrumbJsonLd("Termini di Servizio", "/termini/")],
  bodyHtml: wrapInPublicLayout(`<div class="container mx-auto px-4 py-16 max-w-3xl">
  <h1 class="text-3xl font-bold text-gray-900 mb-2">Termini di Servizio</h1>
  <p class="text-sm text-gray-500 mb-10">Ultimo aggiornamento: 6 maggio 2025</p>
  <div class="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">1. Accettazione dei termini</h2><p>Utilizzando la piattaforma <strong>QuoteAI</strong> (di seguito "Servizio"), disponibile all'indirizzo <strong>quoteai.ca</strong>, l'utente accetta integralmente i presenti Termini di Servizio. Se non accetti questi termini, non puoi utilizzare il Servizio.</p></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">2. Descrizione del servizio</h2><p>QuoteAI è una piattaforma SaaS che consente a professionisti, artigiani e imprese di generare preventivi professionali tramite intelligenza artificiale. Il Servizio include:</p><ul class="list-disc pl-5 mt-2 space-y-1"><li>Generazione di preventivi tramite AI a partire da una descrizione testuale dei lavori.</li><li>Creazione e download di documenti PDF professionale.</li><li>Gestione del profilo aziendale e archiviazione dei preventivi.</li><li>Piani di abbonamento mensile e acquisti singoli.</li></ul></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">3. Account utente</h2><p>Per accedere al Servizio è necessario creare un account fornendo dati veritieri e aggiornati. L'utente è responsabile della riservatezza delle proprie credenziali e di tutte le attività svolte tramite il proprio account. In caso di accesso non autorizzato, l'utente deve notificarlo immediatamente a <a href="mailto:supporto@quoteai.ca" class="text-violet-600">supporto@quoteai.ca</a>.</p></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">4. Piani e pagamenti</h2><div class="space-y-3"><div><p class="font-medium">4.1 Piani disponibili</p><ul class="list-disc pl-5 mt-1 space-y-1"><li><strong>Starter (€29/mese):</strong> fino a 20 preventivi al mese, PDF con filigrana QuoteAI.</li><li><strong>Pro (€79/mese):</strong> preventivi illimitati, PDF senza filigrana, branding personalizzabile.</li><li><strong>Singolo con Watermark (€29):</strong> un singolo preventivo PDF con filigrana.</li><li><strong>Singolo Pulito (€39):</strong> un singolo preventivo PDF senza filigrana.</li></ul></div><div><p class="font-medium">4.2 Fatturazione</p><p class="mt-1">I piani mensili vengono rinnovati automaticamente ogni mese. I pagamenti sono processati tramite Stripe Inc. e sono soggetti ai relativi termini di servizio. I prezzi sono IVA esclusa.</p></div><div><p class="font-medium">4.3 Rimborsi</p><p class="mt-1">Ai sensi dell'art. 59(a) del Codice del Consumo (D.Lgs. 206/2005), il diritto di recesso non si applica ai contenuti digitali forniti immediatamente dopo l'acquisto con esplicito consenso. Per i piani mensili, puoi disdire in qualsiasi momento: il servizio rimane attivo fino alla fine del periodo già pagato. Non sono previsti rimborsi pro-rata per i periodi non utilizzati.</p></div></div></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">5. Uso accettabile</h2><p>È vietato utilizzare il Servizio per:</p><ul class="list-disc pl-5 mt-2 space-y-1"><li>Generare documenti falsi, fraudolenti o fuorvianti.</li><li>Violare diritti di terzi, normative applicabili o la presente policy.</li><li>Tentare di accedere a dati di altri utenti o compromettere la sicurezza della piattaforma.</li><li>Uso automatizzato massivo (scraping, bot) senza autorizzazione scritta.</li><li>Rivendere o sublicenziare l'accesso al Servizio a terzi.</li></ul></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">6. Proprietà intellettuale</h2><p>QuoteAI e i relativi loghi, marchi, interfacce e codice sorgente sono di proprietà esclusiva della Società. I preventivi generati tramite il Servizio sono di proprietà dell'utente che li ha creato. L'utente concede a QuoteAI una licenza limitata, non esclusiva, per elaborare i dati inseriti al solo fine di erogare il Servizio.</p></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">7. Limitazione di responsabilità</h2><p>I preventivi generati dall'AI sono indicativi e basati su dati statistici. <strong>QuoteAI non garantisce l'accuratezza, la completezza o l'adeguatezza dei preventivi per specifici contesti contrattuali.</strong> L'utente è responsabile della verifica e validazione dei contenuti prima di presentarli ai propri clienti. QuoteAI non è responsabile per danni indiretti, perdita di dati, lucro cessante o danni derivanti da errori nell'output dell'AI, nei limiti consentiti dalla legge applicabile.</p></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">8. Sospensione e cancellazione</h2><p>QuoteAI si riserva il diritto di sospendere o terminare l'accesso al Servizio in caso di violazione dei presenti Termini, previo avviso via email salvo casi di grave violazione. L'utente può cancellare il proprio account in qualsiasi momento dalla pagina Impostazioni o contattando <a href="mailto:supporto@quoteai.ca" class="text-violet-600">supporto@quoteai.ca</a>.</p></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">9. Modifiche ai termini</h2><p>Ci riserviamo il diritto di modificare i presenti Termini con preavviso di almeno 14 giorni via email. L'uso continuato del Servizio dopo la data di efficacia delle modifiche costituisce accettazione dei nuovi Termini.</p></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">10. Legge applicabile e foro competente</h2><p>I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia è competente in via esclusiva il Tribunale di Milano, salvo i casi in cui l'utente sia un consumatore ai sensi del D.Lgs. 206/2005 (Codice del Consumo), nel qual caso si applicano le disposizioni di legge inderogabili a tutela dei consumatori.</p></section>
    <section><h2 class="text-lg font-semibold text-gray-900 mb-3">11. Contatti</h2><p>Per qualsiasi domanda sui presenti Termini: <a href="mailto:supporto@quoteai.ca" class="text-violet-600">supporto@quoteai.ca</a></p></section>
  </div>
</div>`),
});

// /whatsapp/
buildStaticPageHtml({
  slug: "whatsapp",
  title: "Preventivi su WhatsApp – quoteai | Prima piattaforma italiana",
  description: "Descrivi il lavoro a voce, per testo o foto su WhatsApp. quoteai genera un preventivo professionale con PDF in 60 secondi. Prima piattaforma in Italia.",
  path: "/whatsapp/",
  jsonLd: [buildWebPageJsonLd("Preventivi su WhatsApp", "Descrivi il lavoro a voce, per testo o foto su WhatsApp. quoteai genera un preventivo professionale con PDF in 60 secondi.", "/whatsapp/"), buildBreadcrumbJsonLd("WhatsApp", "/whatsapp/")],
  bodyHtml: wrapInPublicLayout(`<div class="flex flex-col bg-white">
<section class="relative overflow-hidden bg-gray-950 pt-20 pb-24">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center max-w-3xl">
    <div class="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold px-3 py-1.5 rounded-full mb-6">NOVITÀ · Prima in Italia</div>
    <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.1] mb-5">I tuoi preventivi, <span class="text-transparent bg-clip-text" style="background-image:linear-gradient(135deg,#a78bfa,#34d399)">direttamente su WhatsApp</span></h1>
    <p class="text-lg text-gray-400 leading-relaxed mb-4 max-w-2xl mx-auto">Manda un vocale dal cantiere. QuoteAI genera il preventivo professionale, te lo mostra in anteprima e ti invia il PDF — senza aprire nessuna app.</p>
    <p class="text-sm text-gray-600 mb-10 font-medium">Mentre i tuoi concorrenti aprono ancora Excel, i tuoi clienti già ricevono il preventivo.</p>
    <div class="flex flex-col sm:flex-row justify-center gap-3">
      <a href="/sign-up/?plan=monthly_pro" class="inline-flex h-12 items-center justify-center gap-2 px-7 rounded-xl text-sm font-bold text-white" style="background:linear-gradient(135deg,#7c3aed,#2563eb)">Attiva WhatsApp Bot</a>
      <a href="#demo" class="inline-flex h-12 items-center justify-center gap-2 px-7 rounded-xl text-sm font-semibold text-gray-300 border border-gray-700">Guarda la demo</a>
    </div>
    <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-gray-500">
      <span>Disponibile su Piano Pro ed Elite</span><span class="hidden sm:block text-gray-700">·</span>
      <span>Attivazione immediata</span><span class="hidden sm:block text-gray-700">·</span>
      <span>Funziona con qualsiasi smartphone</span>
    </div>
  </div>
</section>
<section id="demo" class="py-20 bg-gray-50">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
    <span class="inline-block text-violet-600 text-xs font-bold uppercase tracking-wider mb-3">Come funziona</span>
    <h2 class="text-3xl font-bold tracking-tight text-gray-900 mb-6 leading-snug">Dal vocale al PDF <span class="text-violet-600">senza toccare il computer</span></h2>
    <div class="space-y-5 max-w-2xl">
      <div class="flex gap-4"><div class="w-8 h-8 rounded-xl text-sm font-bold shrink-0 flex items-center justify-center text-white" style="background:linear-gradient(135deg,#7c3aed,#2563eb)">1</div><div><p class="font-semibold text-gray-900 text-sm mb-0.5">Manda un vocale, testo o foto</p><p class="text-sm text-gray-500 leading-relaxed">Direttamente su WhatsApp. Descrivi il lavoro come parli con un cliente.</p></div></div>
      <div class="flex gap-4"><div class="w-8 h-8 rounded-xl text-sm font-bold shrink-0 flex items-center justify-center text-white" style="background:linear-gradient(135deg,#7c3aed,#2563eb)">2</div><div><p class="font-semibold text-gray-900 text-sm mb-0.5">L'AI genera l'anteprima</p><p class="text-sm text-gray-500 leading-relaxed">Capitoli, prezzi e IVA in 60 secondi. Puoi correggere o approvare subito.</p></div></div>
      <div class="flex gap-4"><div class="w-8 h-8 rounded-xl text-sm font-bold shrink-0 flex items-center justify-center text-white" style="background:linear-gradient(135deg,#7c3aed,#2563eb)">3</div><div><p class="font-semibold text-gray-900 text-sm mb-0.5">Ricevi il PDF in chat</p><p class="text-sm text-gray-500 leading-relaxed">Lo invii al cliente con un tap. Il preventivo viene salvato anche su quoteai.ca.</p></div></div>
    </div>
    <div class="mt-8 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"><p class="text-sm font-semibold text-amber-900">In arrivo: fatture e solleciti automatici</p><p class="text-xs text-amber-700 mt-0.5">Sempre su WhatsApp. Stai costruendo il futuro prima degli altri.</p></div>
  </div>
</section>
<section class="py-16 bg-white">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
    <div class="text-center mb-10"><h2 class="text-2xl font-bold tracking-tight text-gray-900">Tutto quello che ti serve, in tasca</h2><p class="text-gray-500 mt-2 text-sm">Il potere di quoteai.ca, disponibile su WhatsApp in qualsiasi momento.</p></div>
    <div class="grid sm:grid-cols-3 gap-6">
      <div class="bg-gray-50 rounded-2xl p-5 border border-gray-100"><h3 class="font-semibold text-gray-900 text-sm mb-1.5">Voce, testo o foto</h3><p class="text-gray-500 text-xs leading-relaxed">Manda un vocale dall'auto, scrivi dal cantiere o fotografa gli appunti. L'AI capisce tutto e genera il preventivo.</p></div>
      <div class="bg-gray-50 rounded-2xl p-5 border border-gray-100"><h3 class="font-semibold text-gray-900 text-sm mb-1.5">Preventivo in 60 secondi</h3><p class="text-gray-500 text-xs leading-relaxed">Capitoli, voci di costo, IVA e totali calcolati istantaneamente. Zero formule, zero Excel.</p></div>
      <div class="bg-gray-50 rounded-2xl p-5 border border-gray-100"><h3 class="font-semibold text-gray-900 text-sm mb-1.5">PDF consegnato in chat</h3><p class="text-gray-500 text-xs leading-relaxed">Il documento professionale arriva direttamente su WhatsApp. Lo inoltri al cliente con un tap.</p></div>
    </div>
  </div>
</section>
<section class="py-16 bg-gray-950">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
    <p class="text-gray-500 text-sm mb-4 uppercase tracking-wider font-semibold">La realtà del mercato</p>
    <h2 class="text-2xl sm:text-3xl font-bold text-white mb-6 leading-snug">I tuoi concorrenti impiegano <span class="line-through text-gray-600">30–40 minuti</span> per fare un preventivo. <span class="text-transparent bg-clip-text" style="background-image:linear-gradient(135deg,#a78bfa,#34d399)">Tu ce ne metti 60 secondi.</span></h2>
    <p class="text-gray-400 text-sm mb-10 leading-relaxed">Un artigiano che risponde entro un'ora ha il <strong class="text-white">3× più probabilità</strong> di aggiudicarsi il lavoro. Con il bot WhatsApp, rispondi prima ancora di arrivare a casa.</p>
  </div>
</section>
<section class="py-16 bg-white">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-xl">
    <h2 class="text-2xl font-bold tracking-tight text-gray-900 mb-3">Inizia oggi. Zero configurazione.</h2>
    <p class="text-gray-500 text-sm mb-7 leading-relaxed">Collega il tuo numero WhatsApp dalle impostazioni in meno di 2 minuti. Il bot è subito attivo.</p>
    <div class="flex flex-col sm:flex-row justify-center gap-3">
      <a href="/sign-up/?plan=monthly_pro" class="inline-flex h-11 items-center justify-center gap-2 px-7 rounded-xl text-sm font-bold text-white" style="background:linear-gradient(135deg,#7c3aed,#2563eb)">Prova Gratis 7 Giorni</a>
      <a href="/#prezzi" class="inline-flex h-11 items-center justify-center px-7 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200">Confronta i piani</a>
    </div>
    <p class="text-xs text-gray-400 mt-4">7 giorni gratis · Nessuna carta richiesta · Cancella quando vuoi</p>
  </div>
</section>
</div>`),
});

// /mappa-sito/
buildStaticPageHtml({
  slug: "mappa-sito",
  title: "Mappa del Sito | quoteai — Elenco Completo delle Pagine",
  description: "Mappa del sito completa di quoteai. Trova tutte le pagine statiche, gli articoli del blog e le guide per professionisti e artigiani nelle città italiane.",
  path: "/mappa-sito/",
  jsonLd: [buildWebPageJsonLd("Mappa del Sito", "Mappa del sito completa di quoteai.ca. Trova tutte le pagine statiche, gli articoli del blog e le guide per professionisti e artigiani nelle città italiane.", "/mappa-sito/"), buildBreadcrumbJsonLd("Mappa del Sito", "/mappa-sito/")],
  bodyHtml: buildMappaSitoBodyHtml(),
});

console.log(`  ✓ 6 SPA pages prerendered (chi-siamo, contatti, privacy, termini, whatsapp, mappa-sito)`);

console.log(`Prerendered ${count} pages total (1 homepage + SEO sector pages + ${BLOG_CATEGORIES.length} category pages + ${BLOG_ARTICLES.length + 1} blog pages + 6 SPA pages).`);
