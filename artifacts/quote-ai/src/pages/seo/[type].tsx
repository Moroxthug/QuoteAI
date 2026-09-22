import { useParams, useLocation, Link } from "wouter";
import { ArrowRight, CheckCircle2, Clock, FileText, Shield, TrendingUp, Star, Building2, BookOpen, X, MapPin } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { SECTORS, DEFAULT_SECTOR, RELATED_SECTORS, SECTOR_KEY_BY_FR_SLUG, CITY_SECTORS, ACTIVE_CITIES } from "@/data/seo-data";
import { BLOG_INDEX, SECTOR_ARTICLES } from "@/data/blog-index";
import { getOgImagePath, getSectorFrContent, getSectorDeepDive, cityBasePath, type Lang as EngineLang } from "@/data/seo-render-engine";
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

const FI_COLORS = ["g", "t", "p"] as const;

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
    <section className="sec soft">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
          <span className="eyebrow grey">{t("seo.compare.headingPrefix").replace("{tool}", tool)}</span>
          <h2 className="h2">
            quoteai {t("seo.compare.headingSuffix")}
          </h2>
          <p className="lead" style={{ margin: "0 auto" }}>{t("seo.compare.subtitle").replace("{tool}", tool)}</p>
        </div>
        <div className="card cmp-wrap" tabIndex={0}>
          <table className="cmp">
            <thead>
              <tr>
                <th>{t("seo.compare.featureCol")}</th>
                <th>{t("seo.compare.templateCol").replace("{tool}", tool)}</th>
                <th className="q">quoteai AI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td style={{ textAlign: "center" }}>
                    {r.old
                      ? <CheckCircle2 className="h-4 w-4" style={{ color: "var(--green)", display: "inline-block" }} />
                      : <X className="h-4 w-4" style={{ color: "var(--red)", display: "inline-block" }} />}
                  </td>
                  <td className="q" style={{ textAlign: "center" }}>
                    {r.new
                      ? <CheckCircle2 className="h-4 w-4" style={{ color: "var(--green-dark)", display: "inline-block" }} />
                      : <X className="h-4 w-4" style={{ color: "var(--red)", display: "inline-block" }} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cmp-cta">
          <Link href="/sign-up/" className="btn btn-navy">
            {t("seo.compare.cta")}
            <ArrowRight className="chev h-4 w-4" />
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
    <section className="sec">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
          <h2 className="h2">{t("seo.guide.heading")}</h2>
          <p className="lead" style={{ margin: "0 auto" }}>{t("seo.guide.subtitle")}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {steps.map((s) => (
            <div key={s.n} className="card" style={{ padding: 22, display: "flex", gap: 16, alignItems: "flex-start" }}>
              <span style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--navy)", color: "#fff", fontSize: 14, fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0 }}>{s.n}</span>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)", marginBottom: 6 }}>{s.h}</h3>
                <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.6 }}>{s.body}</p>
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
    <section className="sec soft">
      <div className="wrap" style={{ maxWidth: 980 }}>
        <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
          <h2 className="h2">{t("seo.plans.heading")}</h2>
          <p className="lead" style={{ margin: "0 auto" }}>{t("seo.plans.subtitle")}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.name}
              className="card"
              style={{
                position: "relative",
                padding: 26,
                display: "flex",
                flexDirection: "column",
                borderColor: p.highlight ? "var(--navy)" : undefined,
                borderWidth: p.highlight ? 2 : undefined,
                boxShadow: p.highlight ? "var(--shadow-card)" : undefined,
              }}
            >
              {p.badge && (
                <span className="chip chip-new" style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)" }}>
                  {p.badge}
                </span>
              )}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>{p.name}</h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                  <span style={{ fontSize: 30, fontWeight: 800, color: "var(--navy)" }}>{p.price}</span>
                  <span style={{ fontSize: 14, color: "var(--muted-mk)" }}>{p.period}</span>
                </div>
              </div>
              <ul style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, flex: 1 }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--muted-mk)" }}>
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--green)" }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={p.href} className={`btn btn-sm ${p.highlight ? "btn-navy" : "btn-outline-navy"}`}>
                {p.cta}
                <ArrowRight className="chev h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--faint)", marginTop: 24 }}>{t("seo.plans.footerNote")}</p>
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
  const deepDive = getSectorDeepDive(s, engineLang);

  const canonical = `https://quoteai.ca${base}/${sSlugForLang}/`;
  // Every sector has a page in both languages.
  const altCanonical = isFr ? `https://quoteai.ca/quotes/${s.slug}/` : `https://quoteai.ca/fr/soumissions/${s.frSlug}/`;
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
        altCanonical={altCanonical}
      />

      <div className="wrap">
        <nav aria-label={t("seo.city.breadcrumbAria")} className="crumbs">
          <Link href={isFr ? "/fr" : "/"}>{t("blog.breadcrumbHome")}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">{h1Highlight}</span>
        </nav>
      </div>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="hero on-dark" id="hero">
        <div className="wrap hero-grid" style={{ paddingTop: "clamp(36px, 5vw, 64px)", paddingBottom: "clamp(64px, 8vw, 96px)" }}>
          <div>
            <p className="eyebrow on-dark" style={{ marginBottom: 20, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Star className="h-3.5 w-3.5" style={{ fill: "currentColor" }} />
              {t("seo.builtForMarket")}
            </p>
            <h1>
              {h1} <em style={{ fontStyle: "normal", color: "#8ef07f" }}>{h1Highlight}</em>
            </h1>
            <p className="lead">{intro}</p>
            <div className="hero-cta">
              <Link href="/sign-up/" className="btn btn-white">
                {t("seo.heroCtaPrimary")}
                <ArrowRight className="chev h-4 w-4" />
              </Link>
              <Link href="#how-it-works" className="btn btn-outline-light">
                {t("seo.heroCtaSecondary")}
              </Link>
            </div>
            <p className="hero-note">{t("seo.heroCaption")}</p>
          </div>
          <div className="hidden lg:block">
            <QuotePreviewMockup sector={s} />
          </div>
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────── */}
      <section className="sec soft">
        <div className="wrap">
          <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
            <h2 className="h2">{h2Benefits}</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {benefits.map((b, i) => (
              <div key={b.title} className="dd-feat" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                <span className={`fi ${FI_COLORS[i % FI_COLORS.length]}`}>
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <b>{b.title}</b>
                <p>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="how-it-works" className="sec">
        <div className="wrap" style={{ maxWidth: 960 }}>
          <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
            <h2 className="h2">{h2HowItWorks}</h2>
          </div>
          <div className="steps3">
            {howItWorks.map((step, i) => (
              <div key={i} className="step">
                <span className="n">{i + 1}</span>
                <b>{step.step}</b>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use cases ────────────────────────────────────── */}
      <section className="sec soft">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
            <h2 className="h2">{h2UseCases}</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {useCases.map((uc) => (
              <div key={uc} className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px" }}>
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--green)" }} />
                <span style={{ fontSize: 14, color: "var(--ink)" }}>{uc}</span>
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
      <section className="sec">
        <div className="wrap" style={{ maxWidth: 980 }}>
          <div className="card" style={{ padding: "clamp(28px, 4vw, 48px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <span className="fi p"><Building2 className="h-5 w-5" /></span>
              <h2 className="h2" style={{ fontSize: 22 }}>{t("seo.builtForMarket")}</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div style={{ fontWeight: 700, color: "var(--navy)", marginBottom: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <TrendingUp className="h-4 w-4" style={{ color: "var(--navy)" }} /> {t("seo.marketSection.taxTitle")}
                </div>
                <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.6 }}>{t("seo.marketSection.taxBody")}</p>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "var(--navy)", marginBottom: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <Shield className="h-4 w-4" style={{ color: "var(--navy)" }} /> {t("seo.marketSection.businessTitle")}
                </div>
                <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.6 }}>{t("seo.marketSection.businessBody")}</p>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "var(--navy)", marginBottom: 6, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <FileText className="h-4 w-4" style={{ color: "var(--navy)" }} /> {t("seo.marketSection.lexiconTitle")}
                </div>
                <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.6 }}>{t("seo.marketSection.lexiconBody")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Long-form (Phase 80: from the retired static bodies) ── */}
      <section className="sec" aria-label={deepDive.heading}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
            <h2 className="h2">{deepDive.heading}</h2>
          </div>
          <div className="prose blog-prose max-w-none">
            {deepDive.paragraphs.map((p, i) =>
              p.kind === "h3" ? (
                <h3 key={i}>{p.text}</h3>
              ) : p.kind === "benefits" ? (
                <p key={i}>
                  {benefits.map((b) => (
                    <span key={b.title}>
                      <strong>{b.title}.</strong> {b.desc}{" "}
                    </span>
                  ))}
                </p>
              ) : (
                <p key={i}>{p.text}</p>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section className="sec soft">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
            <h2 className="h2">{h2Faq}</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {faq.map((f) => (
              <div key={f.q} className="card" style={{ padding: 22 }}>
                <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>{f.q}</h3>
                <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.6 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quotes in major cities ─────────────────────────── */}
      {CITY_SECTORS.includes(slug) && TIER1_CITIES.length > 0 && (
        <section className="sec">
          <div className="wrap" style={{ maxWidth: 980 }}>
            <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
              <h2 className="h2" style={{ fontSize: 26 }}>
                {t("seo.cityHub.heading").replace("{trade}", labelPlural)}
              </h2>
              <p className="lead" style={{ margin: "0 auto" }}>{t("seo.cityHub.subtitle")}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {TIER1_CITIES.map((city) => (
                <Link
                  key={city.slug}
                  href={`${base}/${sSlugForLang}/${city.slug}/`}
                  className="card"
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}
                >
                  <MapPin className="h-4 w-4 shrink-0" style={{ color: "var(--navy)" }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{city.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── All cities (internal links for indexing) ──────── */}
      {CITY_SECTORS.includes(slug) && (
        <section className="sec soft">
          <div className="wrap" style={{ maxWidth: 1080 }}>
            <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
              <h2 className="h2" style={{ fontSize: 22 }}>
                {t("seo.allCities.heading").replace("{trade}", labelPlural)}
              </h2>
              <p className="lead" style={{ margin: "0 auto" }}>{t("seo.allCities.subtitle")}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {REGION_NAMES_SORTED.map((region) => (
                <div key={region}>
                  <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--navy)", marginBottom: 10 }}>
                    {region}
                  </h3>
                  <div className="blog-links" style={{ flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                    {CITIES_BY_REGION[region].map((city) => (
                      <Link
                        key={city.slug}
                        href={`${base}/${sSlugForLang}/${city.slug}/`}
                        style={{ fontSize: 14, color: "var(--muted-mk)" }}
                      >
                        {label} {city.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {RELATED_SECTORS[slug] && (
        <section className="sec">
          <div className="wrap" style={{ maxWidth: 980 }}>
            <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
              <h2 className="h2" style={{ fontSize: 24 }}>{t("seo.seeAlso.heading")}</h2>
              <p className="lead" style={{ margin: "0 auto" }}>{t("seo.seeAlso.subtitle")}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {RELATED_SECTORS[slug].map((r) => (
                <Link
                  key={r.slug}
                  href={`${base}/${isFr ? (SECTORS[r.slug]?.frSlug ?? r.slug) : r.slug}/`}
                  className="card"
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}
                >
                  <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "var(--navy)" }} />
                  {t("seo.quotesForLink")} {isFr ? (SECTORS[r.slug]?.fr.label ?? r.label) : r.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Insights ─────────────────────────────────────── */}
      {SECTOR_ARTICLES[slug] && SECTOR_ARTICLES[slug].length > 0 && (() => {
        const articles = SECTOR_ARTICLES[slug]
          .map((articleSlug) => BLOG_INDEX.find((a) => a.slug === articleSlug))
          .filter((a): a is (typeof BLOG_INDEX)[number] => a !== undefined);
        if (articles.length === 0) return null;
        return (
          <section className="sec soft">
            <div className="wrap" style={{ maxWidth: 1080 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                <span className="fi g"><BookOpen className="h-4 w-4" /></span>
                <div>
                  <h2 className="h2" style={{ fontSize: 22 }}>{t("seo.insights.heading")}</h2>
                  <p style={{ fontSize: 13.5, color: "var(--muted-mk)", marginTop: 2 }}>{t("seo.insights.subtitlePrefix")} {h1Highlight.toLowerCase()}</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {articles.map((a) => (
                  <Link key={a.slug} href={`/blog/${a.slug}/`} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                    <span className="chip chip-teal" style={{ alignSelf: "flex-start" }}>{a.category}</span>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--navy)", lineHeight: 1.4 }}>{a.title}</span>
                    <span style={{ fontSize: 12.5, color: "var(--faint)", marginTop: "auto" }}>{a.readingTimeMin} {t("blog.readingTimeSuffix")}</span>
                  </Link>
                ))}
              </div>
              <div style={{ textAlign: "center", marginTop: 28 }}>
                <Link href="/blog/" className="cta-link" style={{ display: "inline-flex" }}>
                  {t("seo.insights.viewAll")}
                  <ArrowRight className="chev h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="cta on-dark">
        <div className="cta-bg">
          <img src={`https://picsum.photos/seed/quoteai-seo-${s.slug}/1800/900`} alt="" aria-hidden="true" loading="lazy" />
        </div>
        <div className="wrap cta-in">
          <span className="eyebrow on-dark" style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <Clock className="h-3.5 w-3.5" />
            {t("seo.finalCta.badge")}
          </span>
          <h2>
            {t("seo.finalCta.headingPrefix")}{" "}
            <em style={{ fontStyle: "normal", color: "#8ef07f" }}>{t("seo.finalCta.headingHighlight")}</em>?
          </h2>
          <p>{t("seo.finalCta.bodyPrefix")} {h1Highlight.toLowerCase()} {t("seo.finalCta.bodySuffix")}</p>
          <div className="cta-actions">
            <Link href="/sign-up/" className="btn btn-white">
              {t("blog.ctaButton")}
              <ArrowRight className="chev h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
