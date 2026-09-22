import { Link, useLocation } from "wouter";
import { Mic, FileText, Zap, Check, X } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { breadcrumbJsonLd, webPageJsonLd } from "@/data/json-ld";
import { useAuth } from "@/hooks/use-auth";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { WhatsAppChatDemo } from "@/components/whatsapp-chat-demo";
import { useLanguage } from "@/i18n/LanguageContext";

function ScrollSection({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useScrollFade();
  return (
    <section id={id} ref={ref as React.RefObject<HTMLElement>} className={`fade-in-section ${className}`}>
      {children}
    </section>
  );
}

export default function WhatsappPage() {
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const { t } = useLanguage();

  const FEATURES = [
    { icon: Mic, tile: "t-green", title: t("whatsapp.feature1Title"), desc: t("whatsapp.feature1Desc") },
    { icon: Zap, tile: "t-purple", title: t("whatsapp.feature2Title"), desc: t("whatsapp.feature2Desc") },
    { icon: FileText, tile: "t-teal", title: t("whatsapp.feature3Title"), desc: t("whatsapp.feature3Desc") },
  ];

  const HOW_IT_WORKS = [
    { num: "1", title: t("whatsapp.step1Title"), desc: t("whatsapp.step1Desc") },
    { num: "2", title: t("whatsapp.step2Title"), desc: t("whatsapp.step2Desc") },
    { num: "3", title: t("whatsapp.step3Title"), desc: t("whatsapp.step3Desc") },
  ];

  const WITHOUT_ITEMS = [t("whatsapp.without1"), t("whatsapp.without2"), t("whatsapp.without3"), t("whatsapp.without4"), t("whatsapp.without5")];
  const WITH_ITEMS = [t("whatsapp.with1"), t("whatsapp.with2"), t("whatsapp.with3"), t("whatsapp.with4"), t("whatsapp.with5")];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={t("whatsapp.seoTitle")}
        description={t("whatsapp.seoDescription")}
        canonical="https://quoteai.ca/whatsapp/"
        jsonLd={[
          webPageJsonLd(t("whatsapp.seoTitle"), t("whatsapp.seoDescription"), "/whatsapp/"),
          breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "WhatsApp", path: "/whatsapp/" }]),
        ]}
      />

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ textAlign: "center", maxWidth: 760, margin: "0 auto", paddingBlock: "clamp(64px, 8vw, 110px)" }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 22, justifyContent: "center", display: "flex" }}>
            {t("whatsapp.badgeNew")}
          </p>
          <h1>
            {t("whatsapp.heroTitlePrefix")} {t("whatsapp.heroTitleHighlight")}
          </h1>
          <p className="lead" style={{ margin: "0 auto" }}>{t("whatsapp.heroBody")}</p>
          <div className="hero-cta" style={{ justifyContent: "center" }}>
            <button
              onClick={() => navigate(isSignedIn ? "/dashboard/settings" : "/sign-up?plan=monthly_pro")}
              className="btn btn-white"
            >
              {t("whatsapp.activateBot")}
            </button>
            <Link href="#demo" className="btn btn-outline-light">
              {t("whatsapp.watchDemo")}
            </Link>
          </div>
          <p className="hero-note">
            {t("whatsapp.availableProElite")} · {t("whatsapp.instantActivation")} · {t("whatsapp.worksOnAnyPhone")}
          </p>
        </div>
      </section>

      {/* ── DEMO / HOW IT WORKS ────────────────────────────── */}
      <ScrollSection className="sec" id="demo">
        <div className="wrap">
          <div className="split">
            <div className="split-body">
              <span className="eyebrow">{t("whatsapp.howItWorksLabel")}</span>
              <h2>
                {t("whatsapp.howItWorksTitleLine1")}
                <br />
                {t("whatsapp.howItWorksTitleLine2")}
              </h2>
              <p className="lead">{t("whatsapp.heroSubBody")}</p>
            </div>
            <div className="split-media" style={{ display: "flex", justifyContent: "center" }}>
              <WhatsAppChatDemo />
            </div>
          </div>
          <div className="steps3">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.num} className="step">
                <span className="n">{s.num}</span>
                <b>{s.title}</b>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: 32, padding: "18px 22px", display: "flex", gap: 14, alignItems: "flex-start" }}>
            <Zap className="h-5 w-5 shrink-0" style={{ color: "var(--yellow-dark, #b45309)", marginTop: 2 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: "var(--navy)" }}>{t("whatsapp.comingSoonTitle")}</p>
              <p style={{ fontSize: 13, color: "var(--muted-mk)", marginTop: 2 }}>{t("whatsapp.comingSoonDesc")}</p>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── FEATURES ───────────────────────────────────────── */}
      <ScrollSection className="sec soft">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">{t("whatsapp.everythingYouNeedTitle")}</span>
              <h2 className="h2">{t("whatsapp.everythingYouNeedDesc")}</h2>
            </div>
          </div>
          <div className="tiles">
            {FEATURES.map((f) => (
              <div key={f.title} className={`tile ${f.tile}`}>
                <f.icon className="h-6 w-6" />
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── MARKET REALITY ─────────────────────────────────── */}
      <ScrollSection className="sec impact on-dark">
        <div className="wrap" style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <span className="eyebrow on-dark">{t("whatsapp.marketRealityLabel")}</span>
          <h2 className="h2" style={{ margin: "14px 0" }}>
            {t("whatsapp.competitorsSpendPrefix")}{" "}
            <span style={{ textDecoration: "line-through", opacity: 0.5 }}>{t("whatsapp.thirtyToFortyMinutes")}</span>{" "}
            {t("whatsapp.toMakeAQuote")}
            <br />
            <em style={{ fontStyle: "normal", color: "#8ef07f" }}>{t("whatsapp.youTake60Seconds")}</em>
          </h2>
          <p className="lead">
            {t("whatsapp.tradespersonRespondPrefix")} <strong>{t("whatsapp.threeXMoreLikely")}</strong> {t("whatsapp.toWinTheJob")}
            <br />
            {t("whatsapp.withBotRespondFaster")}
          </p>

          <div className="grid sm:grid-cols-2 gap-4" style={{ marginTop: 40, textAlign: "left" }}>
            <div className="card" style={{ padding: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>{t("whatsapp.withoutQuoteAi")}</p>
              <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {WITHOUT_ITEMS.map((item) => (
                  <li key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--muted-mk)" }}>
                    <X className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--muted-mk)" }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card" style={{ padding: 20, borderColor: "var(--green)" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>{t("whatsapp.withQuoteAiWhatsapp")}</p>
              <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {WITH_ITEMS.map((item) => (
                  <li key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--navy)", fontWeight: 600 }}>
                    <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--green)" }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── CTA ────────────────────────────────────────────── */}
      <ScrollSection className="cta on-dark" id="trial">
        <div className="cta-bg">
          <img src="https://picsum.photos/seed/quoteai-whatsapp-cta/1800/900" alt="" aria-hidden="true" loading="lazy" />
        </div>
        <div className="wrap cta-in">
          <span className="eyebrow on-dark">{t("whatsapp.botProElite")}</span>
          <h2>{t("whatsapp.ctaTitle")}</h2>
          <p>{t("whatsapp.ctaBody")}</p>
          <div className="cta-actions">
            <button
              onClick={() => navigate(isSignedIn ? "/dashboard/settings" : "/sign-up?plan=monthly_pro")}
              className="btn btn-white"
            >
              {isSignedIn ? t("whatsapp.connectWhatsapp") : t("whatsapp.tryFree7Days")}
            </button>
            <Link href="/#pricing" className="btn btn-outline-light">
              {t("whatsapp.comparePlans")}
            </Link>
          </div>
          <p className="cta-fine">{t("whatsapp.freeTrialFooter")}</p>
        </div>
      </ScrollSection>
    </div>
  );
}
