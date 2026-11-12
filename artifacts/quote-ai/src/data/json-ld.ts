// Phase 80: the structured data that used to be authored a second time in
// scripts/prerender-seo.ts. Every public page now owns its head through
// <SeoHead> — the build-time render (entry-server.tsx) serialises exactly what
// the hydrated page renders, so crawler and browser always agree.
import { TESTIMONIALS, AGGREGATE_RATING } from "@/components/testimonials-section";
import { PUBLISHED_PLANS, ONE_SHOT_OPTIONS } from "@/data/pricing";
import { lookup } from "@/i18n/registry";

export const BASE_URL = "https://quoteai.ca";

export type JsonLdSchema = { "@context": string; "@type": string; [key: string]: unknown };

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${BASE_URL}${it.path}`,
    })),
  };
}

export function webPageJsonLd(name: string, description: string, path: string, type = "WebPage", lang: "en" | "fr" = "en"): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": type,
    name,
    description,
    url: `${BASE_URL}${path}`,
    inLanguage: lang,
    isPartOf: { "@type": "WebSite", name: "quoteai", url: `${BASE_URL}/` },
  };
}

/** FAQPage for a page that answers a list of questions (Phase 81: /pricing). */
export function faqJsonLd(items: Array<{ q: string; a: string }>): JsonLdSchema {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

/**
 * Phase 81 — the pricing page's Product/Offer block. `lowPrice` is the
 * cheapest way to get one quote out of the product ($5 pay-per-quote), not a
 * subscription tier, so the range is honest about what a contractor can
 * actually spend.
 */
export function pricingJsonLd(lang: "en" | "fr"): JsonLdSchema {
  // Phase 99: only plans with a published price are offers (Elite is custom).
  const monthly = PUBLISHED_PLANS.map((p) => p.monthly);
  const oneShot = ONE_SHOT_OPTIONS.map((o) => o.price);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "quoteai",
    description:
      lang === "fr"
        ? "Logiciel de soumission par IA pour les entrepreneurs canadiens — forfaits mensuels ou annuels, ou paiement à la soumission."
        : "AI quoting software for Canadian contractors — monthly or annual plans, or pay per quote.",
    url: lang === "fr" ? `${BASE_URL}/fr/tarifs/` : `${BASE_URL}/pricing/`,
    brand: { "@type": "Brand", name: "quoteai" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "CAD",
      lowPrice: String(Math.min(...oneShot)),
      highPrice: String(Math.max(...monthly)),
      offerCount: String(PUBLISHED_PLANS.length + ONE_SHOT_OPTIONS.length),
      availability: "https://schema.org/InStock",
    },
  };
}

/** WebSite + SoftwareApplication for "/" and "/fr" (with the homepage reviews). */
export function homepageJsonLd(lang: "en" | "fr"): JsonLdSchema[] {
  const fr = lang === "fr";
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "quoteai",
    url: BASE_URL,
    description: fr
      ? "Logiciel IA pour soumissions professionnelles en 30 secondes. Conçu pour les entrepreneurs, petites entreprises et travailleurs autonomes canadiens."
      : "AI-powered software for professional quotes in 30 seconds. Built for Canadian contractors, small businesses, and freelancers.",
    inLanguage: fr ? "fr-CA" : "en-CA",
    publisher: { "@id": `${BASE_URL}/#org` },
    // No SearchAction: the site has no search endpoint, and a template that
    // points at /quotes/{term} promises Google a results page that 404s.
  };
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE_URL}/#org`,
    name: "quoteai",
    alternateName: ["QuoteAI", "quoteAI", "quoteai.ca"],
    url: `${BASE_URL}/`,
    logo: `${BASE_URL}/icon-512.png`,
    email: "info@quoteai.ca",
    areaServed: { "@type": "Country", name: "Canada" },
    knowsLanguage: ["en-CA", "fr-CA"],
  };
  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "quoteai",
    description: fr
      ? "Logiciel de soumission par IA pour les entrepreneurs, petites entreprises et artisans canadiens."
      : "AI-powered quoting software for Canadian contractors, small businesses, and tradespeople.",
    url: fr ? `${BASE_URL}/fr/` : `${BASE_URL}/`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "CAD", description: fr ? "Essai gratuit disponible" : "Free trial available" },
    audience: {
      "@type": "BusinessAudience",
      audienceType: fr ? "Entrepreneurs, petites entreprises, artisans, travailleurs autonomes" : "Contractors, Small Businesses, Tradespeople, Freelancers",
    },
    inLanguage: lang,
    provider: { "@type": "Organization", "@id": `${BASE_URL}/#org`, name: "quoteai", url: BASE_URL },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: AGGREGATE_RATING.ratingValue,
      reviewCount: String(AGGREGATE_RATING.reviewCount),
      bestRating: "5",
      worstRating: "1",
    },
    review: TESTIMONIALS.map((t) => ({
      "@type": "Review",
      // The reviewers are contracting businesses, not people.
      author: { "@type": "Organization", name: t.name },
      reviewRating: { "@type": "Rating", ratingValue: String(t.rating), bestRating: "5", worstRating: "1" },
      // Phase 115: the page's language is loaded before it renders (registry.ts); lookup falls back to English.
      reviewBody: lookup(lang, `testimonials.${t.key}.text`),
    })),
  };
  return [organization, website, software];
}
