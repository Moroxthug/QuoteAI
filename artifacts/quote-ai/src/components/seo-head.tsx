import { Helmet } from "react-helmet-async";

interface JsonLdSchema {
  "@context": string;
  "@type": string;
  [key: string]: unknown;
}

interface SeoHeadProps {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogType?: string;
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  jsonLd?: JsonLdSchema[];
  noIndex?: boolean;
  /** Locale of THIS page's content, e.g. "en-CA" (default) or "fr-CA". */
  lang?: "en-CA" | "fr-CA";
  /**
   * Canonical URL of the other language's version of this page, when one
   * exists: the fr-CA page for an English page, the en-CA page for a French
   * one (Phase 80 — a French page used to advertise itself as its own en-CA
   * alternate, and every English page claimed a French twin whether or not
   * one was built). Omit it and only this page's own locale is declared.
   */
  altCanonical?: string;
}

const OG_LOCALE: Record<"en-CA" | "fr-CA", string> = {
  "en-CA": "en_CA",
  "fr-CA": "fr_CA",
};

export function SeoHead({
  title,
  description,
  canonical,
  ogImage = "https://quoteai.ca/opengraph.jpg?v=2", // ?v= busts the platforms' preview caches when the card changes
  noIndex = false,
  ogTitle,
  ogDescription,
  ogUrl,
  ogType = "website",
  twitterCard = "summary_large_image",
  jsonLd = [],
  lang = "en-CA",
  altCanonical,
}: SeoHeadProps) {
  // English is the site's default locale: x-default always points at the
  // English page (this one, or its English alternate).
  const enUrl = lang === "en-CA" ? canonical : altCanonical;
  const frUrl = lang === "fr-CA" ? canonical : altCanonical;
  const resolvedOgImage = ogImage.startsWith("http") ? ogImage : `https://quoteai.ca${ogImage}`;
  const resolvedOgTitle = ogTitle ?? title;
  const resolvedOgDescription = ogDescription ?? description;
  const resolvedOgUrl = ogUrl ?? canonical;

  return (
    <Helmet htmlAttributes={{ lang: lang === "fr-CA" ? "fr-CA" : "en-CA" }}>
      <title>{title}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {enUrl && <link rel="alternate" hrefLang="en-CA" href={enUrl} />}
      {frUrl && <link rel="alternate" hrefLang="fr-CA" href={frUrl} />}
      {canonical && <link rel="alternate" hrefLang="x-default" href={enUrl ?? canonical} />}

      <meta property="og:title" content={resolvedOgTitle} />
      <meta property="og:description" content={resolvedOgDescription} />
      <meta property="og:url" content={resolvedOgUrl} />
      <meta property="og:image" content={resolvedOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:type" content={ogType} />
      <meta property="og:locale" content={OG_LOCALE[lang]} />
      {altCanonical && <meta property="og:locale:alternate" content={lang === "fr-CA" ? "en_CA" : "fr_CA"} />}
      <meta property="og:site_name" content="quoteai" />

      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={resolvedOgTitle} />
      <meta name="twitter:description" content={resolvedOgDescription} />
      <meta name="twitter:image" content={resolvedOgImage} />

      {jsonLd.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
