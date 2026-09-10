import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Link } from "wouter";
import { ArrowRight, Zap, Target, Heart, Users } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

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

      {/* Hero */}
      <section className="relative overflow-hidden bg-white pt-24 pb-20">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.12) 0%, transparent 70%)",
          }}
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl relative z-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
            <Heart className="h-3.5 w-3.5 fill-current" />
            {t("about.madeIn")}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-6">
            {t("about.heroTitlePrefix")}{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {t("about.heroTitleHighlight")}
            </span>
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
            {t("about.heroBody")}
          </p>
        </div>
      </section>

      {/* La storia */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">{t("about.storyTitle")}</h2>
          <div className="space-y-5 text-gray-600 leading-relaxed text-lg">
            <p>{t("about.storyP1")}</p>
            <p>{t("about.storyP2")}</p>
            <p>{t("about.storyP3")}</p>
          </div>
        </div>
      </section>

      {/* I nostri valori */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{t("about.valuesTitle")}</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              {t("about.valuesSubtitle")}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-2xl p-8 text-center">
              <div className="h-14 w-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-5">
                <Zap className="h-7 w-7 text-violet-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">{t("about.value1Title")}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {t("about.value1Body")}
              </p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-8 text-center">
              <div className="h-14 w-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-5">
                <Target className="h-7 w-7 text-violet-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">{t("about.value2Title")}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {t("about.value2Body")}
              </p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-8 text-center">
              <div className="h-14 w-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-5">
                <Users className="h-7 w-7 text-violet-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">{t("about.value3Title")}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {t("about.value3Body")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Chi usiamo */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">{t("about.whoTitle")}</h2>
          <div className="space-y-4 text-gray-600 leading-relaxed text-lg">
            <p>
              {t("about.whoP1Prefix")} <strong>{t("about.whoP1Strong")}</strong> {t("about.whoP1Suffix")}
            </p>
            <p>{t("about.whoP2")}</p>
            <p>{t("about.whoP3")}</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-5">
            {t("about.ctaTitle")}
          </h2>
          <p className="text-gray-500 text-lg mb-8">
            {t("about.ctaBody")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up/"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)" }}
            >
              {t("about.ctaStartFree")} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contatti/"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-gray-700 border border-gray-200 hover:border-violet-300 hover:text-violet-700 transition-colors"
            >
              {t("about.ctaContactUs")}
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
