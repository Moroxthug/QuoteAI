// Phase 70: help centre index — the ten flows, grouped by category. Public,
// prerendered (entry-server SSR_PAGES) and hydrated like the other static
// pages; the support bot points visitors here.
import { Link } from "wouter";
import { ArrowRight, Rocket, FileText, FileSignature, HardHat, Receipt, Users, Target } from "lucide-react";
import { HELP_ARTICLES, HELP_CATEGORIES, type HelpCategory } from "@/data/help-articles";
import { SeoHead } from "@/components/seo-head";
import { useLanguage } from "@/i18n/LanguageContext";

const BASE_URL = "https://quoteai.ca";

const CATEGORY_ICONS: Record<HelpCategory, typeof Rocket> = {
  start: Rocket,
  quotes: FileText,
  contracts: FileSignature,
  jobs: HardHat,
  money: Receipt,
  team: Users,
  growth: Target,
};

const CATEGORY_ORDER: HelpCategory[] = ["start", "quotes", "contracts", "jobs", "money", "team", "growth"];

export default function HelpIndexPage() {
  const { t, lang } = useLanguage();
  const canonical = `${BASE_URL}/help/`;

  const jsonLd = [
    {
      "@context": "https://schema.org" as const,
      "@type": "CollectionPage" as const,
      name: t("help.seoTitle"),
      description: t("help.seoDescription"),
      url: canonical,
      inLanguage: lang,
      hasPart: HELP_ARTICLES.map((a) => ({ "@type": "TechArticle" as const, headline: a.title[lang], url: `${BASE_URL}/help/${a.slug}/` })),
    },
    {
      "@context": "https://schema.org" as const,
      "@type": "BreadcrumbList" as const,
      itemListElement: [
        { "@type": "ListItem" as const, position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem" as const, position: 2, name: t("help.breadcrumb"), item: canonical },
      ],
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead title={t("help.seoTitle")} description={t("help.seoDescription")} canonical={canonical} jsonLd={jsonLd} />

      <div className="wrap">
        <nav aria-label={t("seo.city.breadcrumbAria")} className="crumbs">
          <Link href="/">{t("blog.breadcrumbHome")}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">{t("help.breadcrumb")}</span>
        </nav>
      </div>

      <header className="wrap" style={{ maxWidth: 780, padding: "clamp(12px, 2vw, 24px) 0 clamp(28px, 3.5vw, 44px)" }}>
        <p className="eyebrow grey" style={{ marginBottom: 14 }}>{t("help.eyebrow")}</p>
        <h1 style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)", fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)", lineHeight: 1.15, marginBottom: 14 }}>
          {t("help.heading")}
        </h1>
        <p className="lead" style={{ maxWidth: "none" }}>{t("help.subheading")}</p>
      </header>

      <main className="flex-1 wrap" style={{ paddingBottom: "clamp(48px, 6vw, 80px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(28px, 3.5vw, 44px)" }}>
          {CATEGORY_ORDER.map((cat) => {
            const articles = HELP_ARTICLES.filter((a) => a.category === cat);
            if (articles.length === 0) return null;
            const Icon = CATEGORY_ICONS[cat];
            return (
              <section key={cat} aria-labelledby={`help-cat-${cat}`}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <span className="guide-icon" style={{ marginBottom: 0, width: 38, height: 38 }}><Icon className="h-4.5 w-4.5" /></span>
                  <h2 id={`help-cat-${cat}`} style={{ fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>{HELP_CATEGORIES[cat][lang]}</h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {articles.map((a) => (
                    <Link key={a.slug} href={`/help/${a.slug}/`} className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", lineHeight: 1.35 }}>{a.title[lang]}</h3>
                      <p style={{ fontSize: 13, color: "var(--muted-mk)", lineHeight: 1.55, flex: 1 }}>{a.summary[lang]}</p>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "var(--faint)" }}>
                        <span>{a.readingTimeMin} {t("blog.readingTimeSuffix")}</span>
                        <span className="cta-link" style={{ fontSize: 13.5 }}>{t("help.readArticle")} <ArrowRight className="chev h-4 w-4" /></span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <section className="card" style={{ marginTop: "clamp(36px, 4vw, 56px)", padding: "clamp(22px, 3vw, 32px)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)", marginBottom: 6 }}>{t("help.stillStuckTitle")}</h2>
            <p style={{ fontSize: 13.5, color: "var(--muted-mk)" }}>{t("help.stillStuckBody")}</p>
          </div>
          <Link href="/contatti/" className="btn btn-navy btn-sm">{t("help.contactUs")}</Link>
        </section>
      </main>
    </div>
  );
}
