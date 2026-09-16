import { Link } from "wouter";
import { BLOG_ARTICLES, BLOG_CATEGORIES, BLOG_LIST_TITLE, BLOG_LIST_DESCRIPTION, GUIDE_CARDS } from "@/data/blog-data";
import { SeoHead } from "@/components/seo-head";
import { useLanguage } from "@/i18n/LanguageContext";

function formatDate(iso: string, lang: "en" | "fr"): string {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { day: "numeric", month: "long", year: "numeric" });
}

const CATEGORY_COLORS: Record<string, string> = {
  Professioni: "bg-navy-50 text-navy-700",
  Prezzi: "bg-teal-50 text-teal-700",
  Consigli: "bg-amber-50 text-amber-700",
  Tool: "bg-green-50 text-green-700",
  Innovazione: "bg-blue-50 text-blue-700",
  Business: "bg-rose-50 text-rose-700",
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
      <nav aria-label={t("seo.city.breadcrumbAria")} className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <ol className="flex items-center text-sm text-gray-500 flex-wrap gap-1">
            <li><Link href="/" className="hover:text-navy-600 transition-colors">{t("blog.breadcrumbHome")}</Link></li>
            <li aria-hidden="true" className="mx-1.5 text-gray-300">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">{t("blog.breadcrumbBlog")}</li>
          </ol>
        </div>
      </nav>

      <section className="bg-gradient-to-br from-navy-50/60 to-teal-50/30 pt-16 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-navy-100 border border-navy-200 px-4 py-1.5 text-sm font-medium text-navy-700 mb-6">
            {t("blog.heroBadge")}
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl mb-4 leading-tight">
            {t("blog.heroTitlePrefix")} <span className="gradient-text">{t("blog.heroTitleHighlight")}</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            {BLOG_LIST_DESCRIPTION}
          </p>
        </div>
      </section>

      <section className="border-b border-gray-100 bg-white py-4">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">{t("blog.categoriesLabel")}</span>
            {BLOG_CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/blog/categoria/${cat.slug}/`}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${CATEGORY_COLORS[cat.name] ?? "bg-gray-100 text-gray-600"} border-transparent hover:opacity-80`}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 bg-navy-50/40 border-b border-navy-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">{t("blog.practicalGuidesTitle")}</h2>
            <p className="text-sm text-gray-500 mt-1">{t("blog.practicalGuidesSubtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {GUIDE_CARDS.map((guide) => (
              <Link
                key={guide.slug}
                href={guide.href}
                className="group flex flex-col bg-white rounded-2xl border border-navy-100 hover:border-navy-300 hover:shadow-md transition-all duration-200 p-5"
              >
                <span className="text-2xl mb-3">{guide.icon}</span>
                <h3 className="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-navy-700 transition-colors">
                  {guide.title}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed flex-1">
                  {guide.description}
                </p>
                <span className="mt-3 text-xs font-semibold text-navy-600 group-hover:translate-x-0.5 transition-transform inline-block">
                  {t("blog.readGuide")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BLOG_ARTICLES.map((article) => (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}/`}
                className="group flex flex-col bg-white rounded-2xl border border-gray-100 hover:border-navy-200 hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[article.category] ?? "bg-gray-100 text-gray-600"}`}>
                      {article.category}
                    </span>
                    <span className="text-xs text-gray-400">{article.readingTimeMin} min</span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-navy-700 transition-colors flex-1">
                    {article.title}
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4 line-clamp-3">
                    {article.metaDescription}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                    <time className="text-xs text-gray-400" dateTime={article.publishedAt}>
                      {formatDate(article.publishedAt, lang)}
                    </time>
                    <span className="text-xs font-semibold text-navy-600 group-hover:translate-x-0.5 transition-transform">
                      {t("blog.readArticle")}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50 border-t border-gray-100 mt-auto">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {t("blog.ctaTitlePrefix")} <span className="gradient-text">{t("blog.ctaTitleHighlight")}</span>
          </h2>
          <p className="text-gray-500 mb-8 text-sm">
            {t("blog.ctaBody")}
          </p>
          <Link
            href="/sign-up/"
            className="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold"
          >
            {t("blog.ctaButton")}
          </Link>
        </div>
      </section>
    </div>
  );
}
