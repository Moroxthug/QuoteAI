// Phase 81 — one landing page per pilot province (/provinces/:slug,
// /fr/provinces/:slug), for British Columbia, Ontario and Québec.
//
// A contractor's first question about quoting software is never "what does
// the AI do" — it is "does it get my province's tax right". So the page
// leads with the province's statutory tax lines, drawn from the same
// TAX_PROFILES table the quote, contract and invoice PDFs use, then lists
// what the product does about that province's paperwork, then the cities and
// trades that already have their own pages.

import { Link, useParams, useLocation } from "wouter";
import { ArrowRight, Check, MapPin, Receipt, Languages, FileSignature } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { useAuth } from "@/hooks/use-auth";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { useLanguage } from "@/i18n/LanguageContext";
import { breadcrumbJsonLd, webPageJsonLd } from "@/data/json-ld";
import { CITIES_BY_SLUG, cityDisplayName } from "@/data/seo-data";
import { SECTOR_SLUGS, sectorLabel } from "@/data/seo-slugs";
import { taxComponentLabel, formatRate } from "@/lib/tax-profiles";
import {
  PROVINCE_BY_SLUG,
  PILOT_PROVINCES,
  provincePath,
  provinceName,
  provinceTaxComponents,
  provinceTotalRate,
} from "@/data/province-data";
import NotFound from "@/pages/not-found";

/** The trades whose sector pages a province page links to — the eight with the most search demand. */
const FEATURED_TRADES = [
  "general-contractor", "renovation-contractor", "electrician", "plumber",
  "painter", "roofer", "carpenter-cabinetmaker", "landscaper",
];

