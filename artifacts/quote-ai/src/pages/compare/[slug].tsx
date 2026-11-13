// quoteai vs a competitor: /compare/:slug and /fr/comparer/:slug.
// Facts and copy in data/compare-pages.ts (read its header before editing).
import { Link, useParams, useLocation } from "wouter";
import { ArrowRight, Check } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { FaqList } from "@/components/faq-list";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { breadcrumbJsonLd, webPageJsonLd, faqJsonLd, BASE_URL } from "@/data/json-ld";
import { COMPARE_SLUG_PAIRS, comparePath } from "@/data/seo-slugs";
import { COMPETITORS, COMPARE_ORDER, COMPARE_UI, QUOTEAI_CELLS, ROWS, ROW_LABELS, CHECKED_AT } from "@/data/compare-pages";
import NotFound from "@/pages/not-found";

type Lang = "en" | "fr";

export function checkedDate(lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${CHECKED_AT}T00:00:00Z`));
}

export default function ComparePage() {
  const params = useParams<{ slug: string }>();
  const { lang } = useLanguage();
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const pair = COMPARE_SLUG_PAIRS.find((p) => p[lang] === params.slug);
  if (!pair) return <NotFound bare />;

  const c = COMPETITORS[pair.id];
  const fill = (s: string) => s.replaceAll("{name}", c.name).replaceAll("{date}", checkedDate(lang));
  const path = comparePath(lang, pair.id);
  const title = fill(COMPARE_UI.pageTitle[lang]);
  const description = fill(COMPARE_UI.pageDescription[lang]);
  const h1 = fill(COMPARE_UI.pageH1[lang]);
  const faq = c.faq.map((f) => ({ q: f.q[lang], a: f.a[lang] }));

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={title}
        description={description}
        canonical={`${BASE_URL}${path}`}
        altCanonical={`${BASE_URL}${comparePath(lang === "fr" ? "en" : "fr", pair.id)}`}
        lang={lang === "fr" ? "fr-CA" : "en-CA"}
        jsonLd={[
          { ...webPageJsonLd(title, description, path, "WebPage", lang), dateModified: CHECKED_AT },
          breadcrumbJsonLd([
            { name: lang === "fr" ? "Accueil" : "Home", path: lang === "fr" ? "/fr/" : "/" },
            { name: COMPARE_UI.hubEyebrow[lang], path: comparePath(lang) },
            { name: h1.replace(/\.$/, ""), path },
          ]),
          faqJsonLd(faq),
        ]}
      />

      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ paddingBlock: "clamp(64px, 8vw, 110px)" }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 22 }}>{fill(COMPARE_UI.pageEyebrow[lang])}</p>
          <h1>{h1}</h1>
          <p className="lead">{c.about[lang]}</p>
          <p className="hero-note">{fill(COMPARE_UI.checked[lang])}</p>
        </div>
      </section>

      <section className="sec" id="verdict">
        <div className="wrap">
          <div className="dd-grid" style={{ marginTop: 0 }}>
            <div className="card dd-card">
              <h2 className="cmp-h3">{fill(COMPARE_UI.chooseThem[lang])}</h2>
              <ul className="prov-notes">
                {c.chooseThem.map((x) => <li key={x.en}><Check className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{x[lang]}</span></li>)}
              </ul>
            </div>
            <div className="card dd-card">
              <h2 className="cmp-h3">{COMPARE_UI.chooseUs[lang]}</h2>
              <ul className="prov-notes">
                {c.chooseUs.map((x) => <li key={x.en}><Check className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{x[lang]}</span></li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="sec soft" id="table">
        <div className="wrap">
          <div className="sec-head"><div><h2 className="h2">{COMPARE_UI.tableTitle[lang]}</h2></div></div>
          <div className="card cmp-wrap" tabIndex={0}>
            <table className="cmp cmp-facts">
              <thead>
                <tr><th scope="col"><span className="sr-only">{lang === "fr" ? "Critère" : "Criterion"}</span></th><th scope="col" className="q">quoteai</th><th scope="col">{c.name}</th></tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r}><th scope="row">{ROW_LABELS[r][lang]}</th><td className="q">{QUOTEAI_CELLS[r][lang]}</td><td>{c.cells[r][lang]}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="prov-fine">
            <a href={c.pricingUrl} rel="nofollow noopener" target="_blank">{fill(COMPARE_UI.source[lang])}</a> · {fill(COMPARE_UI.checked[lang])}
          </p>
        </div>
      </section>

      <section className="sec" id="details">
        <div className="wrap tool-prose">
          {c.sections.map((s) => (
            <div key={s.h2.en} className="tool-block">
              <h2 className="h2 tool-h2">{s.h2[lang]}</h2>
              {s.body.map((p) => <p key={p.en}>{p[lang]}</p>)}
            </div>
          ))}
        </div>
      </section>

      <section className="sec soft" id="faq">
        <div className="wrap">
          <div className="sec-head"><div><h2 className="h2">{COMPARE_UI.faqTitle[lang]}</h2></div></div>
          <FaqList items={faq} />
        </div>
      </section>

      <section className="sec" id="more">
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 20 }}>
            <div><h2 className="h2">{COMPARE_UI.other[lang]}</h2></div>
            <Link href={comparePath(lang)} className="cta-link">{COMPARE_UI.all[lang]} <ArrowRight className="chev h-4 w-4" /></Link>
          </div>
          <div className="also" style={{ marginTop: 0 }}>
            {COMPARE_ORDER.filter((id) => id !== pair.id).map((id) => (
              <Link key={id} href={comparePath(lang, id)} className="wm">quoteai {lang === "fr" ? "ou" : "vs"} {COMPETITORS[id].name}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="sec soft" id="cta">
        <div className="wrap tool-cta">
          <h2 className="h2">{COMPARE_UI.ctaTitle[lang]}</h2>
          <p className="lead">{COMPARE_UI.ctaBody[lang]}</p>
          <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-navy">{COMPARE_UI.ctaButton[lang]}</button>
          <p className="prov-fine">{COMPARE_UI.ctaNote[lang]}</p>
          <p className="prov-fine">{COMPARE_UI.fine[lang]}</p>
        </div>
      </section>
    </div>
  );
}
