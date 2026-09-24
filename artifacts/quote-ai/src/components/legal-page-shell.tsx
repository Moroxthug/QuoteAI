// Phase 95 — the frame shared by the legal pages in both languages
// (/privacy-policy + /fr/confidentialite, /terms + /fr/conditions): SEO head
// with hreflang both ways, breadcrumb, title, last-updated line and the prose
// column. The pages themselves only carry their sections.
import { Link } from "wouter";
import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";
import { breadcrumbJsonLd, webPageJsonLd } from "@/data/json-ld";

type Lang = "en" | "fr";

export function LegalPageShell({
  lang,
  title,
  description,
  updated,
  path,
  altPath,
  children,
}: {
  lang: Lang;
  title: string;
  description: string;
  /** Already written out in the page's language ("September 21, 2026" / "21 septembre 2026"). */
  updated: string;
  /** This page's path with its trailing slash, e.g. "/fr/confidentialite/". */
  path: string;
  /** The other language's path. */
  altPath: string;
  children: React.ReactNode;
}) {
  const home = lang === "fr" ? { name: "Accueil", path: "/fr/" } : { name: "Home", path: "/" };
  return (
    <PublicLayout>
      <SeoHead
        title={`${title} | QuoteAI`}
        description={description}
        canonical={`https://quoteai.ca${path}`}
        altCanonical={`https://quoteai.ca${altPath}`}
        lang={lang === "fr" ? "fr-CA" : "en-CA"}
        jsonLd={[webPageJsonLd(title, description, path, "WebPage", lang), breadcrumbJsonLd([home, { name: title, path }])]}
      />
      <div className="wrap">
        <nav aria-label={lang === "fr" ? "Fil d'Ariane" : "Breadcrumb"} className="crumbs">
          <Link href={home.path}>{home.name}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">{title}</span>
        </nav>
      </div>

      <header className="wrap" style={{ maxWidth: 780, paddingTop: "clamp(12px, 2vw, 24px)", paddingBottom: "clamp(24px, 3vw, 36px)" }}>
        <h1 style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.5rem)", fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)", lineHeight: 1.15, marginBottom: 10 }}>
          {title}
        </h1>
        <p style={{ fontSize: 13, color: "var(--faint)" }}>
          {lang === "fr" ? "Dernière mise à jour : " : "Last updated: "}
          {updated}
        </p>
      </header>

      <div className="wrap" style={{ maxWidth: 780, paddingBottom: "clamp(48px, 6vw, 80px)" }}>
        <div className="prose blog-prose max-w-none space-y-8 text-sm leading-relaxed">{children}</div>
      </div>
    </PublicLayout>
  );
}

/** Section heading, same style in every legal page. */
export function LegalH2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-gray-900 mb-3">{children}</h2>;
}

export function Mail({ to }: { to: string }) {
  return <a href={`mailto:${to}`} className="text-navy-600 hover:underline">{to}</a>;
}
