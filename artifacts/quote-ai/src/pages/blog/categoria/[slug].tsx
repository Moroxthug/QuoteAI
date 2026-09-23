import { useParams, Link } from "wouter";
import { MarketingImage } from "@/components/marketing-image";
import { ArrowRight } from "lucide-react";
import {
  BLOG_CATEGORIES,
  getCategoryBySlug,
  getArticlesByCategory,
} from "@/data/blog-index";
import { SeoHead } from "@/components/seo-head";
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

const BASE_URL = "https://quoteai.ca";

export default function BlogCategoryPage() {
  const { t, lang } = useLanguage();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const category = getCategoryBySlug(slug);

  if (!category) {
    return (
      <div className="wrap" style={{ textAlign: "center", paddingBlock: "clamp(80px, 10vw, 140px)" }}>
        <h1 className="h2">{t("blog.categoryNotFoundTitle")}</h1>
        <p className="lead" style={{ margin: "16px auto 32px" }}>{t("blog.categoryNotFoundBody")}</p>
        <Link href="/blog/" className="btn btn-navy">
          {t("blog.backToBlog")}
        </Link>
      </div>
    );
  }

  const articles = getArticlesByCategory(category.name);
  const canonical = `${BASE_URL}/blog/categoria/${category.slug}/`;

  const jsonLd = [
    {
      "@context": "https://schema.org" as const,
      "@type": "CollectionPage" as const,
      name: `${category.name} — Blog quoteai`,
      description: category.description,
      url: canonical,
      inLanguage: "en",
    },
    {
      "@context": "https://schema.org" as const,
      "@type": "BreadcrumbList" as const,
      itemListElement: [
        { "@type": "ListItem" as const, position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem" as const, position: 2, name: "Blog", item: `${BASE_URL}/blog` },
        { "@type": "ListItem" as const, position: 3, name: category.name, item: canonical },
      ],
    },
  ];

  const otherCategories = BLOG_CATEGORIES.filter((c) => c.slug !== slug);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={`${category.name} — Blog quoteai`}
        description={category.description}
        canonical={canonical}
        jsonLd={jsonLd}
      />

      <div className="wrap">
        <nav aria-label={t("seo.city.breadcrumbAria")} className="crumbs">
          <Link href="/">{t("blog.breadcrumbHome")}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <Link href="/blog/">{t("blog.breadcrumbBlog")}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">{category.name}</span>
        </nav>
      </div>

      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ textAlign: "center", maxWidth: 720, margin: "0 auto", paddingBlock: "clamp(40px, 5vw, 72px)" }}>
          <span className={`chip ${CATEGORY_CHIPS[category.name] ?? "chip-grey"}`} style={{ marginBottom: 20 }}>
            {category.name}
          </span>
          <h1>
            {t("blog.articlesAbout")} <span style={{ color: "#8ef07f" }}>{category.name}</span>
          </h1>
          <p className="lead" style={{ margin: "16px auto 0" }}>
            {category.description}
          </p>
          <p style={{ fontSize: 13, color: "#8f91a6", fontWeight: 600, marginTop: 16 }}>
            {articles.length} {articles.length === 1 ? t("blog.articleCountSingular") : t("blog.articleCountPlural")}
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          {articles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--faint)" }}>
              <p style={{ fontSize: 18, fontWeight: 600 }}>{t("blog.noArticlesInCategory")}</p>
              <Link href="/blog/" className="cta-link" style={{ marginTop: 20, display: "inline-flex" }}>
                {t("blog.backToBlogArrow")}
              </Link>
            </div>
          ) : (
            <div className="news-grid">
              {/* Phase 83: the card titles are <h3> under the page's <h1> —
                  a level skipped, and a screen reader jumping by heading
                  lands nowhere in between. The list gets its own heading. */}
              <h2 className="sr-only">{t("blog.articlesAbout")} {category.name}</h2>
              {articles.map((article) => (
                <Link key={article.slug} href={`/blog/${article.slug}/`} className="card news-card">
                  <div className="news-media">
                    <MarketingImage slot="blog-card" seed={article.slug} />
                  </div>
                  <div className="news-body">
                    <p className="news-meta">
                      <span className={`chip ${CATEGORY_CHIPS[article.category] ?? "chip-grey"}`}>{article.category}</span>
                      {article.readingTimeMin} {t("blog.readingTimeSuffix")}
                    </p>
                    <h3>{article.title}</h3>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <time style={{ fontSize: 12.5, color: "var(--faint)" }} dateTime={article.publishedAt}>
                        {formatDate(article.publishedAt, lang)}
                      </time>
                      <span className="cta-link" style={{ fontSize: 14 }}>{t("blog.readArticle")} <ArrowRight className="chev h-4 w-4" /></span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {otherCategories.length > 0 && (
        <section className="sec soft" style={{ paddingBlock: "clamp(36px, 4vw, 56px)" }}>
          <div className="wrap">
            <h2 className="eyebrow grey" style={{ marginBottom: 18 }}>{t("blog.otherCategories")}</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {otherCategories.map((cat) => (
                <Link key={cat.slug} href={`/blog/categoria/${cat.slug}/`} className={`chip ${CATEGORY_CHIPS[cat.name] ?? "chip-grey"}`}>
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="cta on-dark" id="trial">
        <div className="cta-bg">
          <MarketingImage slot="cta-blog-category" />
        </div>
        <div className="wrap cta-in">
          <h2>
            {t("blog.ctaTitlePrefix")} <span style={{ color: "#8ef07f" }}>{t("blog.ctaTitleHighlight")}</span>
          </h2>
          <p>{t("blog.ctaBody")}</p>
          <div className="cta-actions">
            <Link href="/sign-up/" className="btn btn-white">
              {t("blog.ctaButton")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
