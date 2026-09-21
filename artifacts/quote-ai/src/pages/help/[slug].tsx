// Phase 70: one help-centre article. Blocks are structured data rendered as
// React (no HTML injection) so the same copy serves EN and FR; the
// prerendered file is EN, the language toggle re-renders in place.
import { useParams, Link } from "wouter";
import { ArrowRight, Info } from "lucide-react";
import { HELP_ARTICLES, HELP_CATEGORIES, findHelpArticle, type HelpBlock, type L } from "@/data/help-articles";
import { SeoHead } from "@/components/seo-head";
import { useLanguage } from "@/i18n/LanguageContext";

const BASE_URL = "https://quoteai.ca";

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function Block({ block, lang }: { block: HelpBlock; lang: keyof L }) {
  switch (block.type) {
    case "h":
      return <h2 id={slugify(block.text.en)}>{block.text[lang]}</h2>;
    case "p":
      return <p>{block.text[lang]}</p>;
    case "steps":
      return (
        <ol>
          {block.items.map((item, i) => <li key={i}>{item[lang]}</li>)}
        </ol>
      );
    case "bullets":
      return (
        <ul>
          {block.items.map((item, i) => <li key={i}>{item[lang]}</li>)}
        </ul>
      );
    case "note":
      return (
        <aside className="help-note" role="note">
          <Info className="h-4 w-4" aria-hidden="true" />
          <p>{block.text[lang]}</p>
        </aside>
      );
  }
}

export default function HelpArticlePage() {
  const { t, lang } = useLanguage();
  const params = useParams<{ slug: string }>();
  const article = findHelpArticle(params.slug);

  if (!article) {
    return (
      <div className="wrap" style={{ textAlign: "center", padding: "clamp(80px, 10vw, 140px) 0" }}>
        <h1 className="h2">{t("help.notFoundTitle")}</h1>
        <p className="lead" style={{ margin: "16px auto 32px" }}>{t("help.notFoundBody")}</p>
        <Link href="/help/" className="btn btn-navy">{t("help.backToHelp")}</Link>
      </div>
    );
  }

  const canonical = `${BASE_URL}/help/${article.slug}/`;
  const headings = article.blocks.filter((b): b is Extract<HelpBlock, { type: "h" }> => b.type === "h");
  const related = HELP_ARTICLES.filter((a) => a.slug !== article.slug && a.category === article.category);
  const next = HELP_ARTICLES[HELP_ARTICLES.findIndex((a) => a.slug === article.slug) + 1];

  const jsonLd = [
    {
      "@context": "https://schema.org" as const,
      "@type": "TechArticle" as const,
      headline: article.title[lang],
      description: article.summary[lang],
      url: canonical,
      dateModified: article.updatedAt,
      inLanguage: lang,
      author: { "@type": "Organization" as const, name: "quoteai", url: BASE_URL },
      publisher: { "@type": "Organization" as const, name: "quoteai", url: BASE_URL, logo: { "@type": "ImageObject" as const, url: `${BASE_URL}/icon-192.png`, width: 192, height: 192 } },
    },
    {
      "@context": "https://schema.org" as const,
      "@type": "BreadcrumbList" as const,
      itemListElement: [
        { "@type": "ListItem" as const, position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem" as const, position: 2, name: t("help.breadcrumb"), item: `${BASE_URL}/help/` },
        { "@type": "ListItem" as const, position: 3, name: article.title[lang], item: canonical },
      ],
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead title={`${article.title[lang]} | quoteai`} description={article.summary[lang]} canonical={canonical} ogType="article" jsonLd={jsonLd} />

      <div className="wrap">
        <nav aria-label={t("seo.city.breadcrumbAria")} className="crumbs">
          <Link href="/">{t("blog.breadcrumbHome")}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <Link href="/help/">{t("help.breadcrumb")}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} aria-current="page">{article.title[lang]}</span>
        </nav>
      </div>

      <article className="flex-1">
        <header className="wrap" style={{ maxWidth: 780, padding: "clamp(12px, 2vw, 24px) 0 clamp(28px, 3.5vw, 44px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
            <span className="chip chip-teal">{HELP_CATEGORIES[article.category][lang]}</span>
            <span style={{ fontSize: 13, color: "var(--faint)" }}>{article.readingTimeMin} {t("blog.readingTimeSuffix")}</span>
          </div>
          <h1 style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)", fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)", lineHeight: 1.15, marginBottom: 16 }}>
            {article.title[lang]}
          </h1>
          <p className="lead" style={{ maxWidth: "none" }}>{article.summary[lang]}</p>
        </header>

        <div className="wrap" style={{ maxWidth: 780, paddingBottom: "clamp(40px, 5vw, 64px)" }}>
          {headings.length >= 3 && (
            <nav aria-label={t("blog.toc")} className="blog-toc">
              <p className="label">{t("blog.toc")}</p>
              <ol>
                {headings.map((hd) => (
                  <li key={hd.text.en}><a href={`#${slugify(hd.text.en)}`}>{hd.text[lang]}</a></li>
                ))}
              </ol>
            </nav>
          )}

          <div className="prose blog-prose max-w-none">
            {article.blocks.map((block, i) => <Block key={i} block={block} lang={lang} />)}
          </div>
        </div>

        {related.length > 0 && (
          <section className="sec soft" style={{ paddingBlock: "clamp(36px, 4vw, 56px)" }}>
            <div className="wrap" style={{ maxWidth: 780 }}>
              <h2 className="eyebrow grey" style={{ marginBottom: 18 }}>{t("help.related")}</h2>
              <div className="blog-links">
                {related.map((a) => (
                  <Link key={a.slug} href={`/help/${a.slug}/`} className="blog-link-pill">
                    <ArrowRight className="h-3.5 w-3.5" />
                    {a.title[lang]}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="sec" style={{ paddingBlock: "clamp(32px, 4vw, 48px)" }}>
          <div className="wrap" style={{ maxWidth: 780, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/help/" className="cta-link" style={{ fontSize: 14 }}>{t("help.backToHelp")}</Link>
            {next && (
              <Link href={`/help/${next.slug}/`} className="btn btn-outline-navy btn-sm">
                {t("help.nextArticle")}: {next.title[lang]} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </section>
      </article>
    </div>
  );
}
