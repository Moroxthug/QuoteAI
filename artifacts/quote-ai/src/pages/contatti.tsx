import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Mail, MessageCircle, FileText, Clock, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/i18n/LanguageContext";

export default function ContattiPage() {
  const { t } = useLanguage();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: "QuoteAI Contact",
      url: "https://quoteai.ca/contatti/",
      description: "Contact the QuoteAI team for support, product questions, or sales information.",
      mainEntity: {
        "@type": "Organization",
        name: "QuoteAI",
        url: "https://quoteai.ca/",
        email: "info@quoteai.ca",
        contactPoint: [
          {
            "@type": "ContactPoint",
            email: "info@quoteai.ca",
            contactType: "customer support",
            availableLanguage: ["en", "fr"],
          },
          {
            "@type": "ContactPoint",
            email: "privacy@quoteai.ca",
            contactType: "privacy inquiries",
            availableLanguage: ["en", "fr"],
          },
        ],
      },
    },
  ];

  const faqs = [
    { q: t("contact.faq1Q"), a: t("contact.faq1A") },
    { q: t("contact.faq2Q"), a: t("contact.faq2A") },
    { q: t("contact.faq3Q"), a: t("contact.faq3A") },
    { q: t("contact.faq4Q"), a: t("contact.faq4A") },
  ];

  return (
    <PublicLayout>
      <SeoHead
        title={t("contact.seoTitle")}
        description={t("contact.seoDescription")}
        canonical="https://quoteai.ca/contatti/"
        jsonLd={jsonLd}
      />

      {/* Header */}
      <header className="wrap" style={{ maxWidth: 700, paddingTop: "clamp(48px, 7vw, 88px)", paddingBottom: "clamp(20px, 3vw, 32px)", textAlign: "center" }}>
        <h1 className="h2" style={{ marginBottom: 16 }}>
          {t("contact.heroTitlePrefix")} <span style={{ color: "var(--green)" }}>{t("contact.heroTitleHighlight")}</span>
        </h1>
        <p className="lead" style={{ margin: "0 auto" }}>{t("contact.heroBody")}</p>
      </header>

      {/* Canali di contatto */}
      <section className="sec soft">
        <div className="wrap" style={{ maxWidth: 900 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {/* Email supporto */}
            <div className="card" style={{ padding: 28 }}>
              <span className="fi p" style={{ marginBottom: 16 }}><Mail className="h-5 w-5" /></span>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>{t("contact.productSupportTitle")}</h2>
              <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.6, marginBottom: 16 }}>
                {t("contact.productSupportBody")}
              </p>
              <a href="mailto:info@quoteai.ca" className="cta-link" style={{ fontSize: 14 }}>
                info@quoteai.ca <ArrowRight className="chev h-3.5 w-3.5" />
              </a>
            </div>

            {/* WhatsApp */}
            <div className="card" style={{ padding: 28 }}>
              <span className="fi g" style={{ marginBottom: 16 }}><MessageCircle className="h-5 w-5" /></span>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>WhatsApp</h2>
              <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.6, marginBottom: 16 }}>
                {t("contact.whatsappBody")}
              </p>
              <Link href="/whatsapp/" className="cta-link" style={{ fontSize: 14 }}>
                {t("contact.whatsappLink")} <ArrowRight className="chev h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Privacy / legale */}
            <div className="card" style={{ padding: 28 }}>
              <span className="fi t" style={{ marginBottom: 16 }}><FileText className="h-5 w-5" /></span>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>{t("contact.privacyLegalTitle")}</h2>
              <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.6, marginBottom: 16 }}>
                {t("contact.privacyLegalBody")}
              </p>
              <a href="mailto:privacy@quoteai.ca" className="cta-link" style={{ fontSize: 14 }}>
                privacy@quoteai.ca <ArrowRight className="chev h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Tempi di risposta */}
      <section className="sec" style={{ paddingBlock: "clamp(24px, 3vw, 40px)" }}>
        <div className="wrap" style={{ maxWidth: 700 }}>
          <div className="dd-feat">
            <span className="fi p"><Clock className="h-5 w-5" /></span>
            <div>
              <b>{t("contact.responseTimeTitle")}</b>
              <p>
                {t("contact.responseTimeBodyPrefix")} <strong style={{ color: "var(--navy)" }}>{t("contact.responseTimeBodyStrong")}</strong> {t("contact.responseTimeBodySuffix")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ rapide */}
      <section className="sec soft">
        <div className="wrap" style={{ maxWidth: 700 }}>
          <h2 className="h2" style={{ fontSize: "clamp(1.5rem, 2.4vw, 2rem)", marginBottom: 28 }}>{t("contact.faqTitle")}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {faqs.map((faq, i) => (
              <div key={i} className="card" style={{ padding: 22 }}>
                <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>{faq.q}</h3>
                <p style={{ fontSize: 14, color: "var(--muted-mk)", lineHeight: 1.6 }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="sec" style={{ textAlign: "center" }}>
        <div className="wrap" style={{ maxWidth: 480 }}>
          <h2 className="h2" style={{ fontSize: "clamp(1.4rem, 2.2vw, 1.8rem)", marginBottom: 12 }}>{t("contact.ctaTitle")}</h2>
          <p className="lead" style={{ margin: "0 auto 24px" }}>{t("contact.ctaBody")}</p>
          <Link href="/sign-up/" className="btn btn-navy">
            {t("contact.ctaButton")}
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
