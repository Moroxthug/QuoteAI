// Free calculator pages: /tools/:slug and /fr/outils/:slug.
//
// Built to be linked to and cited: the calculator renders a worked example in
// the prerendered HTML, the rule behind each number is written out under it,
// and the sales-tax and markup pages carry a reference table. Copy lives in
// data/tool-pages.ts, arithmetic in lib/calculators.ts.
import { Link, useParams, useLocation } from "wouter";
import { ArrowRight, Calculator } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { FaqList } from "@/components/faq-list";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { breadcrumbJsonLd, webPageJsonLd, faqJsonLd, BASE_URL } from "@/data/json-ld";
import { TOOL_SLUG_PAIRS, toolPath, type ToolId } from "@/data/seo-slugs";
import { TOOL_PAGES, TOOL_ORDER, TOOL_UI, TOOLS_HUB } from "@/data/tool-pages";
import { CALCULATORS } from "@/components/tools/calculators";
import { CANADIAN_PROVINCES, PROVINCE_NAMES, TAX_PROFILES, taxComponentLabel, formatRate } from "@/lib/tax-profiles";
import { marginFromMarkup } from "@/lib/calculators";
import NotFound from "@/pages/not-found";

type Lang = "en" | "fr";

function RatesTable({ lang }: { lang: Lang }) {
  const sorted = [...CANADIAN_PROVINCES].sort((a, b) => PROVINCE_NAMES[a][lang].localeCompare(PROVINCE_NAMES[b][lang], lang === "fr" ? "fr-CA" : "en-CA"));
  return (
    <div className="card cmp-wrap" tabIndex={0}>
      <table className="cmp">
        <caption className="sr-only">{TOOL_UI.ratesTitle[lang]}</caption>
        <thead>
          <tr><th scope="col">{TOOL_UI.tableProvince[lang]}</th><th scope="col">{TOOL_UI.tableTaxes[lang]}</th><th scope="col">{TOOL_UI.tableTotalRate[lang]}</th></tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p}>
              <td>{PROVINCE_NAMES[p][lang]}</td>
              <td>{TAX_PROFILES[p].components.map((c) => `${taxComponentLabel(c, lang)} ${formatRate(c.rate, lang)} %`).join(" + ")}</td>
              <td>{formatRate(TAX_PROFILES[p].totalRate, lang)} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarginTable({ lang }: { lang: Lang }) {
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const pct = (n: number) => `${new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(n)} %`;
  const cad = (n: number) => new Intl.NumberFormat(loc, { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
  return (
    <div className="card cmp-wrap" tabIndex={0}>
      <table className="cmp">
        <caption className="sr-only">{TOOL_UI.marginTableTitle[lang]}</caption>
        <thead>
          <tr><th scope="col">{TOOL_UI.tableMarkup[lang]}</th><th scope="col">{TOOL_UI.tableMargin[lang]}</th><th scope="col">{TOOL_UI.tablePrice[lang]}</th></tr>
        </thead>
        <tbody>
          {[10, 15, 20, 25, 30, 35, 40, 50, 75, 100].map((m) => (
            <tr key={m}><td>{pct(m)}</td><td>{pct(marginFromMarkup(m))}</td><td>{cad(1000 * (1 + m / 100))}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TABLES: Partial<Record<ToolId, { title: keyof typeof TOOL_UI; Table: (p: { lang: Lang }) => React.JSX.Element }>> = {
  salesTax: { title: "ratesTitle", Table: RatesTable },
  markup: { title: "marginTableTitle", Table: MarginTable },
};

export default function ToolPage() {
  const params = useParams<{ slug: string }>();
  const { lang } = useLanguage();
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const pair = TOOL_SLUG_PAIRS.find((p) => p[lang] === params.slug);
  if (!pair) return <NotFound bare />;

  const page = TOOL_PAGES[pair.id];
  const Calc = CALCULATORS[pair.id];
  const path = toolPath(lang, pair.id);
  const other: Lang = lang === "fr" ? "en" : "fr";
  const title = page.title[lang];
  const description = page.description[lang];
  const updated = new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${page.updatedAt}T00:00:00Z`));
  const table = TABLES[pair.id];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={title}
        description={description}
        canonical={`${BASE_URL}${path}`}
        altCanonical={`${BASE_URL}${toolPath(other, pair.id)}`}
        lang={lang === "fr" ? "fr-CA" : "en-CA"}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: page.h1[lang].replace(/[.?]$/, ""),
            description,
            url: `${BASE_URL}${path}`,
            inLanguage: lang === "fr" ? "fr-CA" : "en-CA",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any (web browser)",
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
            publisher: { "@id": `${BASE_URL}/#org` },
            dateModified: page.updatedAt,
          },
          webPageJsonLd(title, description, path, "WebPage", lang),
          breadcrumbJsonLd([
            { name: lang === "fr" ? "Accueil" : "Home", path: lang === "fr" ? "/fr/" : "/" },
            { name: TOOLS_HUB.eyebrow[lang], path: toolPath(lang) },
            { name: page.h1[lang].replace(/[.?]$/, ""), path },
          ]),
          faqJsonLd(page.faq.map((f) => ({ q: f.q[lang], a: f.a[lang] }))),
        ]}
      />

      <section className="hero on-dark" id="hero">
        <div className="wrap hero-grid tool-hero">
          <div>
            <p className="eyebrow on-dark" style={{ marginBottom: 22 }}>{page.eyebrow[lang]}</p>
            <h1>{page.h1[lang]}</h1>
            <p className="lead">{page.lead[lang]}</p>
            <p className="hero-note">{TOOL_UI.updated[lang]} {updated}</p>
          </div>
          <div>
            <Calc lang={lang} title={page.eyebrow[lang]} />
          </div>
        </div>
      </section>

      <section className="sec" id="how">
        <div className="wrap tool-prose">
          {page.sections.map((s) => (
            <div key={s.h2.en} className="tool-block">
              <h2 className="h2 tool-h2">{s.h2[lang]}</h2>
              {s.body.map((p) => <p key={p.en}>{p[lang]}</p>)}
            </div>
          ))}
          <p className="prov-fine">{TOOL_UI.disclaimer[lang]}</p>
        </div>
      </section>

      {table && (
        <section className="sec soft" id="table">
          <div className="wrap">
            <div className="sec-head"><div><h2 className="h2">{TOOL_UI[table.title][lang]}</h2></div></div>
            <table.Table lang={lang} />
          </div>
        </section>
      )}

      <section className={`sec${table ? "" : " soft"}`} id="faq">
        <div className="wrap">
          <div className="sec-head"><div><h2 className="h2">{TOOL_UI.faqTitle[lang]}</h2></div></div>
          <FaqList items={page.faq.map((f) => ({ q: f.q[lang], a: f.a[lang] }))} />
        </div>
      </section>

      <section className="sec soft" id="more">
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 20 }}>
            <div><h2 className="h2">{TOOL_UI.moreTools[lang]}</h2></div>
            <Link href={toolPath(lang)} className="cta-link">{TOOL_UI.allTools[lang]} <ArrowRight className="chev h-4 w-4" /></Link>
          </div>
          <div className="also" style={{ marginTop: 0 }}>
            {TOOL_ORDER.filter((id) => id !== pair.id).map((id) => (
              <Link key={id} href={toolPath(lang, id)} className="wm">
                <Calculator className="h-4 w-4 inline" aria-hidden="true" style={{ marginRight: 8, verticalAlign: -3 }} />
                {TOOL_PAGES[id].h1[lang].replace(/[.?]$/, "")}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" id="cta">
        <div className="wrap tool-cta">
          <h2 className="h2">{TOOL_UI.ctaTitle[lang]}</h2>
          <p className="lead">{TOOL_UI.ctaBody[lang]}</p>
          <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-navy">{TOOL_UI.ctaButton[lang]}</button>
          <p className="prov-fine">{TOOL_UI.ctaNote[lang]}</p>
        </div>
      </section>
    </div>
  );
}
