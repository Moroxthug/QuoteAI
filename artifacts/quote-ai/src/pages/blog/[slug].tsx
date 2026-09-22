import { useParams, Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { BLOG_ARTICLES } from "@/data/blog-data";
import { SECTORS, ACTIVE_CITIES, CITY_SECTORS } from "@/data/seo-data";
import { extractToc, injectHeadingIds } from "@/data/blog-toc";
import { SeoHead } from "@/components/seo-head";
import { BASE_URL } from "@/data/json-ld";
import { useLanguage } from "@/i18n/LanguageContext";

function formatDate(iso: string, lang: "en" | "fr"): string {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { day: "numeric", month: "long", year: "numeric" });
}

const CATEGORY_CHIPS: Record<string, string> = {
  Trades: "chip-grey",
  Pricing: "chip-teal",
  Advice: "chip-yellow",
  Tools: "chip-green",
  Innovation: "chip-purple",
  Business: "chip-red",
};

export default function BlogArticlePage() {
  const { t, lang } = useLanguage();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const article = BLOG_ARTICLES.find((a) => a.slug === slug);

  if (!article) {
    return (
      <div className="wrap" style={{ textAlign: "center", paddingBlock: "clamp(80px, 10vw, 140px)" }}>
        <h1 className="h2">{t("blog.articleNotFoundTitle")}</h1>
        <p className="lead" style={{ margin: "16px auto 32px" }}>{t("blog.articleNotFoundBody")}</p>
        <Link href="/blog/" className="btn btn-navy">
          {t("blog.backToBlog")}
        </Link>
      </div>
    );
  }

  const canonical = `${BASE_URL}/blog/${article.slug}/`;
  // Generated at build time by scripts/generate-blog-og-images.ts.
  const ogImage = `/og/blog/${article.slug}.png`;
  const toc = extractToc(article.contentHtml);
  const bodyHtml = injectHeadingIds(article.contentHtml);

  const relatedArticles = BLOG_ARTICLES.filter(
    (a) => a.slug !== article.slug &&
      (a.relatedSectors.some((s) => article.relatedSectors.includes(s)) ||
        a.category === article.category)
  ).slice(0, 3);

  const relatedSectorObjects = article.relatedSectors
    .map((s) => SECTORS[s])
    .filter(Boolean);

  const geoSectorSlug = article.relatedSectors.find((s) => CITY_SECTORS.includes(s));
  const geoSector = geoSectorSlug ? SECTORS[geoSectorSlug] : undefined;

  const jsonLd = [
    {
      "@context": "https://schema.org" as const,
      "@type": "Article" as const,
      headline: article.title,
      description: article.metaDescription,
      image: [`${BASE_URL}${ogImage}`],
      url: canonical,
      mainEntityOfPage: { "@type": "WebPage" as const, "@id": canonical },
      datePublished: article.publishedAt,
      dateModified: article.updatedAt ?? article.publishedAt,
      inLanguage: "en",
      author: { "@type": "Organization" as const, name: "quoteai", url: BASE_URL },
      publisher: {
        "@type": "Organization" as const,
        name: "quoteai",
        url: BASE_URL,
        logo: { "@type": "ImageObject" as const, url: `${BASE_URL}/icon-192.png`, width: 192, height: 192 },
      },
    },
    {
      "@context": "https://schema.org" as const,
      "@type": "BreadcrumbList" as const,
      itemListElement: [
        { "@type": "ListItem" as const, position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem" as const, position: 2, name: "Blog", item: `${BASE_URL}/blog` },
        { "@type": "ListItem" as const, position: 3, name: article.title, item: canonical },
      ],
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={`${article.seoTitle ?? article.title} | quoteai`}
        description={article.metaDescription}
        canonical={canonical}
        ogImage={ogImage}
        ogType="article"
        jsonLd={jsonLd}
      />

      <div className="wrap">
        <nav aria-label={t("seo.city.breadcrumbAria")} className="crumbs">
          <Link href="/">{t("blog.breadcrumbHome")}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <Link href="/blog/">{t("blog.breadcrumbBlog")}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} aria-current="page">{article.title}</span>
        </nav>
      </div>

      <article className="flex-1">
        <header className="wrap" style={{ maxWidth: 780, paddingTop: "clamp(12px, 2vw, 24px)", paddingBottom: "clamp(32px, 4vw, 48px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
            <span className={`chip ${CATEGORY_CHIPS[article.category] ?? "chip-grey"}`}>{article.category}</span>
            <span style={{ fontSize: 13, color: "var(--faint)" }}>{article.readingTimeMin} {t("blog.readingTimeSuffix")}</span>
            <time style={{ fontSize: 13, color: "var(--faint)" }} dateTime={article.publishedAt}>
              {formatDate(article.publishedAt, lang)}
            </time>
          </div>
          <h1 style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.7rem)", fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)", lineHeight: 1.15, marginBottom: 16 }}>
            {article.title}
          </h1>
          <p className="lead" style={{ maxWidth: "none" }}>
            {article.metaDescription}
          </p>
        </header>

        <div className="wrap" style={{ maxWidth: 780, paddingBottom: "clamp(40px, 5vw, 64px)" }}>
          {toc.length >= 2 && (
            <nav aria-label={t("blog.toc")} className="blog-toc">
              <p className="label">{t("blog.toc")}</p>
              <ol>
                {toc.map((item) => (
                  <li key={item.id} className={item.level === 3 ? "sub" : ""}>
                    <a href={`#${item.id}`}>{item.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div
            className="prose blog-prose max-w-none"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>

        {relatedSectorObjects.length > 0 && (
          <section className="sec soft" style={{ paddingBlock: "clamp(36px, 4vw, 56px)" }}>
            <div className="wrap" style={{ maxWidth: 780 }}>
              <h2 className="eyebrow grey" style={{ marginBottom: 18 }}>{t("blog.quotesBySector")}</h2>
              <div className="blog-links">
                {relatedSectorObjects.map((sector) => (
                  <Link key={sector.slug} href={`/quotes/${sector.slug}/`} className="blog-link-pill">
                    <ArrowRight className="h-3.5 w-3.5" />
                    {t("blog.quotesForPrefix")} {sector.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {geoSector && (
          <section className="sec" style={{ paddingBlock: "clamp(36px, 4vw, 56px)" }}>
            <div className="wrap" style={{ maxWidth: 780 }}>
              <h2 className="eyebrow grey" style={{ marginBottom: 18 }}>
                {t("blog.quotesInYourCityPrefix")} {geoSector.labelPlural} {t("blog.quotesInYourCitySuffix")}
              </h2>
              <div className="blog-links">
                {ACTIVE_CITIES.map((city) => (
                  <Link key={city.slug} href={`/quotes/${geoSector.slug}/${city.slug}/`} className="blog-link-pill">
                    <ArrowRight className="h-3.5 w-3.5" />
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {relatedArticles.length > 0 && (
          <section className="sec soft" style={{ paddingBlock: "clamp(40px, 5vw, 64px)" }}>
            <div className="wrap" style={{ maxWidth: 780 }}>
              <h2 className="h2" style={{ fontSize: "1.5rem", marginBottom: 24 }}>{t("blog.relatedArticles")}</h2>
              <div className="grid sm:grid-cols-3 gap-5">
                {relatedArticles.map((a) => (
                  <Link key={a.slug} href={`/blog/${a.slug}/`} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                    <span className={`chip ${CATEGORY_CHIPS[a.category] ?? "chip-grey"}`} style={{ alignSelf: "flex-start" }}>
                      {a.category}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--navy)", lineHeight: 1.4 }}>
                      {a.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </article>

      <section className="cta on-dark" id="trial">
        <div className="cta-bg">
          <img src="https://picsum.photos/seed/quoteai-blog-article-cta/1800/900" alt="" aria-hidden="true" loading="lazy" />
        </div>
        <div className="wrap cta-in">
          <h2>
            {t("blog.ctaTitlePrefix")} <span style={{ color: "#8ef07f" }}>{t("blog.ctaTitleHighlight")}</span>
          </h2>
          <p>{t("blog.ctaBody")}</p>
          <div className="cta-actions">
            <Link href="/sign-up/" className="btn btn-white">
              {t("blog.ctaButton")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
