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
  CITIES_BY_SLUG,
  RELATED_SECTORS,
  CITY_CONTEXT,
  ACTIVE_CITY_SLUGS,
  CITY_SECTORS,
  SECTORS,
  localizeCity,
} from "./seo-data.js";
import { CITY_INTELLIGENCE, DEMAND_TEXT } from "./seo-intelligence.js";
import type { CityIntelligence } from "./seo-intelligence.js";

export type { CityIntelligence, SectorData, CityData };

const BASE_URL = "https://quoteai.ca";

export type Lang = "en-CA" | "fr-CA";

/** Sector label/labelPlural for the given lang — "fr-CA" reads sector.fr.*. */
function sectorLabel(sector: SectorData, lang: Lang): { label: string; labelPlural: string } {
  return lang === "fr-CA"
    ? { label: sector.fr.label, labelPlural: sector.fr.labelPlural }
    : { label: sector.label, labelPlural: sector.labelPlural };
}

/** City path segment for the given lang: /quotes/ (en) or /fr/soumissions/ (fr). */
export function cityBasePath(lang: Lang): string {
  return lang === "fr-CA" ? "/fr/soumissions" : "/quotes";
}

/** Sector slug for the given lang — frSlug under /fr/soumissions/. */
function sectorPathSlug(sector: SectorData, lang: Lang): string {
  return lang === "fr-CA" ? sector.frSlug : sector.slug;
}

// ─── Deterministic hash ────────────────────────────────────────────────────