function ScrollSection({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useScrollFade();
  return (
    <section id={id} ref={ref as React.RefObject<HTMLElement>} className={`fade-in-section ${className}`}>
      {children}
    </section>
  );
}

export default function ProvinceLandingPage() {
  const params = useParams<{ slug: string }>();
  const { isSignedIn } = useAuth();
  const { t, lang } = useLanguage();
  const [, navigate] = useLocation();

  const province = PROVINCE_BY_SLUG[params.slug ?? ""];
  if (!province) return <NotFound />;

  const name = provinceName(province, lang);
  const components = provinceTaxComponents(province);
  const totalRate = provinceTotalRate(province);
  const canonical = `https://quoteai.ca${provincePath(province, lang)}`;
  const altCanonical = `https://quoteai.ca${provincePath(province, lang === "fr" ? "en" : "fr")}`;
  const title = t("province.seoTitle").replace("{province}", name);
  const description = t("province.seoDescription")
    .replace("{province}", name)
    .replace("{tax}", components.map((c) => `${taxComponentLabel(c, lang)} ${formatRate(c.rate, lang)} %`).join(" + "));

  // One formatter for the whole mock, so the subtotal is not "$10,000.00"
  // next to a French "997,50 $".
  const cad = (n: number) => new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(n);

  const sectorHref = (slug: string) =>
    lang === "fr" ? `/fr/soumissions/${SECTOR_SLUGS[slug]!.frSlug}/` : `/quotes/${slug}/`;
  const cityHref = (sector: string, city: string) =>
    lang === "fr" ? `/fr/soumissions/${SECTOR_SLUGS[sector]!.frSlug}/${city}/` : `/quotes/${sector}/${city}/`;

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={title}
        description={description}
        canonical={canonical}
        altCanonical={altCanonical}
        lang={lang === "fr" ? "fr-CA" : "en-CA"}
        jsonLd={[
          webPageJsonLd(title, description, provincePath(province, lang), "WebPage", lang),
          breadcrumbJsonLd([
            { name: lang === "fr" ? "Accueil" : "Home", path: lang === "fr" ? "/fr/" : "/" },
            { name: name, path: provincePath(province, lang) },
          ]),
        ]}
      />

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="hero on-dark" id="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow on-dark" style={{ marginBottom: 22 }}>{t("province.eyebrow")}</p>
            <h1>{t("province.h1").replace("{province}", name)}</h1>
            <p className="lead">{province.intro[lang]}</p>
            <div className="hero-cta">
              <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-white">
                {t("province.startFree")}
              </button>
              <Link href={lang === "fr" ? "/fr/tarifs/" : "/pricing/"} className="btn btn-outline-light">
                {t("province.seePricing")}
              </Link>
            </div>
            <p className="hero-note">{t("province.heroNote")}</p>
          </div>
          <div>
            <div className="doc-mock">
              <div className="dm-bar">
                <b>{t("province.mockTitle")}</b>
                <span className="chip chip-grey">{province.defaultDocumentLang === "fr" ? "FR" : "EN"}</span>
              </div>
              <div className="dm-body">
                <div className="dm-row"><span>{t("province.mockSubtotal")}</span><span className="v">{cad(10000)}</span></div>
                <div className="dm-tot">
                  {components.map((c) => (
                    <div key={c.code} className="dm-row">
                      <span>{taxComponentLabel(c, lang)} ({formatRate(c.rate, lang)} %)</span>
                      <span className="v">{cad(c.rate * 100)}</span>
                    </div>
                  ))}
                  <div className="dm-grand">
                    <span>{t("province.mockTotal")}</span>
                    <b>{cad(10000 + totalRate * 100)}</b>
                  </div>
                </div>
              </div>
              <div className="dm-chips">
                <span className="chip chip-green">{t("province.chipTax").replace("{rate}", formatRate(totalRate, lang))}</span>
                <span className="chip chip-teal">{t("province.chipDocs")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT THE PRODUCT DOES HERE ─────────────────────── */}
      <ScrollSection className="sec" id="how">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow">{t("province.howEyebrow")}</span>
              <h2 className="h2">{t("province.howTitle").replace("{province}", name)}</h2>
            </div>
            <p className="lead">{t("province.howBody")}</p>
          </div>
          <div className="dd-grid">
            <div className="dd-feats">
              <div className="dd-feat">
                <span className="fi g"><Receipt className="h-5 w-5" /></span>
                <div>
                  <b>{t("province.featTax")}</b>
                  <p>{components.map((c) => `${taxComponentLabel(c, lang)} ${formatRate(c.rate, lang)} %`).join(" + ")}</p>
                </div>
              </div>
              <div className="dd-feat">
                <span className="fi t"><Languages className="h-5 w-5" /></span>
                <div>
                  <b>{t("province.featLang")}</b>
                  <p>{province.defaultDocumentLang === "fr" ? t("province.featLangFr") : t("province.featLangEn")}</p>
                </div>
              </div>
              {province.licenceField && (
                <div className="dd-feat">
                  <span className="fi p"><FileSignature className="h-5 w-5" /></span>
                  <div>
                    <b>{t("province.featLicence")}</b>
                    <p>{province.licenceField[lang]}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="card dd-card">
              <h3>{t("province.notesTitle")}</h3>
              <ul className="prov-notes">
                {province.productNotes.map((note) => (
                  <li key={note.en}>
                    <Check className="h-4 w-4 shrink-0" />
                    <span>{note[lang]}</span>
                  </li>
                ))}
              </ul>
              <p className="prov-fine">{t("province.legalDisclaimer")}</p>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── CITIES ─────────────────────────────────────────── */}
      <ScrollSection className="sec soft" id="cities">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">{t("province.citiesEyebrow")}</span>
              <h2 className="h2">{t("province.citiesTitle").replace("{province}", name)}</h2>
            </div>
            <p className="lead">{t("province.citiesBody")}</p>
          </div>
          <div className="news-grid">
            {province.citySlugs.map((citySlug) => {
              const city = CITIES_BY_SLUG[citySlug];
              if (!city) return null;
              return (
                <div key={citySlug} className="card dd-card">
                  <div className="price-name" style={{ marginBottom: 10 }}>
                    <MapPin className="h-4 w-4" />
                    <h3>{cityDisplayName(city, lang)}</h3>
                  </div>
                  <div className="also" style={{ marginTop: 0 }}>
                    {FEATURED_TRADES.slice(0, 4).map((trade) => (
                      <Link key={trade} href={cityHref(trade, citySlug)} className="chip chip-grey">
                        {sectorLabel(trade, lang)}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollSection>

      {/* ── TRADES ─────────────────────────────────────────── */}
      <ScrollSection className="sec" id="trades">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">{t("province.tradesEyebrow")}</span>
              <h2 className="h2">{t("province.tradesTitle")}</h2>
            </div>
            <Link href={lang === "fr" ? "/fr#trades" : "/#trades"} className="cta-link">
              {t("province.allTrades")} <ArrowRight className="chev h-4 w-4" />
            </Link>
          </div>
          <div className="also" style={{ marginTop: 0 }}>
            {FEATURED_TRADES.map((trade) => (
              <Link key={trade} href={sectorHref(trade)} className="wm">{sectorLabel(trade, lang)}</Link>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── OTHER PILOT PROVINCES ──────────────────────────── */}
      <ScrollSection className="sec soft" id="other-provinces">
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 20 }}>
            <div>
              <span className="eyebrow grey">{t("province.otherEyebrow")}</span>
              <h2 className="h2">{t("province.otherTitle")}</h2>
            </div>
          </div>
          <div className="also" style={{ marginTop: 0 }}>
            {PILOT_PROVINCES.filter((p) => p.code !== province.code).map((p) => (
              <Link key={p.code} href={provincePath(p, lang)} className="wm">{provinceName(p, lang)}</Link>
            ))}
            <Link href={lang === "fr" ? "/fr/pilote/" : "/pilot/"} className="wm">{t("province.pilotLink")}</Link>
          </div>
        </div>
      </ScrollSection>
    </div>
  );
}
