/**
 * seo-render-engine.ts
 *
 * Single source of truth for all city-page SEO data derivation.
 * Imported by BOTH scripts/prerender-seo.ts (Node.js SSG) and
 * src/pages/seo/city-landing.tsx (React runtime).
 * Guarantees full content parity between prerendered HTML and client React render.
 *
 * Rules:
 *  – No HTML template literals (prerender keeps those; React uses JSX)
 *  – No DOM / browser APIs at module scope
 *  – All functions are pure and deterministic
 */

import type { SectorData, CityData } from "./seo-data.js";
import {
  getCityTitle,
  getCityDesc,
  CITIES_BY_SLUG,
  RELATED_SECTORS,
  CITY_CONTEXT,
  ACTIVE_CITY_SLUGS,
  CITY_SECTORS,
  SECTORS,
} from "./seo-data.js";
import { CITY_INTELLIGENCE, DEMAND_TEXT } from "./seo-intelligence.js";
import type { CityIntelligence } from "./seo-intelligence.js";

export { getCityTitle, getCityDesc };
export type { CityIntelligence, SectorData, CityData };

const BASE_URL = "https://quoteai.ca";

// ─── Deterministic hash ────────────────────────────────────────────────────

export function strHash(s: string): number {
  return s.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

// ─── OG image path ────────────────────────────────────────────────────────

const SECTOR_OG_IMAGES: Record<string, string> = {
  "general-contractor": "/og/sectors/general-contractor.png",
  "renovation-contractor": "/og/sectors/renovation-contractor.png",
  electrician: "/og/sectors/electrician.png",
  plumber: "/og/sectors/plumber.png",
  painter: "/og/sectors/painter.png",
  "welder-fabricator": "/og/sectors/welder-fabricator.png",
  "carpenter-cabinetmaker": "/og/sectors/carpenter-cabinetmaker.png",
  "hvac-technician": "/og/sectors/hvac-technician.png",
  freelance: "/og/sectors/freelance.png",
  "building-consultant": "/og/sectors/building-consultant.png",
};

export function getOgImagePath(sectorSlug: string): string {
  return SECTOR_OG_IMAGES[sectorSlug] ?? "/opengraph.jpg";
}

// ─── Intro text — 4 variants, sectorType-aware, deterministic by city.slug ─
//
// NOTE (i18n follow-up): these strings are English-only today. There is no
// locale-prefixed routing yet (see CITIES in seo-data.ts), so every function
// in this file always renders English. When fr-CA routes are added, the
// cleanest path is to thread a `lang: "en-CA" | "fr-CA"` argument through
// each of these generator functions (defaulting to "en-CA") and add a French
// variant array alongside each English one — the CITY_CONTEXT data shape in
// seo-data.ts already anticipates this (see CityContextEntry).

export function getCityIntro(sector: SectorData, city: CityData): string {
  const isService = sector.sectorType === "service";
  const variants = isService
    ? [
        `Running a ${sector.label.toLowerCase()} business in ${city.name}? quoteai is the AI quoting software built for trades professionals across ${city.region}. Describe the job in plain English, get a professional document in 30 seconds.`,
        `${city.name} sees thousands of ${sector.label.toLowerCase()} jobs and contracts every year. Professionals using quoteai respond to customers in minutes instead of days, winning more jobs. No Excel, no paper.`,
        `In a market like ${city.name}, competition in the ${sector.label.toLowerCase()} space is fierce. Whoever sends the quote first has a real edge. With quoteai you do it in 30 seconds, still standing in front of the customer — right from your phone.`,
        `Running a ${sector.label.toLowerCase()} business in ${city.name} means juggling complex quotes. quoteai handles the admin side: describe the job, the AI generates the full quote, and you focus on the work.`,
      ]
    : [
        `Are you a ${sector.label.toLowerCase()} in ${city.name} losing hours to spreadsheets or paper quotes? quoteai is the AI quoting software built for trades professionals across ${city.region}. Describe the job in plain English, get a professional document in 30 seconds.`,
        `${city.name} has thousands of active tradespeople and small businesses. The ${sector.labelPlural} who use quoteai respond to customers in minutes instead of days, and win more jobs. No Excel, no paper.`,
        `In a city like ${city.name}, competition among ${sector.labelPlural} is fierce. Whoever sends the quote first has a real edge. With quoteai you do it in 30 seconds, still standing in front of the customer — right from your phone.`,
        `Working as a ${sector.label.toLowerCase()} in ${city.name} means juggling many customers with different needs. quoteai handles the admin side: describe the job, the AI generates the full quote, and you focus on the trade.`,
      ];
  return variants[strHash(city.slug) % variants.length];
}

// ─── FAQ items — 4 dynamic items, unified between visible HTML and JSON-LD ─

export interface CityFaqItem {
  q: string;
  a: string;
}

export function getCityFaqItems(sector: SectorData, city: CityData): CityFaqItem[] {
  const intel = CITY_INTELLIGENCE[city.slug];
  const pricePct = intel ? Math.round(Math.abs(intel.priceIndex - 1.0) * 100) : 0;

  const priceAnswer = intel
    ? intel.priceIndex > 1.05
      ? `Prices for ${sector.label.toLowerCase()} services in ${city.name} run about ${pricePct}% above the Canadian average. Presenting a professional, detailed quote is essential to justify the price and earn the customer's trust.`
      : intel.priceIndex < 0.95
        ? `In ${city.name}, prices for ${sector.labelPlural} run about ${pricePct}% below the Canadian average. In a competitive market like this, responding quickly with a professional quote is the most effective way to stand out.`
        : `Prices for ${sector.labelPlural} in ${city.name} are in line with the Canadian average. Response speed and quote quality are what make the difference in winning the job.`
    : `Prices vary based on job complexity and location. With quoteai you can generate professional quotes in 30 seconds and show your competitiveness right away.`;

  const leadTimeAnswer = intel
    ? intel.demandLevel === "CRITICAL"
      ? `Demand in ${city.name} is very high: typical response times run about ${intel.avgLeadTime}. Sending the quote within minutes of the walkthrough — as quoteai lets you do — significantly improves your odds of winning the job.`
      : intel.demandLevel === "HIGH"
        ? `With ${DEMAND_TEXT[intel.demandLevel]} demand in ${city.name}, professionals typically respond within ${intel.avgLeadTime}. Sending a professional quote right away is the best way to lock in the job.`
        : intel.demandLevel === "MEDIUM"
          ? `Standard response times for ${sector.labelPlural} in ${city.name} run about ${intel.avgLeadTime}. A professional quote sent the same day can make the difference versus the competition.`
          : `The ${city.name} market sees ${DEMAND_TEXT[intel.demandLevel]} demand for this type of service, with response times of about ${intel.avgLeadTime}. Professionalism and speed remain important differentiators.`
    : `Response times depend on local availability. With quoteai you can respond to new requests in 30 seconds and improve your odds on every job.`;

  return [
    {
      q: `How do I get a professional quote in ${city.name}?`,
      a: `With quoteai it takes 30 seconds. Describe the job in plain English in the text field, and the AI engine automatically generates the document with cost line items, quantities, unit prices, and tax. Download it as a PDF and send it straight to your customer in ${city.name}.`,
    },
    {
      q: `Does quoteai work for ${sector.labelPlural} in ${city.name} and across ${city.region}?`,
      a: `Yes. quoteai is a web app accessible from any device with an internet connection. There are no geographic restrictions: it works in ${city.name} just as well as anywhere else in Canada.`,
    },
    {
      q: `How much do ${sector.label.toLowerCase()} services cost in ${city.name}?`,
      a: priceAnswer,
    },
    {
      q: `What's the average response time for ${sector.labelPlural} in ${city.name}?`,
      a: leadTimeAnswer,
    },
  ];
}

// ─── How-it-works steps (hardcoded per city, matching prerender exactly) ───

export interface HowItWorksStep {
  n: string;
  title: string;
  desc: string;
}

export function getCityHowItWorksSteps(cityName: string): HowItWorksStep[] {
  return [
    {
      n: "1",
      title: "Describe the job",
      desc: `From your phone in ${cityName}, write what you need to do in the language you use every day. The AI understands trade terminology.`,
    },
    {
      n: "2",
      title: "AI generates the quote",
      desc: "quoteai identifies the cost line items, estimates quantities, and calculates totals and tax automatically. Zero mistakes, zero manual math.",
    },
    {
      n: "3",
      title: "Send it to the customer",
      desc: `A professional PDF in 30 seconds. Send it by text or email to your customer in ${cityName} before you've even left the job site.`,
    },
  ];
}

// ─── Layout & CTA variant selection (hash-based, deterministic) ────────────

export function getCityLayout(sector: SectorData, city: CityData): 0 | 1 | 2 {
  return (strHash(sector.slug + city.slug) % 3) as 0 | 1 | 2;
}

export function getCityCtaVariant(sector: SectorData, city: CityData): 0 | 1 | 2 {
  return (strHash(sector.slug + city.slug + "cta") % 3) as 0 | 1 | 2;
}

export interface CtaTexts {
  headingPrefix: string;
  headingGradient: string;
  button: string;
}

export function getCityCtaTexts(ctaVariant: 0 | 1 | 2, cityName: string): CtaTexts {
  switch (ctaVariant) {
    case 1:
      return {
        headingPrefix: `Your first professional PDF in ${cityName} is `,
        headingGradient: "completely free",
        button: "Create free account",
      };
    case 2:
      return {
        headingPrefix: "Stop wasting time. Generate the quote ",
        headingGradient: "while you're still with the customer",
        button: "Try free — no commitment",
      };
    default:
      return {
        headingPrefix: `Start creating quotes in ${cityName} `,
        headingGradient: "in 30 seconds",
        button: "Get Started Free",
      };
  }
}

// ─── Nearby city anchors — semantic, price-aware ──────────────────────────

export interface NearbyAnchor {
  slug: string;
  name: string;
  anchorText: string;
}

export function getNearbyAnchors(sector: SectorData, city: CityData): NearbyAnchor[] {
  return city.nearbySlug
    .map((slug): NearbyAnchor | null => {
      const nearbyCity = CITIES_BY_SLUG[slug];
      if (!nearbyCity) return null;
      // Don't link toward cities outside the active set — those pages
      // aren't prerendered/indexable right now (see ACTIVE_CITY_SLUGS).
      if (!ACTIVE_CITY_SLUGS.has(nearbyCity.slug)) return null;
      const nearbyIntel = CITY_INTELLIGENCE[slug];
      const anchorText = nearbyIntel
        ? nearbyIntel.priceIndex > 1.05
          ? `${sector.label} Quotes in ${nearbyCity.name}`
          : nearbyIntel.priceIndex < 0.95
            ? `${sector.label} Costs in ${nearbyCity.name}`
            : `${sector.label} in ${nearbyCity.name}`
        : nearbyCity.name;
      return { slug: nearbyCity.slug, name: nearbyCity.name, anchorText };
    })
    .filter((x): x is NearbyAnchor => x !== null);
}

// ─── Osservatorio widget data ─────────────────────────────────────────────

export interface OsservatorioData {
  priceLabel: string;
  priceColorClass: string;
  demandLabel: string;
  demandColorClass: string;
  avgLeadTime: string;
  topServices: [string, string, string];
  localInsight: string;
}

export function getOsservatorioData(citySlug: string): OsservatorioData | null {
  const intel = CITY_INTELLIGENCE[citySlug];
  if (!intel) return null;
  const pct = Math.round(Math.abs(intel.priceIndex - 1.0) * 100);
  const priceLabel =
    intel.priceIndex > 1.0 ? `+${pct}%` : intel.priceIndex < 1.0 ? `−${pct}%` : `±0%`;
  const priceColorClass =
    intel.priceIndex > 1.05
      ? "text-amber-600"
      : intel.priceIndex < 0.95
        ? "text-green-600"
        : "text-gray-800";
  const demandLabels: Record<CityIntelligence["demandLevel"], string> = {
    LOW: "Moderate",
    MEDIUM: "Average",
    HIGH: "High",
    CRITICAL: "Very high",
  };
  const demandColorClasses: Record<CityIntelligence["demandLevel"], string> = {
    LOW: "text-green-600",
    MEDIUM: "text-blue-600",
    HIGH: "text-amber-600",
    CRITICAL: "text-red-600",
  };
  return {
    priceLabel,
    priceColorClass,
    demandLabel: demandLabels[intel.demandLevel],
    demandColorClass: demandColorClasses[intel.demandLevel],
    avgLeadTime: intel.avgLeadTime,
    topServices: intel.topServices,
    localInsight: intel.localInsight,
  };
}

// ─── City context text ────────────────────────────────────────────────────
//
// `lang` defaults to "en-CA" and today always resolves the `en` field —
// CITY_CONTEXT entries don't have `fr` populated yet (see seo-data.ts). The
// parameter exists so the follow-up i18n pass can wire up fr-CA without
// changing this function's signature again.
export function getCityContextText(citySlug: string, lang: "en-CA" | "fr-CA" = "en-CA"): string | null {
  const entry = CITY_CONTEXT[citySlug];
  if (!entry) return null;
  return (lang === "fr-CA" ? entry.fr : entry.en) ?? entry.en ?? null;
}

// ─── Related sectors ─────────────────────────────────────────────────────

export function getCityRelatedSectors(sectorSlug: string): { slug: string; label: string }[] {
  return RELATED_SECTORS[sectorSlug] ?? [];
}

// ─── Same-city, other trades — cross-links every city page to sibling ────
// trade pages for the same city (e.g. painter/toronto → electrician/toronto).
// Rotated deterministically per city+sector so the ~18 local trades get an
// even spread of inbound links across a city's pages rather than always
// linking the same subset from every page.

export function getSameCityOtherSectors(
  sectorSlug: string,
  citySlug: string,
  limit = 6
): { slug: string; label: string }[] {
  const others = CITY_SECTORS.filter((slug) => slug !== sectorSlug);
  if (others.length === 0) return [];
  const start = strHash(citySlug + sectorSlug) % others.length;
  const rotated = [...others.slice(start), ...others.slice(0, start)];
  return rotated.slice(0, limit).map((slug) => ({ slug, label: SECTORS[slug].label }));
}

// ─── JSON-LD schemas (unified — same FAQ text as visible body) ────────────

export type JsonLdSchema = { "@context": string; "@type": string; [key: string]: unknown };

export function buildCityJsonLd(sector: SectorData, city: CityData): JsonLdSchema[] {
  const canonical = `${BASE_URL}/quotes/${sector.slug}/${city.slug}/`;
  const faqItems = getCityFaqItems(sector, city);
  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "quoteai",
      description: `AI quoting software for ${sector.labelPlural} in ${city.name} (${city.region}).`,
      url: canonical,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "en",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "CAD",
        availability: "https://schema.org/InStock",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `${sector.label} Quotes in ${city.name}`,
      description: `AI quoting software for ${sector.labelPlural} in ${city.name}`,
      serviceType: `${sector.label} Quoting`,
      provider: { "@type": "Organization", name: "quoteai", url: BASE_URL },
      areaServed: [
        { "@type": "City", name: city.name },
        { "@type": "State", name: city.region },
        { "@type": "Country", name: "Canada" },
      ],
      url: canonical,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: sector.label, item: `${BASE_URL}/quotes/${sector.slug}/` },
        { "@type": "ListItem", position: 3, name: city.name, item: canonical },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
}

// ─── Dev content-parity verification ─────────────────────────────────────

export function verifyCityContentInDev(
  sector: SectorData,
  city: CityData,
  rendered: { intro: string; faqAnswers: string[]; ctaButton: string }
): void {
  if (typeof window === "undefined") return;
  try {
    const meta = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
    if (!meta?.DEV) return;
  } catch {
    return;
  }

  const expectedIntro = getCityIntro(sector, city);
  const expectedFaq = getCityFaqItems(sector, city);
  const expectedCta = getCityCtaTexts(getCityCtaVariant(sector, city), city.name);
  const mismatches: string[] = [];

  if (rendered.intro !== expectedIntro) mismatches.push("intro");
  rendered.faqAnswers.forEach((a, i) => {
    if (a !== expectedFaq[i]?.a) mismatches.push(`faq[${i}].answer`);
  });
  if (rendered.ctaButton !== expectedCta.button) mismatches.push("ctaButton");

  if (mismatches.length > 0) {
    console.warn(
      `[seo-render-engine] Content mismatch on /quotes/${sector.slug}/${city.slug}: ` +
        mismatches.join(", ") +
        ". SeoCityLanding must consume all data exclusively from seo-render-engine.ts."
    );
  }
}
