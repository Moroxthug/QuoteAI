// Free calculators hub: /tools and /fr/outils.
import { Link } from "wouter";
import { ArrowRight, Receipt, Landmark, Percent, Clock } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { useLanguage } from "@/i18n/LanguageContext";
import { breadcrumbJsonLd, webPageJsonLd, BASE_URL } from "@/data/json-ld";
import { toolPath, type ToolId } from "@/data/seo-slugs";
import { TOOL_PAGES, TOOL_ORDER, TOOL_UI, TOOLS_HUB } from "@/data/tool-pages";

const ICONS: Record<ToolId, typeof Receipt> = { salesTax: Receipt, holdback: Landmark, markup: Percent, labourRate: Clock };
const TONES: Record<ToolId, string> = { salesTax: "g", holdback: "t", markup: "p", labourRate: "g" };

export default function ToolsIndexPage() {
  const { lang } = useLanguage();
  const path = toolPath(lang);
  const title = TOOLS_HUB.title[lang];
  const description = TOOLS_HUB.description[lang];
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={title}
        description={description}
        canonical={`${BASE_URL}${path}`}
        altCanonical={`${BASE_URL}${toolPath(lang === "fr" ? "en" : "fr")}`}
        lang={lang === "fr" ? "fr-CA" : "en-CA"}
        jsonLd={[
          webPageJsonLd(title, description, path, "CollectionPage", lang),
          breadcrumbJsonLd([
            { name: lang === "fr" ? "Accueil" : "Home", path: lang === "fr" ? "/fr/" : "/" },
            { name: TOOLS_HUB.eyebrow[lang], path },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: TOOL_ORDER.map((id, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: TOOL_PAGES[id].h1[lang].replace(/[.?]$/, ""),
              url: `${BASE_URL}${toolPath(lang, id)}`,
            })),
          },
        ]}
      />

      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ paddingBlock: "clamp(64px, 8vw, 110px)" }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 22 }}>{TOOLS_HUB.eyebrow[lang]}</p>
          <h1>{TOOLS_HUB.h1[lang]}</h1>
          <p className="lead">{TOOLS_HUB.lead[lang]}</p>
        </div>
      </section>

      <section className="sec soft" id="tools">
        <div className="wrap">
          <div className="dd-grid tool-grid" style={{ marginTop: 0 }}>
            {TOOL_ORDER.map((id) => {
              const Icon = ICONS[id];
              const page = TOOL_PAGES[id];
              return (
                <Link key={id} href={toolPath(lang, id)} className="card dd-card tool-tile">
                  <span className={`fi ${TONES[id]}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <h2>{page.h1[lang].replace(/[.?]$/, "")}</h2>
                  <p>{page.short[lang]}</p>
                  <span className="cta-link">{TOOL_UI.openTool[lang]} <ArrowRight className="chev h-4 w-4" /></span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
