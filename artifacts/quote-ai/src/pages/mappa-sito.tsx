import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Link } from "wouter";
import { SECTORS, ACTIVE_CITIES, CITY_SECTORS } from "@/data/seo-data";
import { BLOG_INDEX, BLOG_CATEGORIES } from "@/data/blog-index";
import { HELP_ARTICLES } from "@/data/help-articles";
import { MapPin, Globe, BookOpen, Layers } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export default function MappaSitoPage() {
  const { t, lang } = useLanguage();
  // Group cities by region for structured visual hierarchy.
  // Scoped to ACTIVE_CITIES to match what's actually prerendered/sitemapped —
  // must stay in sync with scripts/prerender-seo.ts's mappa-sito builder.
  const citiesByRegion = new Map<string, typeof ACTIVE_CITIES>();
  for (const city of ACTIVE_CITIES) {
    const list = citiesByRegion.get(city.region) || [];
    list.push(city);
    citiesByRegion.set(city.region, list);
  }

  const sortedRegions = Array.from(citiesByRegion.keys()).sort();

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Sitemap | QuoteAI",
      description: "Full sitemap for QuoteAI. Find all static pages, blog articles, and guides for tradespeople and professionals across Canadian cities.",
      url: "https://quoteai.ca/mappa-sito/",
    }
  ];

  return (
    <PublicLayout>
      <SeoHead
        title={t("sitemap.seoTitle")}
        description={t("sitemap.seoDescription")}
        canonical="https://quoteai.ca/mappa-sito/"
        jsonLd={jsonLd}
      />

      {/* Header */}
      <header className="wrap" style={{ maxWidth: 700, padding: "clamp(48px, 7vw, 80px) 0 clamp(20px, 3vw, 32px)", textAlign: "center" }}>
        <h1 className="h2" style={{ marginBottom: 14 }}>{t("sitemap.heading")}</h1>
        <p className="lead" style={{ margin: "0 auto" }}>{t("sitemap.subheading")}</p>
      </header>

      {/* Main Directory */}
      <section className="sec soft">
        <div className="wrap" style={{ maxWidth: 1080 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>

            {/* Section 1: Main Pages */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--soft)" }}>
                <Globe className="h-5 w-5" style={{ color: "var(--navy)" }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>{t("sitemap.mainPagesTitle")}</h2>
              </div>
              <ul style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5 }}>
                <li>
                  <Link href="/" className="cta-link" style={{ fontSize: "inherit", fontWeight: 500 }}>
                    {t("sitemap.homePage")}
                  </Link>
                </li>
                <li>
                  <Link href="/whatsapp/" className="cta-link" style={{ fontSize: "inherit", fontWeight: 500 }}>
                    {t("sitemap.whatsappQuotes")}
                  </Link>
                </li>
                <li>
                  <Link href="/chi-siamo/" className="cta-link" style={{ fontSize: "inherit", fontWeight: 500 }}>
                    {t("sitemap.aboutUs")}
                  </Link>
                </li>
                <li>
                  <Link href="/contatti/" className="cta-link" style={{ fontSize: "inherit", fontWeight: 500 }}>
                    {t("sitemap.contactSupport")}
                  </Link>
                </li>
                <li>
                  <Link href="/privacy/" className="cta-link" style={{ fontSize: "inherit", fontWeight: 500 }}>
                    {t("sitemap.privacyPolicy")}
                  </Link>
                </li>
                <li>
                  <Link href="/termini/" className="cta-link" style={{ fontSize: "inherit", fontWeight: 500 }}>
                    {t("sitemap.termsOfService")}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Section 2: Blog & Guides */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--soft)" }}>
                <BookOpen className="h-5 w-5" style={{ color: "var(--navy)" }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>{t("sitemap.blogGuidesTitle")}</h2>
              </div>
              <ul style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5 }}>
                <li>
                  <Link href="/blog/" className="cta-link" style={{ fontSize: "inherit" }}>
                    {t("sitemap.blogIndex")}
                  </Link>
                </li>
                {BLOG_CATEGORIES.map((cat) => (
                  <li key={cat.slug} style={{ paddingLeft: 8 }}>
                    <Link href={`/blog/categoria/${cat.slug}/`} style={{ color: "var(--muted-mk)" }}>
                      {t("sitemap.category")}: {cat.name}
                    </Link>
                  </li>
                ))}
                <li style={{ paddingTop: 10, marginTop: 6, borderTop: "1px solid var(--soft)" }}>
                  <Link href="/help/" className="cta-link" style={{ fontSize: "inherit" }}>
                    {t("sitemap.helpCenter")}
                  </Link>
                </li>
                {HELP_ARTICLES.map((a) => (
                  <li key={a.slug} style={{ paddingLeft: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Link href={`/help/${a.slug}/`} style={{ color: "var(--muted-mk)", fontSize: 12.5 }}>
                      {a.title[lang]}
                    </Link>
                  </li>
                ))}
                <li style={{ paddingTop: 10, marginTop: 6, borderTop: "1px solid var(--soft)", fontWeight: 700, color: "var(--navy)" }}>{t("sitemap.latestArticles")}</li>
                {BLOG_INDEX.slice(0, 5).map((art) => (
                  <li key={art.slug} style={{ paddingLeft: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Link href={`/blog/${art.slug}/`} style={{ color: "var(--faint)", fontSize: 12.5 }}>
                      {art.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 3: Professions Index */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--soft)" }}>
                <Layers className="h-5 w-5" style={{ color: "var(--navy)" }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>{t("sitemap.professionsTitle")}</h2>
              </div>
              <ul style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5 }}>
                {Object.entries(SECTORS).map(([slug, sector]) => (
                  <li key={slug}>
                    <Link href={`/quotes/${slug}/`} className="cta-link" style={{ fontSize: "inherit", fontWeight: 500 }}>
                      {sector.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Programmatic Cities Directory */}
          <div className="card" style={{ marginTop: 24, padding: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, paddingBottom: 18, borderBottom: "1px solid var(--soft)" }}>
              <span className="fi g"><MapPin className="h-5 w-5" /></span>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--navy)" }}>{t("sitemap.localQuotesTitle")}</h2>
                <p style={{ fontSize: 13, color: "var(--faint)", marginTop: 2 }}>{t("sitemap.localQuotesSubtitle")}</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {sortedRegions.map((region) => {
                const regionCities = citiesByRegion.get(region) || [];
                return (
                  <div key={region} style={{ borderBottom: "1px solid var(--soft)", paddingBottom: 28 }}>
                    <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--navy)", marginBottom: 16 }}>{region}</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", rowGap: 16, columnGap: 8, fontSize: 12.5 }}>
                      {regionCities.map((city) => (
                        <div key={city.slug} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontWeight: 700, color: "var(--navy)", borderBottom: "1px solid var(--soft)", paddingBottom: 2, marginBottom: 2 }}>{city.name}</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 2 }}>
                            {CITY_SECTORS.map((sectorSlug) => {
                              const s = SECTORS[sectorSlug];
                              if (!s) return null;
                              return (
                                <Link
                                  key={sectorSlug}
                                  href={`/quotes/${sectorSlug}/${city.slug}/`}
                                  style={{ color: "var(--muted-mk)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                  title={`${t("sitemap.quoteFor")} ${s.label} — ${city.name}`}
                                >
                                  {s.label}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </section>
    </PublicLayout>
  );
}
