// French guides hub: /fr/guides.
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { breadcrumbJsonLd, webPageJsonLd, BASE_URL } from "@/data/json-ld";
import { FR_GUIDES, FR_GUIDES_HUB as UI } from "@/data/fr-guides";

export default function FrGuidesIndexPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={UI.title}
        description={UI.description}
        canonical={`${BASE_URL}/fr/guides/`}
        lang="fr-CA"
        jsonLd={[
          webPageJsonLd(UI.title, UI.description, "/fr/guides/", "CollectionPage", "fr"),
          breadcrumbJsonLd([
            { name: "Accueil", path: "/fr/" },
            { name: UI.eyebrow, path: "/fr/guides/" },
          ]),
        ]}
      />

      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ paddingBlock: "clamp(64px, 8vw, 110px)" }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 22 }}>{UI.eyebrow}</p>
          <h1>{UI.h1}</h1>
          <p className="lead">{UI.lead}</p>
        </div>
      </section>

      <section className="sec soft" id="guides">
        <div className="wrap">
          <div className="news-grid">
            {FR_GUIDES.map((g) => (
              <Link key={g.slug} href={`/fr/guides/${g.slug}/`} className="card dd-card tool-tile">
                <h2>{g.h1.replace(/\.$/, "")}</h2>
                <p>{g.short}</p>
                <span className="cta-link">{UI.read} <ArrowRight className="chev h-4 w-4" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
