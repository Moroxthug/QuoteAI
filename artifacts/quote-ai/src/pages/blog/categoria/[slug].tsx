import { useParams, Link } from "wouter";
import {
  BLOG_CATEGORIES,
  getCategoryBySlug,
  getArticlesByCategory,
} from "@/data/blog-data";
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

export default function BlogCategoryPage() {
  const { t, lang } = useLanguage();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const category = getCategoryBySlug(slug);

  if (!category) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{t("blog.categoryNotFoundTitle")}</h1>
        <p className="text-gray-500 mb-8">{t("blog.categoryNotFoundBody")}</p>
        <Link href="/blog/" className="btn-gradient inline-flex h-11 items-center justify-center px-7 text-sm font-semibold">
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

      <nav aria-label={t("seo.city.breadcrumbAria")} className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <ol className="flex items-center text-sm text-gray-500 flex-wrap gap-1">
            <li><Link href="/" className="hover:text-navy-600 transition-colors">{t("blog.breadcrumbHome")}</Link></li>
            <li aria-hidden="true" className="mx-1.5 text-gray-300">/</li>
            <li><Link href="/blog/" className="hover:text-navy-600 transition-colors">{t("blog.breadcrumbBlog")}</Link></li>
            <li aria-hidden="true" className="mx-1.5 text-gray-300">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">{category.name}</li>
          </ol>
        </div>
      </nav>

      <section className="bg-gradient-to-br from-navy-50/60 to-teal-50/30 pt-14 pb-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center">
          <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold mb-5 ${CATEGORY_COLORS[category.name] ?? "bg-gray-100 text-gray-600"}`}>
            {category.name}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl mb-3 leading-tight">
            {t("blog.articlesAbout")} <span className="gradient-text">{category.name}</span>
          </h1>
          <p className="text-base text-gray-500 leading-relaxed max-w-2xl mx-auto">
            {category.description}
          </p>
          <p className="text-xs text-gray-400 mt-3">
            {articles.length} {articles.length === 1 ? t("blog.articleCountSingular") : t("blog.articleCountPlural")}
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          {articles.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg font-medium">{t("blog.noArticlesInCategory")}</p>
              <Link href="/blog/" className="mt-6 inline-block text-navy-600 hover:underline text-sm font-semibold">
                {t("blog.backToBlogArrow")}
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
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
                    <h2 className="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-navy-700 transition-colors flex-1">
                      {article.title}
                    </h2>
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
          )}
        </div>
      </section>

      {otherCategories.length > 0 && (
        <section className="py-10 bg-gray-50 border-t border-gray-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">{t("blog.otherCategories")}</h2>
            <div className="flex flex-wrap gap-3">
              {otherCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/blog/categoria/${cat.slug}/`}
                  className={`inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${CATEGORY_COLORS[cat.name] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16 bg-white border-t border-gray-100 mt-auto">
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
