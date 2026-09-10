import { useParams, Link } from "wouter";
import { BLOG_ARTICLES } from "@/data/blog-data";
import { SECTORS, ACTIVE_CITIES, CITY_SECTORS } from "@/data/seo-data";
import { extractToc, injectHeadingIds } from "@/data/blog-toc";
import { SeoHead } from "@/components/seo-head";
import { useLanguage } from "@/i18n/LanguageContext";

function formatDate(iso: string, lang: "en" | "fr"): string {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { day: "numeric", month: "long", year: "numeric" });
}

const CATEGORY_COLORS: Record<string, string> = {
  Professioni: "bg-violet-50 text-violet-700",
  Prezzi: "bg-cyan-50 text-cyan-700",
  Consigli: "bg-amber-50 text-amber-700",
  Tool: "bg-green-50 text-green-700",
  Innovazione: "bg-blue-50 text-blue-700",
  Business: "bg-rose-50 text-rose-700",
};

const BASE_URL = "https://quoteai.ca";

export default function BlogArticlePage() {
  const { t, lang } = useLanguage();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const article = BLOG_ARTICLES.find((a) => a.slug === slug);

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{t("blog.articleNotFoundTitle")}</h1>
        <p className="text-gray-500 mb-8">{t("blog.articleNotFoundBody")}</p>
        <Link href="/blog/" className="btn-gradient inline-flex h-11 items-center justify-center px-7 text-sm font-semibold">
          {t("blog.backToBlog")}
        </Link>
      </div>
    );
  }

  const canonical = `${BASE_URL}/blog/${article.slug}/`;
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
      url: canonical,
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
        ogType="article"
        jsonLd={jsonLd}
      />

      <nav aria-label={t("seo.city.breadcrumbAria")} className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <ol className="flex items-center text-sm text-gray-500 flex-wrap gap-1">
            <li><Link href="/" className="hover:text-violet-600 transition-colors">{t("blog.breadcrumbHome")}</Link></li>
            <li aria-hidden="true" className="mx-1.5 text-gray-300">/</li>
            <li><Link href="/blog/" className="hover:text-violet-600 transition-colors">{t("blog.breadcrumbBlog")}</Link></li>
            <li aria-hidden="true" className="mx-1.5 text-gray-300">/</li>
            <li className="text-gray-900 font-medium truncate max-w-[200px]" aria-current="page">{article.title}</li>
          </ol>
        </div>
      </nav>

      <article className="flex-1">
        <header className="bg-gradient-to-br from-violet-50/40 to-cyan-50/20 pt-14 pb-10 border-b border-gray-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
            <div className="flex items-center gap-3 mb-5">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[article.category] ?? "bg-gray-100 text-gray-600"}`}>
                {article.category}
              </span>
              <span className="text-xs text-gray-400">{article.readingTimeMin} {t("blog.readingTimeSuffix")}</span>
              <time className="text-xs text-gray-400" dateTime={article.publishedAt}>
                {formatDate(article.publishedAt, lang)}
              </time>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl leading-tight mb-4">
              {article.title}
            </h1>
            <p className="text-base text-gray-500 leading-relaxed">
              {article.metaDescription}
            </p>
          </div>
        </header>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl py-10">
          {toc.length >= 2 && (
            <nav
              aria-label={t("blog.toc")}
              className="mb-10 rounded-xl border border-violet-100 bg-violet-50/40 px-6 py-5"
            >
              <p className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-3">{t("blog.toc")}</p>
              <ol className="space-y-1.5">
                {toc.map((item) => (
                  <li key={item.id} className={item.level === 3 ? "pl-4" : ""}>
                    <a
                      href={`#${item.id}`}
                      className="text-sm text-gray-700 hover:text-violet-700 transition-colors leading-snug"
                    >
                      {item.level === 3 && <span className="mr-1 text-gray-400">–</span>}
                      {item.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div
            className="prose prose-gray prose-headings:font-bold prose-h2:text-xl prose-h3:text-base prose-p:leading-relaxed prose-li:leading-relaxed prose-a:text-violet-600 max-w-none"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>

        {relatedSectorObjects.length > 0 && (
          <section className="border-t border-gray-100 bg-gray-50 py-10">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
              <h2 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">{t("blog.quotesBySector")}</h2>
              <div className="flex flex-wrap gap-3">
                {relatedSectorObjects.map((sector) => (
                  <Link
                    key={sector.slug}
                    href={`/preventivi/${sector.slug}/`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:border-violet-300 hover:text-violet-700 transition-colors"
                  >
                    <span className="text-violet-400 font-bold" aria-hidden="true">→</span>
                    {t("blog.quotesForPrefix")} {sector.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {geoSector && (
          <section className="border-t border-gray-100 bg-white py-10">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
              <h2 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">
                {t("blog.quotesInYourCityPrefix")} {geoSector.labelPlural} {t("blog.quotesInYourCitySuffix")}
              </h2>
              <div className="flex flex-wrap gap-3">
                {ACTIVE_CITIES.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/preventivi/${geoSector.slug}/${city.slug}/`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:border-violet-300 hover:text-violet-700 transition-colors"
                  >
                    <span className="text-violet-400 font-bold" aria-hidden="true">→</span>
                    {city.name}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {relatedArticles.length > 0 && (
          <section className="py-12 border-t border-gray-100">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
              <h2 className="text-lg font-bold text-gray-900 mb-6">{t("blog.relatedArticles")}</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {relatedArticles.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/blog/${a.slug}/`}
                    className="group flex flex-col bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all p-4"
                  >
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full self-start mb-2 ${CATEGORY_COLORS[a.category] ?? "bg-gray-100 text-gray-600"}`}>
                      {a.category}
                    </span>
                    <span className="text-xs font-semibold text-gray-800 group-hover:text-violet-700 transition-colors leading-snug">
                      {a.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </article>

      <section className="py-16 bg-gradient-to-br from-violet-50/60 to-cyan-50/20 border-t border-violet-100/60">
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
            <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
