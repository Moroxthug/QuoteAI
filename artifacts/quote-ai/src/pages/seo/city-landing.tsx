import { useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { ArrowRight, CheckCircle2, MapPin, BarChart2, BookOpen } from "lucide-react";
import { SECTORS, DEFAULT_SECTOR, CITIES_BY_SLUG, SECTOR_KEY_BY_FR_SLUG, FRENCH_PRIMARY_CITY_SLUGS, getCityTitle, getCityDesc, localizeCity } from "@/data/seo-data";
import { BLOG_INDEX, SECTOR_ARTICLES } from "@/data/blog-index";
import {
  getCityIntro,
  getCityFaqItems,
  getCityHowItWorksSteps,
  getCityLayout,
  getCityCtaVariant,
  getCityCtaTexts,
  getNearbyAnchors,
  getOsservatorioData,
  getCityContextText,
  getCityCostCopy,
  getCityRelatedSectors,
  getSameCityOtherSectors,
  buildCityJsonLd,
  verifyCityContentInDev,
  getOgImagePath,
  getSectorFrContent,
  cityBasePath,
  type Lang as EngineLang,
} from "@/data/seo-render-engine";
import { SeoHead } from "@/components/seo-head";
import { isFrenchPath } from "@/i18n/LanguageContext";
import { useLanguage } from "@/i18n/LanguageContext";

const FI_COLORS = ["g", "t", "p"] as const;

export default function SeoCityLanding() {
  const { t } = useLanguage();
  const [pathname] = useLocation();
  const isFr = isFrenchPath(pathname);
  const engineLang: EngineLang = isFr ? "fr-CA" : "en-CA";
  const base = cityBasePath(engineLang);
  const params = useParams() as { type?: string; city?: string };
  const rawSlug = params.type ?? "";
  const sectorSlug = isFr ? (SECTOR_KEY_BY_FR_SLUG[rawSlug] ?? rawSlug) : rawSlug;
  const citySlug = params.city ?? "";

  const s = SECTORS[sectorSlug] ?? DEFAULT_SECTOR;
  const sSlugForLang = isFr ? s.frSlug : s.slug;
  // Phase 81: on a French page the city and province carry their French
  // names (Montréal, Québec, Colombie-Britannique) — everything downstream,
  // the render engine included, reads them from this one localized object.
  const rawCity = CITIES_BY_SLUG[citySlug];
  const city = rawCity ? localizeCity(rawCity, engineLang) : undefined;
  const cityName = city?.name ?? citySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const regionName = city?.region ?? "Canada";

  // City-page chrome (h1/benefits/useCases) reuses the sector's own
  // fields for English, and the generic French sector-page templates
  // for French (sector.fr only carries titleTag/metaDescription/useCases).
  const frSectorContent = isFr ? getSectorFrContent(s) : null;
  const h1 = frSectorContent?.h1 ?? s.h1;
  const h1Highlight = frSectorContent?.h1Highlight ?? s.h1Highlight;
  const benefits = frSectorContent?.benefits ?? s.benefits;
  const useCases = isFr ? s.fr.useCases : s.useCases;
  const sectorLabel = isFr ? s.fr.label : s.label;
  const sectorLabelPlural = isFr ? s.fr.labelPlural : s.labelPlural;

  const titleTag = getCityTitle(s, cityName, citySlug, engineLang);
  const metaDesc = getCityDesc(s, cityName, citySlug, regionName, engineLang);
  const canonical = `https://quoteai.ca${base}/${sSlugForLang}/${citySlug}/`;
  // French city pages only exist for the French-primary Québec cities (see
  // FRENCH_PRIMARY_CITY_SLUGS); the other cities are English-only and must
  // not advertise a fr-CA alternate that is never built.
  const hasFrenchTwin = FRENCH_PRIMARY_CITY_SLUGS.includes(citySlug);
  const altCanonical = isFr
    ? `https://quoteai.ca/quotes/${s.slug}/${citySlug}/`
    : hasFrenchTwin
      ? `https://quoteai.ca/fr/soumissions/${s.frSlug}/${citySlug}/`
      : undefined;

  const intro = city ? getCityIntro(s, city, engineLang) : "";
  const faqItems = city ? getCityFaqItems(s, city, engineLang) : [];
  const howItWorksSteps = getCityHowItWorksSteps(cityName, engineLang);
  const layout = city ? getCityLayout(s, city) : 0;
  const ctaVariant = city ? getCityCtaVariant(s, city) : 0;
  const cta = getCityCtaTexts(ctaVariant, cityName, engineLang);
  const nearbyAnchors = city ? getNearbyAnchors(s, city, engineLang) : [];
  const osservatorio = city ? getOsservatorioData(city.slug) : null;
  const contextText = city ? getCityContextText(city.slug, engineLang) : null;
  const cost = city ? getCityCostCopy(s, city, engineLang) : null;
  const relatedSectorKeys = getCityRelatedSectors(s.slug);
  const relatedSectors = relatedSectorKeys.map((r) => ({
    slug: r.slug,
    label: isFr ? (SECTORS[r.slug]?.fr.label ?? r.label) : r.label,
  }));
  const sameCityOtherSectors = city ? getSameCityOtherSectors(s.slug, city.slug, 6, engineLang) : [];
  const jsonLd = city ? buildCityJsonLd(s, city, engineLang) : [];

  useEffect(() => {
    if (city) {
      verifyCityContentInDev(s, city, {
        intro,
        faqAnswers: faqItems.map((f) => f.a),
        ctaButton: cta.button,
      });
    }
  }, [s, city, intro, faqItems, cta.button]);

  const sBenefits = (
    <section className="sec soft" key="benefits">
      <div className="wrap">
        <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
          <h2 className="h2">
            {t("seo.city.whyChooseHeading").replace("{trade}", sectorLabelPlural).replace("{city}", cityName)}
          </h2>
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
  );

  const sHowItWorks = (
    <section className="sec" key="howitworks">
      <div className="wrap" style={{ maxWidth: 960 }}>
        <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
          <h2 className="h2">
            {t("seo.city.howToHeading").replace("{city}", cityName)}
          </h2>
        </div>
        <div className="steps3">
          {howItWorksSteps.map((item) => (
            <div key={item.n} className="step">
              <span className="n">{item.n}</span>
              <b>{item.title}</b>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const sUseCases = (
    <section className={`sec ${layout === 2 ? "" : "soft"}`} key="usecases">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
          <h2 className="h2">
            {t("seo.city.useCasesHeading").replace("{city}", cityName)}
          </h2>
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
  );

  const sFaq = (
    <section className="sec soft" key="faq">
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
          <h2 className="h2">{t("seo.city.faqHeading")}</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {faqItems.map((f) => (
            <div key={f.q} className="card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>{f.q}</h3>
              <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.6 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const mainSections =
    layout === 0
      ? [sBenefits, sHowItWorks, sUseCases, sFaq]
      : layout === 1
        ? [sHowItWorks, sUseCases, sBenefits, sFaq]
        : [sUseCases, sBenefits, sHowItWorks, sFaq];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={titleTag}
        description={metaDesc}
        canonical={canonical}
        jsonLd={jsonLd}
        ogImage={getOgImagePath(s.slug)}
        lang={engineLang}
        altCanonical={altCanonical}
      />

      {/* ── Breadcrumb ───────────────────────────────────────── */}
      <div className="wrap">
        <nav aria-label={t("seo.city.breadcrumbAria")} className="crumbs">
          <Link href={isFr ? "/fr" : "/"}>{t("blog.breadcrumbHome")}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <Link href={`${base}/${sSlugForLang}/`}>{sectorLabel}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">{cityName}</span>
        </nav>
      </div>

      {/* ── Hero (lightweight — no per-page media, this route is the
          highest page count on the site: every trade × every city) ── */}
      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto", paddingBlock: "clamp(48px, 6vw, 84px)" }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 20, display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <MapPin className="h-3.5 w-3.5" />
            {regionName}
          </p>
          <h1 style={{ fontSize: "clamp(2rem, 3.6vw, 3rem)" }}>
            {h1} <em style={{ fontStyle: "normal", color: "#8ef07f" }}>{h1Highlight}</em>
            <br />
            <span style={{ color: "#c9cad6", fontSize: "0.6em", fontWeight: 700 }}>{t("seo.city.inCityConnector")} {cityName}</span>
          </h1>
          <p className="lead" style={{ margin: "16px auto 0" }}>{intro}</p>
          <div className="hero-cta" style={{ justifyContent: "center" }}>
            <a href="/sign-up/" className="btn btn-white">
              {t("seo.city.heroCta1")}
              <ArrowRight className="chev h-4 w-4" />
            </a>
            <a href={`${base}/${sSlugForLang}/`} className="btn btn-outline-light">
              {t("seo.city.heroCta2")}
            </a>
          </div>
          <p className="hero-note">{t("seo.city.heroCaption")}</p>
        </div>
      </section>

      {/* ── Price & demand observatory ────────────────────────── */}
      {osservatorio && (
        <section className="sec" style={{ paddingBlock: "clamp(28px, 3vw, 44px)" }} aria-label={`${t("seo.city.observatoryAria")} ${cityName}`}>
          <div className="wrap" style={{ maxWidth: 960 }}>
            <div className="card" style={{ padding: "clamp(22px, 3vw, 32px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
                <span className="fi t"><BarChart2 className="h-4 w-4" /></span>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>
                  {t("seo.city.observatoryHeading")} {cityName}
                </h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: 18 }}>
                <div className="card" style={{ padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--faint)", marginBottom: 4 }}>{t("seo.city.priceIndex")}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)" }}>{osservatorio.priceLabel}</div>
                  <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>{t("seo.city.vsNationalAvg")}</div>
                </div>
                <div className="card" style={{ padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--faint)", marginBottom: 4 }}>{t("seo.city.demand")}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>{osservatorio.demandLabel}</div>
                  <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>{regionName}</div>
                </div>
                <div className="card" style={{ padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--faint)", marginBottom: 4 }}>{t("seo.city.leadTime")}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>{osservatorio.avgLeadTime}</div>
                  <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>{t("seo.city.estimatedResponse")}</div>
                </div>
                <div className="card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--faint)", marginBottom: 8 }}>{t("seo.city.topServices")}</div>
                  <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {osservatorio.topServices.map((sv) => (
                      <li key={sv} style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--muted-mk)" }}>
                        <span style={{ color: "var(--navy)", fontWeight: 700 }} aria-hidden="true">›</span>
                        {sv}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.6, borderTop: "1px solid var(--soft-2)", paddingTop: 16 }}>
                {osservatorio.localInsight}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── Main sections (layout-variant order) ─────────────── */}
      {mainSections}

      {/* ── What it costs (Phase 80: from the retired static bodies) ── */}
      {cost && (
        <section className="sec" aria-label={cost.heading}>
          <div className="wrap" style={{ maxWidth: 760 }}>
            <div className="sec-head" style={{ display: "block", textAlign: "center" }}>
              <h2 className="h2" style={{ fontSize: 26 }}>{cost.heading}</h2>
              <p className="lead" style={{ margin: "0 auto" }}>{cost.subtitle}</p>
            </div>
            <div className="prose blog-prose max-w-none">
              {cost.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 18, textAlign: "center" }}>{cost.footnote}</p>
          </div>
        </section>
      )}

      {/* ── City context ─────────────────────────────────────── */}
      {contextText && (
        <section className="sec soft" style={{ paddingBlock: "clamp(28px, 3vw, 44px)" }}>
          <div className="wrap" style={{ maxWidth: 760 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span className="fi t" style={{ flexShrink: 0 }}><MapPin className="h-4 w-4" /></span>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 6 }}>
                  {t("seo.city.contextHeading").replace("{trade}", sectorLabel).replace("{city}", cityName)}
                </h2>
                <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.6 }}>{contextText}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Nearby cities ─────────────────────────────────────── */}
      {nearbyAnchors.length > 0 && (
        <section className="sec">
          <div className="wrap" style={{ maxWidth: 960 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--muted-mk)", marginBottom: 18, textAlign: "center" }}>
              {t("seo.city.nearbyHeading").replace("{trade}", sectorLabelPlural)}
            </h2>
            <div className="blog-links" style={{ justifyContent: "center" }}>
              {nearbyAnchors.map(({ slug, anchorText }) => (
                <a key={slug} href={`${base}/${sSlugForLang}/${slug}/`} className="blog-link-pill">
                  {anchorText}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Other services in the same city ───────────────────── */}
      {sameCityOtherSectors.length > 0 && (
        <section className="sec soft">
          <div className="wrap" style={{ maxWidth: 960 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--muted-mk)", marginBottom: 18, textAlign: "center" }}>
              {t("seo.city.otherServicesHeading").replace("{city}", cityName)}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sameCityOtherSectors.map((r) => (
                <a
                  key={r.slug}
                  href={`${base}/${isFr ? (SECTORS[r.slug]?.frSlug ?? r.slug) : r.slug}/${citySlug}/`}
                  className="card"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}
                >
                  <span style={{ color: "var(--navy)", fontWeight: 700 }} aria-hidden="true">→</span>
                  {r.label} {t("seo.city.inCityConnector")} {cityName}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Related sectors ───────────────────────────────────── */}
      {relatedSectors.length > 0 && (
        <section className="sec">
          <div className="wrap" style={{ maxWidth: 960 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--muted-mk)", marginBottom: 18, textAlign: "center" }}>
              {t("seo.city.relatedSectorsHeading")}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {relatedSectors.map((r) => (
                <a
                  key={r.slug}
                  href={`${base}/${isFr ? (SECTORS[r.slug]?.frSlug ?? r.slug) : r.slug}/`}
                  className="card"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}
                >
                  <span style={{ color: "var(--navy)", fontWeight: 700 }} aria-hidden="true">→</span>
                  {r.label}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Insights ───────────────────────────────────────────── */}
      {(() => {
        const slugs = SECTOR_ARTICLES[s.slug];
        if (!slugs || slugs.length === 0) return null;
        const articles = slugs
          .map((slug) => BLOG_INDEX.find((a) => a.slug === slug))
          .filter((a): a is (typeof BLOG_INDEX)[number] => a !== undefined)
          .slice(0, 3);
        if (articles.length === 0) return null;
        return (
          <section className="sec soft">
            <div className="wrap" style={{ maxWidth: 960 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="fi g"><BookOpen className="h-4 w-4" /></span>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>{t("seo.insights.heading")}</h2>
                </div>
                <Link href="/blog/" className="cta-link" style={{ fontSize: 13 }}>
                  {t("seo.city.viewAllArticles")}
                </Link>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                {articles.map((a) => (
                  <a key={a.slug} href={`/blog/${a.slug}/`} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                    <span className="chip chip-teal" style={{ alignSelf: "flex-start" }}>{a.category}</span>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--navy)", lineHeight: 1.4 }}>{a.title}</span>
                    <span style={{ fontSize: 12.5, color: "var(--faint)", marginTop: "auto" }}>{a.readingTimeMin} {t("blog.readingTimeSuffix")}</span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ── Final CTA ──────────────────────────────────────────── */}
      <section className="cta on-dark">
        <div className="wrap cta-in">
          <h2>
            {cta.headingPrefix}
            <em style={{ fontStyle: "normal", color: "#8ef07f" }}>{cta.headingGradient}</em>
          </h2>
          <p>{t("seo.city.finalCtaBody")}</p>
          <div className="cta-actions">
            <a href="/sign-up/" className="btn btn-white">
              {cta.button}
              <ArrowRight className="chev h-4 w-4" />
            </a>
          </div>
          <p className="cta-fine">{t("seo.city.finalCtaCaption")}</p>
        </div>
      </section>
    </div>
  );
}
