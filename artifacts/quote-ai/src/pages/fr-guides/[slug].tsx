// French-only guides for Québec contractors: /fr/guides/:slug.
// Content and sources in data/fr-guides.ts.
import { Link, useParams, useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { FaqList } from "@/components/faq-list";
import { useAuth } from "@/hooks/use-auth";
import { breadcrumbJsonLd, faqJsonLd, BASE_URL } from "@/data/json-ld";
import { FR_GUIDES, FR_GUIDES_HUB as UI } from "@/data/fr-guides";
import NotFound from "@/pages/not-found";

export const frDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export default function FrGuidePage() {
  const params = useParams<{ slug: string }>();
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const g = FR_GUIDES.find((x) => x.slug === params.slug);
  if (!g) return <NotFound bare />;
  const path = `/fr/guides/${g.slug}/`;

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={g.title}
        description={g.description}
        canonical={`${BASE_URL}${path}`}
        lang="fr-CA"
        ogType="article"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: g.h1.replace(/\.$/, ""),
            description: g.description,
            inLanguage: "fr-CA",
            url: `${BASE_URL}${path}`,
            datePublished: g.updatedAt,
            dateModified: g.updatedAt,
            author: { "@id": `${BASE_URL}/#org` },
            publisher: { "@id": `${BASE_URL}/#org` },
            citation: g.sources.map((s) => s.url),
          },
          breadcrumbJsonLd([
            { name: "Accueil", path: "/fr/" },
            { name: UI.eyebrow, path: "/fr/guides/" },
            { name: g.h1.replace(/\.$/, ""), path },
          ]),
          faqJsonLd([...g.faq]),
        ]}
      />

      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ paddingBlock: "clamp(64px, 8vw, 110px)" }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 22 }}>{UI.eyebrow}</p>
          <h1>{g.h1}</h1>
          <p className="lead">{g.lead}</p>
          <p className="hero-note">{UI.updated} {frDate(g.updatedAt)}</p>
        </div>
      </section>

      <article className="sec" id="guide">
        <div className="wrap tool-prose">
          {g.blocks.map((b) => (
            <section key={b.h2} className="tool-block">
              <h2 className="h2 tool-h2">{b.h2}</h2>
              {b.paragraphs?.map((p) => <p key={p}>{p}</p>)}
              {b.list && (
                <ul className="guide-list">
                  {b.list.map((li) => <li key={li}>{li}</li>)}
                </ul>
              )}
              {b.example && (
                <div className="doc-mock guide-example">
                  <div className="dm-bar"><b>{b.example.title}</b></div>
                  <div className="dm-body">
                    {b.example.rows.map(([k, v], i) => (
                      i === b.example!.rows.length - 1
                        ? <div key={k} className="dm-tot"><div className="dm-grand"><span>{k}</span><b>{v}</b></div></div>
                        : <div key={k} className="dm-row"><span>{k}</span><span className="v">{v}</span></div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}

          <section className="tool-block">
            <h2 className="h2 tool-h2">{UI.sourcesTitle}</h2>
            <ul className="guide-list">
              {g.sources.map((s) => (
                <li key={s.url}><a href={s.url} target="_blank" rel="noopener">{s.label}</a></li>
              ))}
            </ul>
            <p className="prov-fine">{UI.disclaimer}</p>
          </section>
        </div>
      </article>

      <section className="sec soft" id="faq">
        <div className="wrap">
          <div className="sec-head"><div><h2 className="h2">{UI.faqTitle}</h2></div></div>
          <FaqList items={g.faq} />
        </div>
      </section>

      <section className="sec" id="more">
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 20 }}>
            <div><h2 className="h2">{UI.relatedTitle}</h2></div>
            <Link href="/fr/guides/" className="cta-link">{UI.all} <ArrowRight className="chev h-4 w-4" /></Link>
          </div>
          <div className="also" style={{ marginTop: 0 }}>
            {g.related.map((r) => <Link key={r.href} href={r.href} className="wm">{r.label}</Link>)}
            {FR_GUIDES.filter((x) => x.slug !== g.slug && !g.related.some((r) => r.href.includes(x.slug))).map((x) => (
              <Link key={x.slug} href={`/fr/guides/${x.slug}/`} className="wm">{x.h1.replace(/\.$/, "")}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="sec soft" id="cta">
        <div className="wrap tool-cta">
          <h2 className="h2">{UI.ctaTitle}</h2>
          <p className="lead">{UI.ctaBody}</p>
          <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-navy">{UI.ctaButton}</button>
          <p className="prov-fine">{UI.ctaNote}</p>
        </div>
      </section>
    </div>
  );
}
