import { Link, useLocation } from "wouter";
import { ArrowRight, Mic, FileText, Zap, Check, MessageCircle } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { useAuth } from "@/hooks/use-auth";
import { WhatsAppChatDemo } from "@/components/whatsapp-chat-demo";
import { useLanguage } from "@/i18n/LanguageContext";

export default function WhatsappPage() {
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useLanguage();

  const FEATURES = [
    {
      icon: Mic,
      title: t("whatsapp.feature1Title"),
      desc: t("whatsapp.feature1Desc"),
    },
    {
      icon: Zap,
      title: t("whatsapp.feature2Title"),
      desc: t("whatsapp.feature2Desc"),
    },
    {
      icon: FileText,
      title: t("whatsapp.feature3Title"),
      desc: t("whatsapp.feature3Desc"),
    },
  ];

  const HOW_IT_WORKS = [
    { num: "1", title: t("whatsapp.step1Title"), desc: t("whatsapp.step1Desc") },
    { num: "2", title: t("whatsapp.step2Title"), desc: t("whatsapp.step2Desc") },
    { num: "3", title: t("whatsapp.step3Title"), desc: t("whatsapp.step3Desc") },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={t("whatsapp.seoTitle")}
        description={t("whatsapp.seoDescription")}
        canonical="https://quoteai.ca/whatsapp/"
      />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gray-950 pt-20 pb-24">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(ellipse, #7c3aed, transparent)" }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(ellipse, #06b6d4, transparent)" }} />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold px-3 py-1.5 rounded-full mb-6">
            <MessageCircle className="w-3.5 h-3.5" />
            {t("whatsapp.badgeNew")}
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.1] mb-5">
            {t("whatsapp.heroTitlePrefix")}{" "}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #a78bfa, #34d399)" }}>
              {t("whatsapp.heroTitleHighlight")}
            </span>
          </h1>

          <p className="text-lg text-gray-400 leading-relaxed mb-4 max-w-2xl mx-auto">
            {t("whatsapp.heroBody")}
          </p>

          <p className="text-sm text-gray-600 mb-10 font-medium">
            {t("whatsapp.heroSubBody")}
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={() => navigate(isSignedIn ? "/dashboard/settings" : "/sign-up?plan=monthly_pro")}
              className="inline-flex h-12 items-center justify-center gap-2 px-7 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-violet-900/40"
              style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
            >
              {t("whatsapp.activateBot")}
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="#demo"
              className="inline-flex h-12 items-center justify-center gap-2 px-7 rounded-xl text-sm font-semibold text-gray-300 border border-gray-700 hover:border-gray-500 hover:text-white transition-all"
            >
              {t("whatsapp.watchDemo")}
            </Link>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-green-500" />
              {t("whatsapp.availableProElite")}
            </span>
            <span className="hidden sm:block text-gray-700">·</span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-green-500" />
              {t("whatsapp.instantActivation")}
            </span>
            <span className="hidden sm:block text-gray-700">·</span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-green-500" />
              {t("whatsapp.worksOnAnyPhone")}
            </span>
          </div>
        </div>
      </section>

      {/* ── Demo ───────────────────────────────────────────────────── */}
      <section id="demo" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-14 items-center">
              <div className="order-2 lg:order-1">
                <span className="inline-block text-violet-600 text-xs font-bold uppercase tracking-wider mb-3">{t("whatsapp.howItWorksLabel")}</span>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-6 leading-snug">
                  {t("whatsapp.howItWorksTitleLine1")}<br />
                  <span className="text-violet-600">{t("whatsapp.howItWorksTitleLine2")}</span>
                </h2>

                <div className="space-y-5">
                  {HOW_IT_WORKS.map((s) => (
                    <div key={s.num} className="flex gap-4">
                      <div className="w-8 h-8 rounded-xl text-sm font-bold shrink-0 flex items-center justify-center text-white"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                        {s.num}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm mb-0.5">{s.title}</p>
                        <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3">
                  <span className="text-amber-500 text-lg shrink-0">⚡</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">{t("whatsapp.comingSoonTitle")}</p>
                    <p className="text-xs text-amber-700 mt-0.5">{t("whatsapp.comingSoonDesc")}</p>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2 flex justify-center">
                <WhatsAppChatDemo />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">{t("whatsapp.everythingYouNeedTitle")}</h2>
              <p className="text-gray-500 mt-2 text-sm">{t("whatsapp.everythingYouNeedDesc")}</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 text-violet-600 bg-violet-50">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1.5">{f.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOMO / Comparison ───────────────────────────────────────── */}
      <section className="py-16 bg-gray-950">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
          <p className="text-gray-500 text-sm mb-4 uppercase tracking-wider font-semibold">{t("whatsapp.marketRealityLabel")}</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 leading-snug">
            {t("whatsapp.competitorsSpendPrefix")}{" "}
            <span className="line-through text-gray-600">{t("whatsapp.thirtyToFortyMinutes")}</span>{" "}
            {t("whatsapp.toMakeAQuote")}<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #a78bfa, #34d399)" }}>
              {t("whatsapp.youTake60Seconds")}
            </span>
          </h2>
          <p className="text-gray-400 text-sm mb-10 leading-relaxed">
            {t("whatsapp.tradespersonRespondPrefix")}{" "}
            <strong className="text-white">{t("whatsapp.threeXMoreLikely")}</strong> {t("whatsapp.toWinTheJob")}<br />
            {t("whatsapp.withBotRespondFaster")}
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-10 text-left">
            {[
              { emoji: "😓", label: t("whatsapp.withoutQuoteAi"), items: [t("whatsapp.without1"), t("whatsapp.without2"), t("whatsapp.without3"), t("whatsapp.without4"), t("whatsapp.without5")] },
              { emoji: "⚡", label: t("whatsapp.withQuoteAiWhatsapp"), items: [t("whatsapp.with1"), t("whatsapp.with2"), t("whatsapp.with3"), t("whatsapp.with4"), t("whatsapp.with5")], highlight: true },
            ].map((col) => (
              <div key={col.label} className={`rounded-xl p-4 ${col.highlight ? "border border-violet-500/40 bg-violet-950/40" : "bg-gray-900"}`}>
                <p className="text-sm font-bold text-white mb-3">{col.emoji} {col.label}</p>
                <ul className="space-y-1.5">
                  {col.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.highlight ? "bg-green-400" : "bg-gray-600"}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-xl">
          <div className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-700 text-xs font-bold px-3 py-1 rounded-full mb-4">
            <MessageCircle className="w-3 h-3" />
            {t("whatsapp.botProElite")}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-3">
            {t("whatsapp.ctaTitle")}
          </h2>
          <p className="text-gray-500 text-sm mb-7 leading-relaxed">
            {t("whatsapp.ctaBody")}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={() => navigate(isSignedIn ? "/dashboard/settings" : "/sign-up?plan=monthly_pro")}
              className="inline-flex h-11 items-center justify-center gap-2 px-7 rounded-xl text-sm font-bold text-white transition-all shadow-md shadow-violet-300"
              style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
            >
              {isSignedIn ? t("whatsapp.connectWhatsapp") : t("whatsapp.tryFree7Days")}
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/#prezzi"
              className="inline-flex h-11 items-center justify-center px-7 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:border-violet-300 transition-all"
            >
              {t("whatsapp.comparePlans")}
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            {t("whatsapp.freeTrialFooter")}
          </p>
        </div>
      </section>
    </div>
  );
}
