// Feature pages (docs/SEO-RECOVERY-PLAN.md S4 item 1): /estimating-software/,
// /invoicing-software/, /contractor-crm/, /job-costing-software/,
// /contracts-e-signature/ and their French twins. The copy is hand-written per
// language (data/feature-pages.ts); the screenshot is the real signed-in
// screen with sample data (scripts/capture-feature-shots.ts).
import { Link } from "wouter";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { FEATURE_PAGES } from "@/data/feature-pages";
import { FEATURE_SLUG_PAIRS, featurePath, type FeatureId } from "@/data/seo-slugs";

const UI = {
  en: {
    home: "Home", crumb: "Features", start: "Start free", pricing: "See pricing", updated: "Updated",
    shotCaption: "The real screen in quoteai, shown with sample data.", faq: "Frequently asked questions", more: "More of what quoteai does",
    ctaTitle: "Try it on your next job", ctaBody: "Your first quotes are free. No card needed to start.",
  },
  fr: {
    home: "Accueil", crumb: "Fonctionnalités", start: "Commencer gratuitement", pricing: "Voir les tarifs", updated: "Mis à jour le",
    shotCaption: "L'écran réel de quoteai, présenté avec des données fictives.", faq: "Questions fréquentes", more: "Les autres fonctions de quoteai",
    ctaTitle: "Essayez-le sur votre prochain chantier", ctaBody: "Vos premières soumissions sont gratuites. Aucune carte requise pour commencer.",
  },
} as const;

export default function FeaturePage({ id, lang }: { id: FeatureId; lang: "en" | "fr" }) {
  const page = FEATURE_PAGES[id][lang];
  const ui = UI[lang];
  const other = lang === "fr" ? "en" : "fr";
  const canonical = `https://quoteai.ca${featurePath(lang, id)}`;
  const altCanonical = `https://quoteai.ca${featurePath(other, id)}`;
  const shot = `/screens/${id}-${lang}.jpg`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList" as const,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: ui.home, item: lang === "fr" ? "https://quoteai.ca/fr/" : "https://quoteai.ca/" },
        { "@type": "ListItem", position: 2, name: page.h1Highlight, item: canonical },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage" as const,
      mainEntity: page.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={page.titleTag}
        description={page.metaDescription}
        canonical={canonical}
        altCanonical={altCanonical}
        lang={lang === "fr" ? "fr-CA" : "en-CA"}
        ogImage={`https://quoteai.ca${shot}`}
        jsonLd={jsonLd}
      />

      <div className="wrap">
        <nav aria-label="Breadcrumb" className="crumbs">
          <Link href={lang === "fr" ? "/fr/" : "/"}>{ui.home}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">{page.h1Highlight}</span>
        </nav>
      </div>

      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ paddingTop: "clamp(36px, 5vw, 64px)", paddingBottom: "clamp(40px, 6vw, 72px)", maxWidth: 920 }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 20 }}>{ui.crumb}</p>
          <h1>
            {page.h1} <em style={{ fontStyle: "normal", color: "#8ef07f" }}>{page.h1Highlight}</em>
          </h1>
          <p className="lead">{page.intro}</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "grid", gap: 8 }}>
            {page.bullets.map((b) => (
              <li key={b} style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,.88)", fontSize: 15 }}>
                <CheckCircle2 className="h-4 w-4" style={{ color: "#8ef07f", flexShrink: 0 }} aria-hidden="true" />
                {b}
              </li>
            ))}
          </ul>
          <div className="hero-cta">
            <Link href="/sign-up/" className="btn btn-white">
              {ui.start}
              <ArrowRight className="chev h-4 w-4" />
            </Link>
            <Link href={lang === "fr" ? "/fr/tarifs/" : "/pricing/"} className="btn btn-outline-light">{ui.pricing}</Link>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 40, paddingBottom: 8 }}>
        <div className="wrap" style={{ maxWidth: 1100 }}>
          <figure style={{ margin: 0 }}>
            <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--line, #e5e7eb)", boxShadow: "0 18px 48px rgba(15, 23, 42, .12)" }}>
              <img src={shot} alt={page.shotAlt} width={1440} height={900} loading="eager" decoding="async" style={{ display: "block", width: "100%", height: "auto" }} />
            </div>
            <figcaption style={{ fontSize: 13, color: "var(--faint)", marginTop: 10, textAlign: "center" }}>{ui.shotCaption}</figcaption>
          </figure>
        </div>
      </section>

      <section className="sec" id="guide">
        <div className="wrap" style={{ maxWidth: 780 }}>
          <div className="prose blog-prose max-w-none" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
          <p style={{ fontSize: 13, color: "var(--faint)", marginTop: 24 }}>
            {ui.updated} <time dateTime={page.updatedAt}>{new Date(page.updatedAt).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</time>
          </p>
        </div>
      </section>

      <section className="sec soft">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
            <h2 className="h2">{ui.faq}</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {page.faq.map((f) => (
              <div key={f.q} className="card" style={{ padding: 22 }}>
                <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>{f.q}</h3>
                <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.6 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap" style={{ maxWidth: 980 }}>
          <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
            <h2 className="h2" style={{ fontSize: 26 }}>{ui.more}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURE_SLUG_PAIRS.filter((f) => f.id !== id).map((f) => (
              <Link key={f.id} href={featurePath(lang, f.id)} className="card" style={{ padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span>
                  <b style={{ display: "block", color: "var(--navy)", fontSize: 15 }}>{FEATURE_PAGES[f.id][lang].h1} {FEATURE_PAGES[f.id][lang].h1Highlight}</b>
                  <span style={{ fontSize: 13.5, color: "var(--muted-mk)" }}>{FEATURE_PAGES[f.id][lang].bullets[0]}</span>
                </span>
                <ArrowRight className="h-4 w-4" style={{ color: "var(--navy)", flexShrink: 0 }} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="cta on-dark">
        <div className="wrap cta-in">
          <h2>{ui.ctaTitle}</h2>
          <p>{ui.ctaBody}</p>
          <div className="cta-actions">
            <Link href="/sign-up/" className="btn btn-white">
              {ui.start}
              <ArrowRight className="chev h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
