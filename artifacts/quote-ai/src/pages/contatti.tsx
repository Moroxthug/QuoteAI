import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Mail, MessageCircle, FileText, Clock } from "lucide-react";
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

      {/* Hero */}
      <section className="relative overflow-hidden bg-white pt-24 pb-16">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.12) 0%, transparent 70%)",
          }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl relative z-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-5">
            {t("contact.heroTitlePrefix")}{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {t("contact.heroTitleHighlight")}
            </span>
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            {t("contact.heroBody")}
          </p>
        </div>
      </section>

      {/* Canali di contatto */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Email supporto */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-violet-50 flex items-center justify-center mb-5">
                <Mail className="h-6 w-6 text-violet-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">{t("contact.productSupportTitle")}</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                {t("contact.productSupportBody")}
              </p>
              <a
                href="mailto:info@quoteai.ca"
                className="text-violet-600 font-semibold text-sm hover:text-violet-800 transition-colors"
              >
                info@quoteai.ca →
              </a>
            </div>

            {/* WhatsApp */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center mb-5">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">WhatsApp</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                {t("contact.whatsappBody")}
              </p>
              <Link
                href="/whatsapp/"
                className="text-green-600 font-semibold text-sm hover:text-green-800 transition-colors"
              >
                {t("contact.whatsappLink")} →
              </Link>
            </div>

            {/* Privacy / legale */}
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-5">
                <FileText className="h-6 w-6 text-gray-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">{t("contact.privacyLegalTitle")}</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                {t("contact.privacyLegalBody")}
              </p>
              <a
                href="mailto:privacy@quoteai.ca"
                className="text-gray-600 font-semibold text-sm hover:text-gray-900 transition-colors"
              >
                privacy@quoteai.ca →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Tempi di risposta */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="flex items-start gap-4 bg-violet-50 border border-violet-100 rounded-2xl p-6">
            <Clock className="h-6 w-6 text-violet-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-gray-900 mb-1">{t("contact.responseTimeTitle")}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {t("contact.responseTimeBodyPrefix")} <strong>{t("contact.responseTimeBodyStrong")}</strong> {t("contact.responseTimeBodySuffix")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ rapide */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">{t("contact.faqTitle")}</h2>
          <div className="space-y-5">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("contact.ctaTitle")}</h2>
          <p className="text-gray-500 mb-6">
            {t("contact.ctaBody")}
          </p>
          <Link
            href="/sign-up/"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)" }}
          >
            {t("contact.ctaButton")}
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
