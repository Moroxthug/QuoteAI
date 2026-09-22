// Phase 80: the structured data that used to be authored a second time in
// scripts/prerender-seo.ts. Every public page now owns its head through
// <SeoHead> — the build-time render (entry-server.tsx) serialises exactly what
// the hydrated page renders, so crawler and browser always agree.
import { TESTIMONIALS, AGGREGATE_RATING } from "@/components/testimonials-section";
import { MARKETING_PLANS, ONE_SHOT_OPTIONS } from "@/data/pricing";
import { translations } from "@/i18n/translations";

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
  const monthly = MARKETING_PLANS.map((p) => p.monthly);
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
      offerCount: String(MARKETING_PLANS.length + ONE_SHOT_OPTIONS.length),
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
    inLanguage: lang,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: fr ? `${BASE_URL}/fr/soumissions/{search_term_string}` : `${BASE_URL}/quotes/{search_term_string}` },
      "query-input": "required name=search_term_string",
    },
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
      reviewBody: translations[lang][`testimonials.${t.key}.text`] ?? translations.en[`testimonials.${t.key}.text`] ?? "",
    })),
  };
  return [website, software];
}
