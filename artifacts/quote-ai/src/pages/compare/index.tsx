// Comparison hub: /compare and /fr/comparer. The four tools in one table.
import { Link, useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { breadcrumbJsonLd, webPageJsonLd, BASE_URL } from "@/data/json-ld";
import { comparePath } from "@/data/seo-slugs";
import { COMPETITORS, COMPARE_ORDER, COMPARE_UI, QUOTEAI_CELLS, ROWS, ROW_LABELS, CHECKED_AT } from "@/data/compare-pages";
import { checkedDate } from "./[slug]";

export default function CompareIndexPage() {
  const { lang } = useLanguage();
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const path = comparePath(lang);
  const title = COMPARE_UI.hubTitle[lang];
  const description = COMPARE_UI.hubDescription[lang];
  const fillDate = (s: string) => s.replaceAll("{date}", checkedDate(lang));

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={title}
        description={description}
        canonical={`${BASE_URL}${path}`}
        altCanonical={`${BASE_URL}${comparePath(lang === "fr" ? "en" : "fr")}`}
        lang={lang === "fr" ? "fr-CA" : "en-CA"}
        jsonLd={[
          { ...webPageJsonLd(title, description, path, "CollectionPage", lang), dateModified: CHECKED_AT },
          breadcrumbJsonLd([
            { name: lang === "fr" ? "Accueil" : "Home", path: lang === "fr" ? "/fr/" : "/" },
            { name: COMPARE_UI.hubEyebrow[lang], path },
          ]),
        ]}
      />

      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ paddingBlock: "clamp(64px, 8vw, 110px)" }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 22 }}>{COMPARE_UI.hubEyebrow[lang]}</p>
          <h1>{COMPARE_UI.hubH1[lang]}</h1>
          <p className="lead">{COMPARE_UI.hubLead[lang]}</p>
          <p className="hero-note">{fillDate(COMPARE_UI.checked[lang])}</p>
        </div>
      </section>

      <section className="sec soft" id="table">
        <div className="wrap">
          <div className="card cmp-wrap" tabIndex={0}>
            <table className="cmp cmp-facts cmp-wide">
              <caption className="sr-only">{COMPARE_UI.hubH1[lang]}</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">{lang === "fr" ? "Critère" : "Criterion"}</span></th>
                  <th scope="col" className="q">quoteai</th>
                  {COMPARE_ORDER.map((id) => <th key={id} scope="col">{COMPETITORS[id].name}</th>)}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r}>
                    <th scope="row">{ROW_LABELS[r][lang]}</th>
                    <td className="q">{QUOTEAI_CELLS[r][lang]}</td>
                    {COMPARE_ORDER.map((id) => <td key={id}>{COMPETITORS[id].cells[r][lang]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="prov-fine">
            {COMPARE_ORDER.map((id, i) => (
              <span key={id}>{i > 0 && " · "}<a href={COMPETITORS[id].pricingUrl} rel="nofollow noopener" target="_blank">{COMPARE_UI.source[lang].replace("{name}", COMPETITORS[id].name)}</a></span>
            ))}
          </p>
        </div>
      </section>

      <section className="sec" id="pages">
        <div className="wrap">
          <div className="news-grid">
            {COMPARE_ORDER.map((id) => {
              const c = COMPETITORS[id];
              return (
                <Link key={id} href={comparePath(lang, id)} className="card dd-card tool-tile">
                  <h2>quoteai {lang === "fr" ? "ou" : "vs"} {c.name}</h2>
                  <p>{c.about[lang]}</p>
                  <span className="cta-link">{COMPARE_UI.readFull[lang]} <ArrowRight className="chev h-4 w-4" /></span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="sec soft" id="cta">
        <div className="wrap tool-cta">
          <h2 className="h2">{COMPARE_UI.ctaTitle[lang]}</h2>
          <p className="lead">{COMPARE_UI.ctaBody[lang]}</p>
          <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-navy">{COMPARE_UI.ctaButton[lang]}</button>
          <p className="prov-fine">{COMPARE_UI.fine[lang]}</p>
        </div>
      </section>
    </div>
  );
}