function strHash(s: string): number {
  return s.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

// ─── OG image path ────────────────────────────────────────────────────────
// scripts/generate-sector-og-images.ts renders /og/sectors/<slug>.png for
// every entry in SECTORS at build time (Phase 68: it used to cover 10 of the
// 22 sectors, and the prerender script carried a stale copy of this map that
// pointed at /og/<slug>.jpg — a 404 on all 210 sector/city pages).

export function getOgImagePath(sectorSlug: string): string {
  return sectorSlug in SECTORS ? `/og/sectors/${sectorSlug}.png` : "/opengraph.jpg?v=2";
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

export function getCityIntro(sector: SectorData, city: CityData, lang: Lang = "en-CA"): string {
  // Phase 81: French pages show the city's and province's French names.
  city = localizeCity(city, lang);
  const isService = sector.sectorType === "service";
  if (lang === "fr-CA") {
    const { label, labelPlural } = sectorLabel(sector, lang);
    const labelL = label.toLowerCase();
    const variantsFr = isService
      ? [
          `Vous dirigez une entreprise de ${labelL} à ${city.name}? quoteai est le logiciel de soumission par IA conçu pour les artisans partout au ${city.region}. Décrivez le travail en langage naturel et obtenez un document professionnel en 30 secondes.`,
          `${city.name} voit passer des milliers de contrats de ${labelL} chaque année. Les professionnels qui utilisent quoteai répondent aux clients en minutes plutôt qu'en jours, et remportent plus de contrats. Fini Excel, fini le papier.`,
          `Dans un marché comme ${city.name}, la concurrence dans le domaine de ${labelL} est féroce. Celui qui envoie sa soumission en premier a un réel avantage. Avec quoteai, vous le faites en 30 secondes, encore devant le client — directement depuis votre téléphone.`,
          `Diriger une entreprise de ${labelL} à ${city.name} veut dire jongler avec des soumissions complexes. quoteai s'occupe de l'administratif : décrivez le travail, l'IA génère la soumission complète, et vous vous concentrez sur le chantier.`,
        ]
      : [
          `Êtes-vous ${labelL} à ${city.name} et perdez-vous des heures avec des tableurs ou des soumissions papier? quoteai est le logiciel de soumission par IA conçu pour les artisans partout au ${city.region}. Décrivez le travail en langage naturel et obtenez un document professionnel en 30 secondes.`,
          `${city.name} compte des milliers d'artisans et de petites entreprises actifs. Les ${labelPlural} qui utilisent quoteai répondent aux clients en minutes plutôt qu'en jours, et remportent plus de contrats. Fini Excel, fini le papier.`,
          `Dans une ville comme ${city.name}, la concurrence entre ${labelPlural} est féroce. Celui qui envoie sa soumission en premier a un réel avantage. Avec quoteai, vous le faites en 30 secondes, encore devant le client — directement depuis votre téléphone.`,
          `Travailler comme ${labelL} à ${city.name} veut dire jongler avec plusieurs clients aux besoins différents. quoteai s'occupe de l'administratif : décrivez le travail, l'IA génère la soumission complète, et vous vous concentrez sur votre métier.`,
        ];
    return variantsFr[strHash(city.slug) % variantsFr.length];
  }
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

const DEMAND_TEXT_FR: Record<CityIntelligence["demandLevel"], string> = {
  LOW: "modérée",
  MEDIUM: "moyenne",
  HIGH: "élevée",
  CRITICAL: "très élevée",
};

export function getCityFaqItems(sector: SectorData, city: CityData, lang: Lang = "en-CA"): CityFaqItem[] {
  // Phase 81: French pages show the city's and province's French names.
  city = localizeCity(city, lang);
  const intel = CITY_INTELLIGENCE[city.slug];
  const pricePct = intel ? Math.round(Math.abs(intel.priceIndex - 1.0) * 100) : 0;

  if (lang === "fr-CA") {
    const { label, labelPlural } = sectorLabel(sector, lang);
    const labelL = label.toLowerCase();
    const priceAnswerFr = intel
      ? intel.priceIndex > 1.05
        ? `Les prix des services de ${labelL} à ${city.name} sont environ ${pricePct}% au-dessus de la moyenne canadienne. Présenter une soumission professionnelle et détaillée est essentiel pour justifier le prix et gagner la confiance du client.`
        : intel.priceIndex < 0.95
          ? `À ${city.name}, les prix pour les ${labelPlural} sont environ ${pricePct}% sous la moyenne canadienne. Dans un marché aussi compétitif, répondre rapidement avec une soumission professionnelle est le meilleur moyen de se démarquer.`
          : `Les prix pour les ${labelPlural} à ${city.name} sont dans la moyenne canadienne. La rapidité de réponse et la qualité de la soumission font la différence pour remporter le contrat.`
      : `Les prix varient selon la complexité du travail et l'emplacement. Avec quoteai, vous pouvez générer des soumissions professionnelles en 30 secondes et démontrer votre compétitivité immédiatement.`;

    const leadTimeAnswerFr = intel
      ? intel.demandLevel === "CRITICAL"
        ? `La demande à ${city.name} est très élevée : les délais de réponse habituels sont d'environ ${intel.avgLeadTime}. Envoyer la soumission quelques minutes après la visite — comme le permet quoteai — améliore considérablement vos chances de remporter le contrat.`
        : intel.demandLevel === "HIGH"
          ? `Avec une demande ${DEMAND_TEXT_FR[intel.demandLevel]} à ${city.name}, les professionnels répondent habituellement en ${intel.avgLeadTime}. Envoyer une soumission professionnelle rapidement reste le meilleur moyen de décrocher le contrat.`
          : intel.demandLevel === "MEDIUM"
            ? `Les délais de réponse habituels pour les ${labelPlural} à ${city.name} sont d'environ ${intel.avgLeadTime}. Une soumission professionnelle envoyée le jour même peut faire la différence face à la concurrence.`
            : `Le marché de ${city.name} affiche une demande ${DEMAND_TEXT_FR[intel.demandLevel]} pour ce type de service, avec des délais de réponse d'environ ${intel.avgLeadTime}. Le professionnalisme et la rapidité demeurent des atouts importants.`
      : `Les délais de réponse dépendent de la disponibilité locale. Avec quoteai, vous pouvez répondre aux nouvelles demandes en 30 secondes et améliorer vos chances sur chaque contrat.`;

    return [
      {
        q: `Comment obtenir une soumission professionnelle à ${city.name}?`,
        a: `Avec quoteai, ça prend 30 secondes. Décrivez le travail en langage naturel dans le champ de texte, et le moteur d'IA génère automatiquement le document avec les postes de coûts, quantités, prix unitaires et taxes. Téléchargez le PDF et envoyez-le directement à votre client à ${city.name}.`,
      },
      {
        q: `quoteai fonctionne-t-il pour les ${labelPlural} à ${city.name} et dans tout le ${city.region}?`,
        a: `Oui. quoteai est une application web accessible depuis n'importe quel appareil avec une connexion internet. Il n'y a aucune restriction géographique : ça fonctionne à ${city.name} tout comme ailleurs au Canada.`,
      },
      {
        q: `Combien coûtent les services de ${labelL} à ${city.name}?`,
        a: priceAnswerFr,
      },
      {
        q: `Quel est le délai de réponse moyen pour les ${labelPlural} à ${city.name}?`,
        a: leadTimeAnswerFr,
      },
    ];
  }

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

export function getCityHowItWorksSteps(cityName: string, lang: Lang = "en-CA"): HowItWorksStep[] {
  if (lang === "fr-CA") {
    return [
      {
        n: "1",
        title: "Décrivez le travail",
        desc: `Depuis votre téléphone à ${cityName}, écrivez ce que vous devez faire dans vos propres mots. L'IA comprend le vocabulaire des métiers.`,
      },
      {
        n: "2",
        title: "L'IA génère la soumission",
        desc: "quoteai identifie les postes de coûts, estime les quantités et calcule automatiquement les totaux et les taxes. Zéro erreur, zéro calcul manuel.",
      },
      {
        n: "3",
        title: "Envoyez-la au client",
        desc: `Un PDF professionnel en 30 secondes. Envoyez-le par texto ou courriel à votre client à ${cityName} avant même d'avoir quitté le chantier.`,
      },
    ];
  }
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

export function getCityCtaTexts(ctaVariant: 0 | 1 | 2, cityName: string, lang: Lang = "en-CA"): CtaTexts {
  if (lang === "fr-CA") {
    switch (ctaVariant) {
      case 1:
        return {
          headingPrefix: `Votre premier PDF professionnel à ${cityName} est `,
          headingGradient: "entièrement gratuit",
          button: "Créer un compte gratuit",
        };
      case 2:
        return {
          headingPrefix: "Arrêtez de perdre du temps. Générez la soumission ",
          headingGradient: "pendant que vous êtes encore avec le client",
          button: "Essayer gratuitement — sans engagement",
        };
      default:
        return {
          headingPrefix: `Commencez à créer des soumissions à ${cityName} `,
          headingGradient: "en 30 secondes",
          button: "Commencer gratuitement",
        };
    }
  }
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

export function getNearbyAnchors(sector: SectorData, city: CityData, lang: Lang = "en-CA"): NearbyAnchor[] {
  // Phase 81: French pages show the city's and province's French names.
  city = localizeCity(city, lang);
  const { label } = sectorLabel(sector, lang);
  return city.nearbySlug
    .map((slug): NearbyAnchor | null => {
      const nearbyCity = CITIES_BY_SLUG[slug] ? localizeCity(CITIES_BY_SLUG[slug]!, lang) : undefined;
      if (!nearbyCity) return null;
      // Don't link toward cities outside the active set — those pages
      // aren't prerendered/indexable right now (see ACTIVE_CITY_SLUGS).
      if (!ACTIVE_CITY_SLUGS.has(nearbyCity.slug)) return null;
      const nearbyIntel = CITY_INTELLIGENCE[slug];
      const anchorText =
        lang === "fr-CA"
          ? nearbyIntel
            ? nearbyIntel.priceIndex > 1.05
              ? `Soumissions ${label} à ${nearbyCity.name}`
              : nearbyIntel.priceIndex < 0.95
                ? `Coûts ${label} à ${nearbyCity.name}`
                : `${label} à ${nearbyCity.name}`
            : nearbyCity.name
          : nearbyIntel
            ? nearbyIntel.priceIndex > 1.05
              ? `${label} Quotes in ${nearbyCity.name}`
              : nearbyIntel.priceIndex < 0.95
                ? `${label} Costs in ${nearbyCity.name}`
                : `${label} in ${nearbyCity.name}`
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
  limit = 6,
  lang: Lang = "en-CA"
): { slug: string; label: string }[] {
  const others = CITY_SECTORS.filter((slug) => slug !== sectorSlug);
  if (others.length === 0) return [];
  const start = strHash(citySlug + sectorSlug) % others.length;
  const rotated = [...others.slice(start), ...others.slice(0, start)];
  return rotated.slice(0, limit).map((slug) => ({
    slug,
    label: lang === "fr-CA" ? SECTORS[slug].fr.label : SECTORS[slug].label,
  }));
}

// ─── JSON-LD schemas (unified — same FAQ text as visible body) ────────────

export type JsonLdSchema = { "@context": string; "@type": string; [key: string]: unknown };

export function buildCityJsonLd(sector: SectorData, city: CityData, lang: Lang = "en-CA"): JsonLdSchema[] {
  // Phase 81: French pages show the city's and province's French names.
  city = localizeCity(city, lang);
  const base = cityBasePath(lang);
  const sSlug = sectorPathSlug(sector, lang);
  const canonical = `${BASE_URL}${base}/${sSlug}/${city.slug}/`;
  const sectorPageUrl = `${BASE_URL}${base}/${sSlug}/`;
  const faqItems = getCityFaqItems(sector, city, lang);
  const { label, labelPlural } = sectorLabel(sector, lang);

  if (lang === "fr-CA") {
    return [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "quoteai",
        description: `Logiciel de soumission par IA pour les ${labelPlural} à ${city.name} (${city.region}).`,
        url: canonical,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "fr",
        offers: { "@type": "Offer", price: "0", priceCurrency: "CAD", availability: "https://schema.org/InStock" },
      },
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: `Soumissions ${label} à ${city.name}`,
        description: `Logiciel de soumission par IA pour les ${labelPlural} à ${city.name}`,
        serviceType: `Soumission ${label}`,
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
          { "@type": "ListItem", position: 1, name: "Accueil", item: `${BASE_URL}/fr/` },
          { "@type": "ListItem", position: 2, name: label, item: sectorPageUrl },
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
        { "@type": "ListItem", position: 2, name: sector.label, item: sectorPageUrl },
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

// ─── French sector-page content (generic templates, not hand-authored per
// sector — mirrors the pattern already used for city pages above). Covers
// h1/intro/benefits/howItWorks/faq; titleTag/metaDescription/useCases are
// hand-authored per sector on SectorData.fr (see seo-data.ts). ────────────

export interface SectorFrContent {
  h1: string;
  h1Highlight: string;
  intro: string;
  h2Benefits: string;
  benefits: { title: string; desc: string }[];
  h2HowItWorks: string;
  howItWorks: { step: string; desc: string }[];
  h2UseCases: string;
  h2Faq: string;
  faq: { q: string; a: string }[];
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function getSectorFrContent(sector: SectorData): SectorFrContent {
  const { label, labelPlural } = sector.fr;
  const labelL = label.toLowerCase();

  return {
    h1: "Soumissions pour",
    h1Highlight: capitalize(labelPlural),
    intro: `Vous perdez encore des soirées sur des tableurs ou des soumissions écrites à la main? Avec quoteai, décrivez le travail dans vos propres mots — et l'IA génère une soumission professionnelle avec descriptions techniques, quantités, prix unitaires et taxes calculées automatiquement. En 30 secondes, depuis votre téléphone.`,
    h2Benefits: `Pourquoi les ${labelPlural} choisissent quoteai`,
    h2HowItWorks: "Comment ça marche : 3 étapes",
    h2UseCases: `Travaux courants pour ${labelPlural}`,
    h2Faq: "Questions fréquentes",
    benefits: [
      {
        title: "Soumissionnez depuis le chantier",
        desc: `Ouvrez quoteai sur votre téléphone pendant que vous êtes encore chez le client. Décrivez le travail en langage naturel et obtenez un document prêt en une minute.`,
      },
      {
        title: "Calculs automatiques",
        desc: `L'IA estime les quantités, les matériaux et les heures de main-d'œuvre à partir de votre description. Fini les calculs manuels, fini les erreurs.`,
      },
      {
        title: "Un document professionnel",
        desc: `Chaque soumission inclut l'en-tête de votre entreprise, des postes détaillés avec unités et prix unitaires, des sous-totaux et les taxes. Ça inspire confiance au client.`,
      },
      {
        title: "Une archive numérique",
        desc: `Toutes vos soumissions envoyées, sauvegardées et consultables depuis n'importe quel appareil. Retrouvez le bon contrat pour le bon client en quelques secondes.`,
      },
    ],
    howItWorks: [
      { step: "1. Décrivez le travail", desc: `Écrivez-le simplement, comme vous le raconteriez : le type de ${labelL} à effectuer, les dimensions, les matériaux.` },
      { step: "2. L'IA structure la soumission", desc: "quoteai lit la description, identifie les postes, estime les quantités et calcule les totaux avec les taxes appliquées." },
      { step: "3. Téléchargez et envoyez", desc: "Ajoutez votre logo, ajustez au besoin, et téléchargez le PDF. Envoyez-le au client par texto ou courriel." },
    ],
    faq: [
      {
        q: "Combien coûte le logiciel de soumission pour ce métier?",
        a: `quoteai offre un forfait Starter avec un nombre de soumissions mensuel, en plus de l'option d'acheter des soumissions à l'unité sans aucun abonnement.`,
      },
      {
        q: "Puis-je l'utiliser sur mon téléphone directement au chantier?",
        a: "Oui. quoteai est entièrement adapté aux appareils mobiles et fonctionne sur tout téléphone ou tablette avec une connexion internet — rien à installer.",
      },
      {
        q: `La soumission inclut-elle des prix de marché pour les ${labelPlural}?`,
        a: "L'IA suggère des prix typiques du marché canadien, que vous pouvez ajuster librement. Vous pouvez aussi enregistrer votre propre liste de prix dans les paramètres.",
      },
    ],
  };
}

// ─── Phase 80: long-form copy that only the hand-built static bodies used to carry ───
// (scripts/prerender-seo.ts rendered the sector/city pages from its own HTML
// templates until Phase 80; these two blocks were the text that the React
// pages did not have, so they moved here and the React pages render them.)

export interface DeepDiveCopy {
  heading: string;
  paragraphs: Array<{ kind: "p"; text: string } | { kind: "h3"; text: string } | { kind: "benefits" }>;
}

/** The sector page's long-form section ("Everything a modern painter needs to quote fast"). */
export function getSectorDeepDive(sector: SectorData, lang: Lang = "en-CA"): DeepDiveCopy {
  if (lang === "fr-CA") {
    const labelL = sector.fr.label.toLowerCase();
    const labelPL = sector.fr.labelPlural;
    const useCasesText = sector.fr.useCases.slice(0, 6).map((u) => u.toLowerCase()).join(", ");
    return {
      heading: `Tout ce qu'un ${labelL} moderne doit avoir pour soumissionner vite`,
      paragraphs: [
        { kind: "p", text: `Pour un ${labelL} au Canada, préparer une soumission professionnelle est souvent un deuxième emploi : des heures loin du chantier, des prix repris de vieilles listes de fournisseurs, les mêmes calculs refaits dans un chiffrier rafistolé depuis des années. Le résultat est souvent un document approximatif et mal présenté qui perd le contrat au profit d'un concurrent avec une estimation plus claire. quoteai existe pour combler cet écart : décrivez les travaux en français courant, en quelques phrases, et en trente secondes vous avez une soumission complète prête à envoyer par texto, courriel ou WhatsApp.` },
        { kind: "p", text: `Le logiciel est construit autour de la façon dont les ${labelPL} travaillent vraiment. La plupart des soumissions commencent sur place ou au téléphone avec le client, rarement à un bureau. C'est pourquoi quoteai fonctionne entièrement depuis le navigateur d'un téléphone : rien à installer, rien à synchroniser, rien à configurer. Ouvrez la page, décrivez les travaux pendant la visite, et le PDF est prêt avant même que vous soyez de retour dans le camion. Soumissionner dans l'heure plutôt que deux jours plus tard fait souvent la différence entre gagner et perdre le contrat.` },
        { kind: "p", text: `Les travaux que nos utilisateurs soumissionnent chaque jour incluent ${useCasesText}. Pour chacun, l'IA de quoteai connaît déjà les postes typiques, les unités que les entrepreneurs utilisent vraiment — pieds carrés, pieds linéaires, heures de main-d'œuvre, forfaits — et des prix alignés sur le marché canadien. Vous pouvez toujours modifier les lignes, utiliser votre propre liste de prix et ajouter ou retirer des sections, mais vous ne partez jamais d'une page blanche.` },
        { kind: "h3", text: "Des avantages concrets pour ceux qui soumissionnent tous les jours" },
        { kind: "benefits" },
        { kind: "h3", text: "Conçu pour la façon dont les métiers canadiens facturent" },
        { kind: "p", text: `Contrairement aux outils génériques, quoteai est pensé pour les détails pratiques qu'un ${labelL} gère sur chaque contrat au Canada : TPS/TVH (et TVQ ou TVP selon la province) calculées correctement pour la province où les travaux ont lieu, séparation claire entre matériaux et main-d'œuvre, et des totaux qui correspondent à ce que les clients s'attendent à voir avant de signer. Vos informations d'entreprise — nom, numéro de licence ou d'enregistrement, logo et coordonnées — sont enregistrées une seule fois et appliquées à chaque soumission.` },
        { kind: "h3", text: "De la soumission au contrat signé" },
        { kind: "p", text: `Une bonne soumission n'est pas qu'un document de prix : c'est un outil de vente. Une mise en page soignée, des lignes claires, votre logo et vos coordonnées disent au client qu'il a affaire à un professionnel sérieux. Chaque soumission générée avec quoteai inclut un en-tête personnalisé, des sections par phase de travaux, une description pour chaque ligne, les prix unitaires et sous-totaux, les taxes affichées clairement, un total final, ainsi que les conditions de paiement et la date de validité. Le client reçoit un PDF net qui tient la comparaison avec les soumissions d'autres ${labelPL}.` },
        { kind: "p", text: `Commencer est gratuit : pas de carte de crédit, pas de configuration compliquée. Créez un compte en trente secondes, générez votre première soumission gratuitement, et décidez ensuite si un abonnement (pour ceux qui soumissionnent chaque jour) ou une soumission à l'unité vous convient mieux. Des entrepreneurs et petites entreprises partout au Canada utilisent déjà quoteai chaque semaine.` },
      ],
    };
  }
  const labelL = sector.label.toLowerCase();
  const labelPL = sector.labelPlural;
  const useCasesText = sector.useCases.slice(0, 6).map((u) => u.toLowerCase()).join(", ");
  return {
    heading: `Everything a modern ${labelL} needs to quote fast`,
    paragraphs: [
      { kind: "p", text: `For a ${labelL} in Canada, putting together a professional quote is often a second job: hours pulled away from the job site, prices looked up from old supplier lists, the same calculations redone on a spreadsheet that's been patched together for years. The result is usually a rough, inconsistently formatted document that loses jobs to a competitor with a clearer, better-presented estimate. quoteai exists to close that gap: describe the job in plain English (or French), in a few sentences, and in thirty seconds you have a complete, professional quote ready to send by text, email or WhatsApp.` },
      { kind: "p", text: `The software is built around how ${labelPL} actually work day to day. Most quotes start on site or on the phone with the customer, rarely at a desk. That's why quoteai works entirely from a phone browser: no install, no syncing, nothing to configure. Open the page, describe the job while you're still walking the site, and by the time you're back in the truck the PDF is ready to send. The difference between quoting within the hour and quoting two days later is often the difference between winning the job and losing it to whoever answered first.` },
      { kind: "p", text: `Common jobs our users quote every day include ${useCasesText}. For each of these, quoteai's AI already knows the typical line items, the units contractors actually use — square feet, linear feet, labour hours, per-job flat rates — and prices that are in line with the Canadian market. You can always edit line items, swap in your own price list, and add or remove sections, but you never start from a blank page: you start from a quote that's already structured, saving most of the time a quote normally takes.` },
      { kind: "h3", text: "Real advantages for people who quote every day" },
      { kind: "benefits" },
      { kind: "h3", text: "Built for how Canadian trades actually invoice" },
      { kind: "p", text: `Unlike generic international tools, quoteai is designed around the practical details a ${labelL} deals with on every job in Canada: GST/HST (and PST or QST where it applies) calculated correctly for the province the work is done in, clear separation between materials and labour, and totals that match what customers expect to see on an estimate before signing off. Your business details — company name, licence or registration number, logo and contact info — are saved once and applied to every quote automatically, so every document looks consistent whether the customer is a homeowner, a property manager or a small business.` },
      { kind: "h3", text: "From quote to signed job" },
      { kind: "p", text: `A well-made quote isn't just a pricing document — it's a sales tool. Clean formatting, clear line items, your logo and contact information tell the customer they're dealing with a serious professional. Every quote generated with quoteai includes a custom header, sections by phase of work, a technical description for each line item, unit prices and subtotals, tax shown clearly, a final total, and payment terms and validity dates. The customer gets a tidy PDF — one page where possible — that holds up next to quotes from other ${labelPL} they're comparing, and in most cases the job goes to whoever presented the more professional estimate, even at a similar price.` },
      { kind: "p", text: `Getting started is free: no credit card, no complicated setup. Create an account in thirty seconds, generate your first quote for free, and only decide afterward whether a subscription plan (for anyone quoting daily) or a one-off quote makes more sense. Contractors, tradespeople and small businesses across Canada already use quoteai every week. Try it and see why nobody goes back to the old spreadsheet.` },
    ],
  };
}

export interface CityCostCopy {
  heading: string;
  subtitle: string;
  paragraphs: string[];
  footnote: string;
}

/**
 * The city page's "What does a painter cost in Toronto" section. It reads
 * the same hand-authored price index / demand level as the observatory card.
 * The static body this replaces also listed four per-job price ranges that
 * were derived from a string hash, not from data — those are gone.
 */
export function getCityCostCopy(sector: SectorData, city: CityData, lang: Lang = "en-CA"): CityCostCopy {
  // Phase 81: French pages show the city's and province's French names.
  city = localizeCity(city, lang);
  const intel = CITY_INTELLIGENCE[city.slug];
  const pricePct = intel ? Math.round((intel.priceIndex - 1.0) * 100) : 0;
  const cityName = city.name;
  const regionName = city.region;
  if (lang === "fr-CA") {
    const sectorLabel = sector.fr.label.toLowerCase();
    const priceNote = !intel
      ? "conforme à la moyenne nationale"
      : pricePct > 5
        ? `en moyenne ${pricePct} % plus élevé que la moyenne nationale`
        : pricePct < -5
          ? `en moyenne ${Math.abs(pricePct)} % plus bas que la moyenne nationale`
          : "conforme à la moyenne nationale (variation limitée à ±5 %)";
    const demandText = intel ? DEMAND_TEXT_FR[intel.demandLevel].toLowerCase() : "stable";
    return {
      heading: `Combien coûte un ${sectorLabel} à ${cityName}`,
      subtitle: "Ce qui fait varier le prix d'une soumission",
      paragraphs: [
        `À ${cityName}, le coût moyen pour des travaux de ${sectorLabel} est ${priceNote}. La demande au ${regionName} est actuellement ${demandText}, ce qui influence la rapidité de réponse des entrepreneurs et la marge de négociation sur le prix final.`,
        `Chaque soumission dépend de facteurs propres au travail : l'ampleur exacte des travaux, la qualité des matériaux demandés, l'accessibilité du site, l'urgence et les conditions particulières convenues avec le client. C'est pourquoi nous recommandons toujours une visite ou une description détaillée : avec quoteai, vous pouvez le faire en 30 secondes en décrivant le travail en langage naturel, et obtenir un document professionnel et modifiable, prêt à envoyer au client par WhatsApp ou courriel.`,
      ],
      footnote: `Indice de prix et niveau de demande : estimations rédigées pour ${cityName}. Taxes non incluses. Les prix réels varient selon les particularités du travail.`,
    };
  }
  const sectorLabel = sector.label.toLowerCase();
  const priceNote = !intel
    ? "in line with the national average"
    : pricePct > 5
      ? `on average ${pricePct}% higher than the national average`
      : pricePct < -5
        ? `on average ${Math.abs(pricePct)}% lower than the national average`
        : "in line with the national average (a modest variation within ±5%)";
  const demandText = intel ? DEMAND_TEXT[intel.demandLevel] : "steady";
  return {
    heading: `What does a ${sectorLabel} cost in ${cityName}`,
    subtitle: "What moves the price of a quote",
    paragraphs: [
      `In ${cityName}, the average cost for ${sectorLabel} work is ${priceNote}. Demand in ${regionName} is currently ${demandText}, which affects how quickly contractors respond and how much room there is to negotiate the final price.`,
      `Every quote depends on job-specific factors: the exact scope of work, the quality of materials requested, site accessibility, how urgent the job is, and any custom terms agreed with the client. That's why we always recommend a proper walkthrough or a detailed description: with quoteai you can do that in 30 seconds by describing the job in plain language, and get a professional, editable document ready to send to the client by WhatsApp or email.`,
    ],
    footnote: `Price index and demand level are editorial estimates for ${cityName}. Taxes not included. Real prices vary with the specifics of the job.`,
  };
}
