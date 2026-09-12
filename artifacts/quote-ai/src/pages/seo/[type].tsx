import { useParams, useLocation, Link } from "wouter";
import { ArrowRight, CheckCircle2, Clock, FileText, Shield, TrendingUp, Star, Building2, BookOpen, X, MapPin } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { SECTORS, DEFAULT_SECTOR, RELATED_SECTORS, SECTOR_KEY_BY_FR_SLUG, CITY_SECTORS, ACTIVE_CITIES } from "@/data/seo-data";
import { BLOG_ARTICLES, SECTOR_ARTICLES } from "@/data/blog-data";
import { getOgImagePath, getSectorFrContent, cityBasePath, type Lang as EngineLang } from "@/data/seo-render-engine";
import { QuotePreviewMockup } from "@/components/quote-preview-mockup";
import { useLanguage, isFrenchPath } from "@/i18n/LanguageContext";

// Highlighted cities on the sector hub page — must stay within ACTIVE_CITIES,
// the only cities actually prerendered/sitemapped right now (see seo-data.ts).
const TIER1_CITIES = ACTIVE_CITIES;

// All cities grouped by region, sorted alphabetically by region then city.
// Ensures every city page gets at least one internal link from the sector
// hub (otherwise it stays orphaned and Google never discovers/indexes it).
// Scoped to ACTIVE_CITIES so this hub never links toward un-prerendered pages.
const CITIES_BY_REGION = ACTIVE_CITIES.reduce<Record<string, typeof ACTIVE_CITIES>>((acc, city) => {
  (acc[city.region] ??= []).push(city);
  return acc;
}, {});
const REGION_NAMES_SORTED = Object.keys(CITIES_BY_REGION).sort((a, b) => a.localeCompare(b, "en-CA"));
for (const region of REGION_NAMES_SORTED) {
  CITIES_BY_REGION[region].sort((a, b) => a.name.localeCompare(b.name, "en-CA"));
}

