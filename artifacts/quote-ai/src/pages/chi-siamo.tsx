import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Link } from "wouter";
import { ArrowRight, Zap, Target, Heart, Users } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const VALUE_ICONS = [
  { Icon: Zap, cls: "g" },
  { Icon: Target, cls: "t" },
  { Icon: Users, cls: "p" },
] as const;

export default function ChiSiamoPage() {
  const { t } = useLanguage();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "QuoteAI",
      url: "https://quoteai.ca/",
      logo: "https://quoteai.ca/icon-192.png",
      description:
        "QuoteAI is the AI quoting software for Canadian tradespeople and independent professionals. Generate professional quotes in 30 seconds by describing the job in plain language.",
      foundingDate: "2026",
      foundingLocation: { "@type": "Place", name: "Canada" },
      contactPoint: {
        "@type": "ContactPoint",
        email: "info@quoteai.ca",
        contactType: "customer service",
        availableLanguage: ["en", "fr"],
      },
    },
  ];

  return (
    <PublicLayout>
      <SeoHead
        title={t("about.seoTitle")}
        description={t("about.seoDescription")}
        canonical="https://quoteai.ca/chi-siamo/"
        jsonLd={jsonLd}
      />

      {/* Header */}
      <header className="wrap" style={{ maxWidth: 780, padding: "clamp(48px, 7vw, 88px) 0 clamp(20px, 3vw, 32px)", textAlign: "center" }}>
        <p className="eyebrow" style={{ justifyContent: "center", display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <Heart className="h-3.5 w-3.5" style={{ color: "var(--green)" }} />
          {t("about.madeIn")}
        </p>
        <h1 className="h2" style={{ marginBottom: 16 }}>
          {t("about.heroTitlePrefix")} <span style={{ color: "var(--green)" }}>{t("about.heroTitleHighlight")}</span>
        </h1>
        <p className="lead" style={{ margin: "0 auto" }}>{t("about.heroBody")}</p>
      </header>

      {/* La storia */}
      <section className="sec soft">
        <div className="wrap" style={{ maxWidth: 700 }}>
          <h2 className="h2" style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", marginBottom: 20 }}>{t("about.storyTitle")}</h2>
          <div className="lead" style={{ maxWidth: "none", display: "flex", flexDirection: "column", gap: 16 }}>
            <p>{t("about.storyP1")}</p>
            <p>{t("about.storyP2")}</p>
            <p>{t("about.storyP3")}</p>
          </div>
        </div>
      </section>

      {/* I nostri valori */}
      <section className="sec">
        <div className="wrap" style={{ maxWidth: 960 }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <h2 className="h2" style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)" }}>{t("about.valuesTitle")}</h2>
            <p className="lead" style={{ margin: "12px auto 0" }}>{t("about.valuesSubtitle")}</p>
          </div>
          <div className="dd-feats" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { title: t("about.value1Title"), body: t("about.value1Body") },
              { title: t("about.value2Title"), body: t("about.value2Body") },
              { title: t("about.value3Title"), body: t("about.value3Body") },
            ].map((v, i) => {
              const { Icon, cls } = VALUE_ICONS[i];
              return (
                <div key={v.title} className="dd-feat">
                  <span className={`fi ${cls}`}><Icon className="h-5 w-5" /></span>
                  <div>
                    <b>{v.title}</b>
                    <p>{v.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Chi usiamo */}
      <section className="sec soft">
        <div className="wrap" style={{ maxWidth: 700 }}>
          <h2 className="h2" style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", marginBottom: 20 }}>{t("about.whoTitle")}</h2>
          <div className="lead" style={{ maxWidth: "none", display: "flex", flexDirection: "column", gap: 14 }}>
            <p>
              {t("about.whoP1Prefix")} <strong style={{ color: "var(--navy)" }}>{t("about.whoP1Strong")}</strong> {t("about.whoP1Suffix")}
            </p>
            <p>{t("about.whoP2")}</p>
            <p>{t("about.whoP3")}</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="sec" style={{ textAlign: "center" }}>
        <div className="wrap" style={{ maxWidth: 560 }}>
          <h2 className="h2" style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", marginBottom: 14 }}>{t("about.ctaTitle")}</h2>
          <p className="lead" style={{ margin: "0 auto 28px" }}>{t("about.ctaBody")}</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/sign-up/" className="btn btn-navy">
              {t("about.ctaStartFree")} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contatti/" className="btn btn-outline-navy">
              {t("about.ctaContactUs")}
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
