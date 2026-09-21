import { Link } from "wouter";
import { ArrowRight, ClipboardList, Gift, BarChart3, FileText } from "lucide-react";
import { BLOG_INDEX, BLOG_CATEGORIES, BLOG_LIST_TITLE, BLOG_LIST_DESCRIPTION, GUIDE_CARDS } from "@/data/blog-index";
import { SeoHead } from "@/components/seo-head";
import { useLanguage } from "@/i18n/LanguageContext";
import { useScrollFade } from "@/hooks/use-scroll-fade";

function ScrollSection({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useScrollFade();
  return (
    <section id={id} ref={ref as React.RefObject<HTMLElement>} className={`fade-in-section ${className}`}>
      {children}
    </section>
  );
}

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

const GUIDE_ICONS: Record<string, typeof ClipboardList> = {
  "how-to-quote": ClipboardList,
  "free-quote": Gift,
  "excel-template": BarChart3,
  "word-template": FileText,
};

const BASE_URL = "https://quoteai.ca";

export default function BlogPage() {
  const { t, lang } = useLanguage();

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={BLOG_LIST_TITLE}
        description={BLOG_LIST_DESCRIPTION}
        canonical={`${BASE_URL}/blog/`}
      />

      <div className="wrap">
        <nav aria-label={t("seo.city.breadcrumbAria")} className="crumbs">
          <Link href="/">{t("blog.breadcrumbHome")}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">{t("blog.breadcrumbBlog")}</span>
        </nav>
      </div>

      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto", padding: "clamp(48px, 6vw, 84px) 0" }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 22, justifyContent: "center", display: "flex" }}>
            {t("blog.heroBadge")}
          </p>
          <h1>
            {t("blog.heroTitlePrefix")} <span style={{ color: "#8ef07f" }}>{t("blog.heroTitleHighlight")}</span>
          </h1>
          <p className="lead" style={{ margin: "16px auto 0" }}>{BLOG_LIST_DESCRIPTION}</p>
        </div>
      </section>

      <section className="sec" style={{ paddingBlock: "clamp(28px, 3vw, 40px)" }}>
        <div className="wrap">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span className="eyebrow grey" style={{ marginRight: 4 }}>{t("blog.categoriesLabel")}</span>
            {BLOG_CATEGORIES.map((cat) => (
              <Link key={cat.slug} href={`/blog/categoria/${cat.slug}/`} className={`chip ${CATEGORY_CHIPS[cat.name] ?? "chip-grey"}`}>
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ScrollSection className="sec soft" id="guides">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">{t("blog.practicalGuidesTitle")}</span>
              <h2 className="h2">{t("blog.practicalGuidesSubtitle")}</h2>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {GUIDE_CARDS.map((guide) => {
              const Icon = GUIDE_ICONS[guide.slug] ?? FileText;
              return (
                <Link key={guide.slug} href={guide.href} className="card" style={{ padding: 26, display: "flex", flexDirection: "column", gap: 12 }}>
                  <span className="guide-icon"><Icon className="h-5 w-5" /></span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", lineHeight: 1.35 }}>{guide.title}</h3>
                  <p style={{ fontSize: 13, color: "var(--muted-mk)", lineHeight: 1.55, flex: 1 }}>{guide.description}</p>
                  <span className="cta-link" style={{ fontSize: 13.5 }}>{t("blog.readGuide")}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </ScrollSection>

      <ScrollSection className="sec" id="articles">
        <div className="wrap">
          <div className="news-grid">
            {BLOG_INDEX.map((article, i) => (
              <Link key={article.slug} href={`/blog/${article.slug}/`} className="card news-card">
                <div className="news-media">
                  <img src={`https://picsum.photos/seed/quoteai-blog-${i}/840/525`} alt="" loading="lazy" />
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
        </div>
      </ScrollSection>

      <ScrollSection className="cta on-dark" id="trial">
        <div className="cta-bg">
          <img src="https://picsum.photos/seed/quoteai-blog-cta/1800/900" alt="" aria-hidden="true" loading="lazy" />
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
      </ScrollSection>
    </div>
  );
}