function ExcelWordComparisonBlock({ tool }: { tool: "Excel" | "Word" }) {
  const { t } = useLanguage();
  const rows = tool === "Excel"
    ? [
        { label: t("seo.compare.excelRow1"), old: false, new: true },
        { label: t("seo.compare.excelRow2"), old: false, new: true },
        { label: t("seo.compare.excelRow3"), old: false, new: true },
        { label: t("seo.compare.excelRow4"), old: false, new: true },
        { label: t("seo.compare.excelRow5"), old: false, new: true },
        { label: t("seo.compare.excelRow6"), old: false, new: true },
        { label: t("seo.compare.excelRow7"), old: false, new: true },
        { label: t("seo.compare.excelRow8"), old: true, new: false },
      ]
    : [
        { label: t("seo.compare.wordRow1"), old: false, new: true },
        { label: t("seo.compare.wordRow2"), old: false, new: true },
        { label: t("seo.compare.wordRow3"), old: false, new: true },
        { label: t("seo.compare.wordRow4"), old: false, new: true },
        { label: t("seo.compare.wordRow5"), old: false, new: true },
        { label: t("seo.compare.wordRow6"), old: false, new: true },
        { label: t("seo.compare.wordRow7"), old: false, new: true },
        { label: t("seo.compare.wordRow8"), old: true, new: true },
      ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">
            {t("seo.compare.headingPrefix").replace("{tool}", tool)} <span className="gradient-text">quoteai</span>: {t("seo.compare.headingSuffix")}
          </h2>
          <p className="text-gray-500 mt-3 text-base">{t("seo.compare.subtitle").replace("{tool}", tool)}</p>
        </div>
        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
          <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-100">
            <div className="py-3 px-5 text-sm font-semibold text-gray-500">{t("seo.compare.featureCol")}</div>
            <div className="py-3 px-5 text-sm font-semibold text-gray-600 text-center border-l border-gray-100">{t("seo.compare.templateCol").replace("{tool}", tool)}</div>
            <div className="py-3 px-5 text-sm font-semibold text-center border-l border-gray-100" style={{ color: "#7C3AED" }}>quoteai AI</div>
          </div>
          {rows.map((r, i) => (
            <div key={i} className={`grid grid-cols-3 border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
              <div className="py-3.5 px-5 text-sm text-gray-700 flex items-center">{r.label}</div>
              <div className="py-3.5 px-5 flex items-center justify-center border-l border-gray-100">
                {r.old
                  ? <CheckCircle2 className="h-5 w-5 text-green-400" />
                  : <X className="h-5 w-5 text-red-300" />}
              </div>
              <div className="py-3.5 px-5 flex items-center justify-center border-l border-gray-100">
                {r.new
                  ? <CheckCircle2 className="h-5 w-5 text-violet-500" />
                  : <X className="h-5 w-5 text-red-300" />}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/sign-up/"
            className="btn-gradient inline-flex h-12 items-center justify-center px-8 text-base font-semibold"
          >
            {t("seo.compare.cta")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ComeFareGuideBlock() {
  const { t } = useLanguage();
  const steps = [
    { n: "1", h: t("seo.guide.step1Title"), body: t("seo.guide.step1Body") },
    { n: "2", h: t("seo.guide.step2Title"), body: t("seo.guide.step2Body") },
    { n: "3", h: t("seo.guide.step3Title"), body: t("seo.guide.step3Body") },
    { n: "4", h: t("seo.guide.step4Title"), body: t("seo.guide.step4Body") },
    { n: "5", h: t("seo.guide.step5Title"), body: t("seo.guide.step5Body") },
  ];

  return (
    <section className="py-20 bg-gray-50/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">
            {t("seo.guide.heading")}
          </h2>
          <p className="text-gray-500 mt-3 text-base">{t("seo.guide.subtitle")}</p>
        </div>
        <div className="space-y-6">
          {steps.map((s) => (
            <div key={s.n} className="bg-white rounded-2xl p-6 card-soft">
              <div className="flex items-start gap-4">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                >
                  {s.n}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-2">{s.h}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PreventiviGratisPlansBlock() {
  const { t } = useLanguage();
  const plans = [
    {
      name: t("seo.plans.starterName"),
      price: "$19",
      period: t("seo.plans.perMonth"),
      highlight: false,
      badge: null,
      features: [
        t("seo.plans.starterFeature1"),
        t("seo.plans.starterFeature2"),
        t("seo.plans.starterFeature3"),
        t("seo.plans.starterFeature4"),
        t("seo.plans.starterFeature5"),
      ],
      cta: t("seo.plans.starterCta"),
      href: "/sign-up",
    },
    {
      name: t("seo.plans.proName"),
      price: "$49",
      period: t("seo.plans.perMonth"),
      highlight: true,
      badge: t("seo.plans.mostChosen"),
      features: [
        t("seo.plans.proFeature1"),
        t("seo.plans.proFeature2"),
        t("seo.plans.proFeature3"),
        t("seo.plans.proFeature4"),
        t("seo.plans.proFeature5"),
      ],
      cta: t("seo.plans.proCta"),
      href: "/sign-up",
    },
    {
      name: t("seo.plans.singleName"),
      price: "$13",
      period: ` ${t("seo.plans.oneTime")}`,
      highlight: false,
      badge: null,
      features: [
        t("seo.plans.singleFeature1"),
        t("seo.plans.singleFeature2"),
        t("seo.plans.singleFeature3"),
        t("seo.plans.singleFeature4"),
        t("seo.plans.singleFeature5"),
      ],
      cta: t("seo.plans.singleCta"),
      href: "/sign-up",
    },
  ];

  return (
    <section className="py-20 bg-gray-50/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">
            {t("seo.plans.heading")}
          </h2>
          <p className="text-gray-500 mt-3 text-base">{t("seo.plans.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl p-6 flex flex-col ${p.highlight ? "shadow-lg border-2 border-violet-400 bg-white" : "border border-gray-100 bg-white card-soft"}`}
            >
              {p.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}>
                    {p.badge}
                  </span>
                </div>
              )}
              <div className="mb-5">
                <h3 className="text-base font-semibold text-gray-900 mb-1">{p.name}</h3>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-3xl font-extrabold text-gray-900">{p.price}</span>
                  <span className="text-sm text-gray-500">{p.period}</span>
                </div>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className={`inline-flex h-10 items-center justify-center px-5 rounded-lg text-sm font-semibold transition-colors ${p.highlight ? "btn-gradient" : "btn-gradient-outline"}`}
              >
                {p.cta}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-400 mt-6">{t("seo.plans.footerNote")}</p>
      </div>
    </section>
  );
}

export default function SeoLanding() {
  const { t } = useLanguage();
  const [pathname] = useLocation();
  const isFr = isFrenchPath(pathname);
  const engineLang: EngineLang = isFr ? "fr-CA" : "en-CA";
  const base = cityBasePath(engineLang);
  const params = useParams();
  const rawSlug = (params as { type?: string }).type ?? "contractor";
  const slug = isFr ? (SECTOR_KEY_BY_FR_SLUG[rawSlug] ?? rawSlug) : rawSlug;
  const s = SECTORS[slug] ?? DEFAULT_SECTOR;
  const sSlugForLang = isFr ? s.frSlug : s.slug;

  // French sector-page copy: titleTag/metaDescription/jsonLdDescription/useCases
  // are hand-authored per sector (SectorData.fr); h1/intro/benefits/howItWorks/faq
  // come from the generic French templates in seo-render-engine.ts.
  const frContent = isFr ? getSectorFrContent(s) : null;
  const titleTag = isFr ? s.fr.titleTag : s.titleTag;
  const metaDescription = isFr ? s.fr.metaDescription : s.metaDescription;
  const jsonLdDescription = isFr ? s.fr.jsonLdDescription : s.jsonLdDescription;
  const h1 = frContent?.h1 ?? s.h1;
  const h1Highlight = frContent?.h1Highlight ?? s.h1Highlight;
  const intro = frContent?.intro ?? s.intro;
  const h2Benefits = frContent?.h2Benefits ?? s.h2Benefits;
  const benefits = frContent?.benefits ?? s.benefits;
  const h2HowItWorks = frContent?.h2HowItWorks ?? s.h2HowItWorks;
  const howItWorks = frContent?.howItWorks ?? s.howItWorks;
  const h2UseCases = frContent?.h2UseCases ?? s.h2UseCases;
  const useCases = isFr ? s.fr.useCases : s.useCases;
  const h2Faq = frContent?.h2Faq ?? s.h2Faq;
  const faq = frContent?.faq ?? s.faq;
  const labelPlural = isFr ? s.fr.labelPlural : s.labelPlural;
  const label = isFr ? s.fr.label : s.label;

  const canonical = `https://quoteai.ca${base}/${sSlugForLang}/`;
  const enCanonical = `https://quoteai.ca/quotes/${s.slug}/`;
  const frCanonical = `https://quoteai.ca/fr/soumissions/${s.frSlug}/`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication" as const,
      name: "quoteai",
      description: jsonLdDescription,
      url: canonical,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: isFr ? "fr" : "en",
      offers: { "@type": "Offer", price: "0", priceCurrency: "CAD", availability: "https://schema.org/InStock" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList" as const,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: isFr ? "Accueil" : "Home", item: isFr ? "https://quoteai.ca/fr/" : "https://quoteai.ca/" },
        { "@type": "ListItem", position: 2, name: h1Highlight, item: canonical },
      ],
    },
    ...(faq.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage" as const,
            mainEntity: faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={titleTag}
        description={metaDescription}
        canonical={canonical}
        jsonLd={jsonLd}
        ogImage={getOgImagePath(s.slug)}
        lang={engineLang}
        frCanonical={frCanonical}
      />
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white pt-24 pb-20" aria-label="Hero">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.12) 0%, transparent 70%)",
          }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
                <Star className="h-3.5 w-3.5 fill-current" />
                {t("seo.builtForMarket")}
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl mb-6 leading-[1.1]">
                {h1}{" "}
                <span className="gradient-text">{h1Highlight}</span>
              </h1>
              <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                {intro}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  href="/sign-up/"
                  className="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold"
                >
                  {t("seo.heroCtaPrimary")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  href="#come-funziona"
                  className="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold"
                >
                  {t("seo.heroCtaSecondary")}
                </Link>
              </div>
              <p className="text-sm text-gray-400 mt-5">{t("seo.heroCaption")}</p>
            </div>
            <div className="hidden lg:block">
              <QuotePreviewMockup sector={s} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────── */}
      <section className="py-20 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">{h2Benefits}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b) => (
              <div key={b.title} className="card-soft bg-white p-7 rounded-2xl flex flex-col">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center mb-5 text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                >
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{b.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="come-funziona" className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">{h2HowItWorks}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.map((step, i) => (
              <div key={i} className="relative">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                >
                  {i + 1}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{step.step}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use cases ────────────────────────────────────── */}
      <section className="py-20 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">{h2UseCases}</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {useCases.map((uc) => (
              <div key={uc} className="flex items-center gap-3 bg-white rounded-xl px-5 py-3.5 card-soft">
                <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" />
                <span className="text-sm text-gray-700">{uc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Guide-specific blocks ────────────────────────── */}
      {slug === "excel-template" && <ExcelWordComparisonBlock tool="Excel" />}
      {slug === "word-template" && <ExcelWordComparisonBlock tool="Word" />}
      {slug === "how-to-quote" && <ComeFareGuideBlock />}
      {slug === "free-quote" && <PreventiviGratisPlansBlock />}

      {/* ── "Built for the Canadian market" ──────────────── */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="rounded-2xl p-10 md:p-14 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.06), rgba(6,182,212,0.06))" }}>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}>
                  <Building2 className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{t("seo.builtForMarket")}</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-600 leading-relaxed">
                <div>
                  <div className="font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-violet-500" /> {t("seo.marketSection.taxTitle")}
                  </div>
                  <p>{t("seo.marketSection.taxBody")}</p>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-violet-500" /> {t("seo.marketSection.businessTitle")}
                  </div>
                  <p>{t("seo.marketSection.businessBody")}</p>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1.5 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-violet-500" /> {t("seo.marketSection.lexiconTitle")}
                  </div>
                  <p>{t("seo.marketSection.lexiconBody")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">{h2Faq}</h2>
          </div>
          <div className="space-y-4">
            {faq.map((f) => (
              <div key={f.q} className="bg-white rounded-2xl p-6 card-soft">
                <h3 className="text-base font-semibold text-gray-900 mb-2">{f.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quotes in major cities ─────────────────────────── */}
      {CITY_SECTORS.includes(slug) && TIER1_CITIES.length > 0 && (
        <section className="py-16 bg-gray-50/60">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {t("seo.cityHub.heading").replace("{trade}", labelPlural)}
              </h2>
              <p className="text-sm text-gray-500 mt-2">
                {t("seo.cityHub.subtitle")}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {TIER1_CITIES.map((city) => (
                <Link
                  key={city.slug}
                  href={`${base}/${sSlugForLang}/${city.slug}/`}
                  className="flex items-center gap-2.5 bg-white hover:bg-violet-50 border border-gray-100 hover:border-violet-200 rounded-xl px-4 py-3 transition-colors group"
                >
                  <MapPin className="h-3.5 w-3.5 text-violet-400 group-hover:text-violet-600 shrink-0" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-violet-700 truncate">
                    {city.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── All cities (internal links for indexing) ──────── */}
      {CITY_SECTORS.includes(slug) && (
        <section className="py-16 bg-white border-t border-gray-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-gray-900">
                {t("seo.allCities.heading").replace("{trade}", labelPlural)}
              </h2>
              <p className="text-sm text-gray-500 mt-2">
                {t("seo.allCities.subtitle")}
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {REGION_NAMES_SORTED.map((region) => (
                <div key={region}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-600 mb-2.5">
                    {region}
                  </h3>
                  <ul className="space-y-1.5">
                    {CITIES_BY_REGION[region].map((city) => (
                      <li key={city.slug}>
                        <Link
                          href={`${base}/${sSlugForLang}/${city.slug}/`}
                          className="text-sm text-gray-500 hover:text-violet-600 transition-colors"
                        >
                          {label} {city.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {RELATED_SECTORS[slug] && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900">{t("seo.seeAlso.heading")}</h2>
              <p className="text-sm text-gray-500 mt-2">{t("seo.seeAlso.subtitle")}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {RELATED_SECTORS[slug].map((r) => (
                <Link
                  key={r.slug}
                  href={`${base}/${isFr ? (SECTORS[r.slug]?.frSlug ?? r.slug) : r.slug}/`}
                  className="flex items-center gap-3 bg-gray-50 hover:bg-violet-50 border border-gray-100 hover:border-violet-200 rounded-xl px-5 py-3.5 transition-colors group"
                >
                  <ArrowRight className="h-4 w-4 text-violet-400 group-hover:text-violet-600 shrink-0" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-violet-700">{t("seo.quotesForLink")} {isFr ? (SECTORS[r.slug]?.fr.label ?? r.label) : r.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Insights ─────────────────────────────────────── */}
      {SECTOR_ARTICLES[slug] && SECTOR_ARTICLES[slug].length > 0 && (() => {
        const articles = SECTOR_ARTICLES[slug]
          .map((articleSlug) => BLOG_ARTICLES.find((a) => a.slug === articleSlug))
          .filter((a): a is (typeof BLOG_ARTICLES)[number] => a !== undefined);
        if (articles.length === 0) return null;
        return (
          <section className="py-16 bg-gray-50/60">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}>
                  <BookOpen className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{t("seo.insights.heading")}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{t("seo.insights.subtitlePrefix")} {h1Highlight.toLowerCase()}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {articles.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/blog/${a.slug}/`}
                    className="group flex flex-col bg-white rounded-xl border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all p-5"
                  >
                    <span className="text-xs font-semibold text-violet-600 mb-2">{a.category}</span>
                    <span className="text-sm font-semibold text-gray-800 group-hover:text-violet-700 transition-colors leading-snug mb-2">
                      {a.title}
                    </span>
                    <span className="text-xs text-gray-400 mt-auto">{a.readingTimeMin} {t("blog.readingTimeSuffix")}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link href="/blog/" className="text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors">
                  {t("seo.insights.viewAll")}
                </Link>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Clock className="h-5 w-5 text-violet-500" />
            <span className="text-sm font-semibold text-violet-600">{t("seo.finalCta.badge")}</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {t("seo.finalCta.headingPrefix")}{" "}
            <span className="gradient-text">{t("seo.finalCta.headingHighlight")}</span>?
          </h2>
          <p className="text-lg text-gray-500 mb-10">
            {t("seo.finalCta.bodyPrefix")} {h1Highlight.toLowerCase()} {t("seo.finalCta.bodySuffix")}
          </p>
          <Link
            href="/sign-up/"
            className="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold"
          >
            {t("blog.ctaButton")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
