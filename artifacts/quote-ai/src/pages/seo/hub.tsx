// Trade hub: /quotes/ and /fr/soumissions/ (docs/SEO-RECOVERY-PLAN.md S2).
// Both URLs used to fall through to the app shell (a soft 404); every trade
// page links up to them through its breadcrumb, so they are real pages now.
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { useLanguage } from "@/i18n/LanguageContext";
import { breadcrumbJsonLd, webPageJsonLd, BASE_URL } from "@/data/json-ld";
import { SECTORS, LIVE_SECTOR_SLUGS, frSectorLive } from "@/data/seo-data";

const COPY = {
  en: {
    path: "/quotes/",
    title: "Quoting Software by Trade | quoteai",
    description: "quoteai for each Canadian trade: painters, electricians, plumbers, roofers, HVAC and more. Itemized quotes with GST/HST or QST, sent as a PDF from your phone.",
    eyebrow: "Trades",
    h1: "Quotes for every trade",
    lead: "Pick your trade to see the line items, units and taxes quoteai uses when it writes your quotes, and the questions contractors in that trade ask most.",
    home: "Home",
  },
  fr: {
    path: "/fr/soumissions/",
    title: "Logiciel de soumission par métier | quoteai",
    description: "quoteai pour chaque métier au Canada : peintres, électriciens, plombiers, couvreurs, CVC et plus. Des soumissions avec TPS et TVQ, en PDF depuis votre téléphone.",
    eyebrow: "Métiers",
    h1: "Des soumissions pour chaque métier",
    lead: "Choisissez votre métier pour voir les postes, les unités et les taxes que quoteai utilise pour rédiger vos soumissions, et les questions que posent le plus souvent les entrepreneurs de ce métier.",
    home: "Accueil",
  },
} as const;

export default function SeoHubPage() {
  const { lang } = useLanguage();
  const c = COPY[lang];
  const other = COPY[lang === "fr" ? "en" : "fr"];
  const trades = LIVE_SECTOR_SLUGS.filter((slug) => (lang === "fr" ? frSectorLive(slug) : true)).map((slug) => {
    const s = SECTORS[slug];
    return {
      slug,
      href: lang === "fr" ? `/fr/soumissions/${s.frSlug}/` : `/quotes/${slug}/`,
      label: lang === "fr" ? s.fr.labelPlural : s.labelPlural,
      blurb: lang === "fr" ? s.fr.metaDescription : s.metaDescription,
    };
  });
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={c.title}
        description={c.description}
        canonical={`${BASE_URL}${c.path}`}
        altCanonical={`${BASE_URL}${other.path}`}
        lang={lang === "fr" ? "fr-CA" : "en-CA"}
        jsonLd={[
          webPageJsonLd(c.title, c.description, c.path, "CollectionPage", lang),
          breadcrumbJsonLd([
            { name: c.home, path: lang === "fr" ? "/fr/" : "/" },
            { name: c.eyebrow, path: c.path },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: trades.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.label, url: `${BASE_URL}${t.href}` })),
          },
        ]}
      />

      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ paddingBlock: "clamp(64px, 8vw, 110px)" }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 22 }}>{c.eyebrow}</p>
          <h1>{c.h1}</h1>
          <p className="lead">{c.lead}</p>
        </div>
      </section>

      <section className="sec soft" id="trades">
        <div className="wrap">
          <div className="dd-grid" style={{ marginTop: 0 }}>
            {trades.map((t) => (
              <Link key={t.slug} href={t.href} className="card dd-card">
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>
                  {t.label.replace(/^./, (ch) => ch.toUpperCase())}
                </h2>
                <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.55, flex: 1 }}>{t.blurb}</p>
                <span className="cta-link" style={{ marginTop: 12 }}>
                  {lang === "fr" ? "Voir le métier" : "See the trade"} <ArrowRight className="chev h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
