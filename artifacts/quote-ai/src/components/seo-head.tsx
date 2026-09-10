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
  /**
   * Locale of THIS page's content, e.g. "en-CA" (default) or "fr-CA".
   * NOTE: there is currently no locale-prefixed routing (no /fr/ path segment) —
   * every URL only ever serves English content today. This prop and the
   * hreflang/og:locale output below exist so the follow-up i18n pass can wire
   * up real fr-CA routes (e.g. /fr/preventivi/...) without having to touch
   * every call site again: once French routes exist, pass canonical +
   * frCanonical here and the alternate tags will be correct immediately.
   */
  lang?: "en-CA" | "fr-CA";
  /** Canonical URL of the fr-CA version of this page, once it exists. */
  frCanonical?: string;
}

const OG_LOCALE: Record<"en-CA" | "fr-CA", string> = {
  "en-CA": "en_CA",
  "fr-CA": "fr_CA",
};

export function SeoHead({
  title,
  description,
  canonical,
  ogImage = "https://quoteai.ca/opengraph.jpg",
  noIndex = false,
  ogTitle,
  ogDescription,
  ogUrl,
  ogType = "website",
  twitterCard = "summary_large_image",
  jsonLd = [],
  lang = "en-CA",
  frCanonical,
}: SeoHeadProps) {
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

      {/* hreflang alternates — see `lang`/`frCanonical` doc above for the
          current single-locale limitation. Until fr-CA routes exist, both
          tags point at the same (English) canonical so we advertise the
          country/language pairing without claiming a French page we don't
          serve yet. */}
      {canonical && <link rel="alternate" hrefLang="en-CA" href={canonical} />}
      {canonical && <link rel="alternate" hrefLang="fr-CA" href={frCanonical ?? canonical} />}
      {canonical && <link rel="alternate" hrefLang="x-default" href={canonical} />}

      <meta property="og:title" content={resolvedOgTitle} />
      <meta property="og:description" content={resolvedOgDescription} />
      <meta property="og:url" content={resolvedOgUrl} />
      <meta property="og:image" content={resolvedOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:type" content={ogType} />
      <meta property="og:locale" content={OG_LOCALE[lang]} />
      <meta property="og:locale:alternate" content={lang === "fr-CA" ? "en_CA" : "fr_CA"} />
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
