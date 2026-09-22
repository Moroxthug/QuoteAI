// Phase 81 — the pilot-programme page (/pilot, /fr/pilote).
//
// quoteai opens in British Columbia, Ontario and Québec first
// (docs/PILOT-LAUNCH-PLAN.md). This page says what that means for the person
// reading it: which provinces, what they get, what is expected back, and —
// when the owner has created the Stripe promotion code and set
// PILOT_PROMO_CODE — the code itself, remembered so it lands on their first
// checkout without anyone having to retype it.
//
// When the code is not configured the page says the intake is not open rather
// than showing an offer that would bounce at checkout.

import { Link, useLocation } from "wouter";
import { ArrowRight, Check, MapPin, MessageCircle, Tag, Loader2 } from "lucide-react";
import { useGetPilotOffer } from "@workspace/api-client-react";
import { SeoHead } from "@/components/seo-head";
import { useAuth } from "@/hooks/use-auth";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { useLanguage } from "@/i18n/LanguageContext";
import { breadcrumbJsonLd, webPageJsonLd } from "@/data/json-ld";
import { PILOT_PROVINCES, provincePath, provinceName } from "@/data/province-data";
import { rememberPilotPromo } from "@/lib/pilot-promo";

const GIVE_KEYS = ["give1", "give2", "give3", "give4"] as const;
const ASK_KEYS = ["ask1", "ask2", "ask3"] as const;

function ScrollSection({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useScrollFade();
  return (
    <section id={id} ref={ref as React.RefObject<HTMLElement>} className={`fade-in-section ${className}`}>
      {children}
    </section>
  );
}

export default function PilotPage() {
  const { isSignedIn } = useAuth();
  const { t, lang } = useLanguage();
  const [, navigate] = useLocation();
  const { data: offer, isLoading } = useGetPilotOffer();

  const canonical = lang === "fr" ? "https://quoteai.ca/fr/pilote/" : "https://quoteai.ca/pilot/";
  const altCanonical = lang === "fr" ? "https://quoteai.ca/pilot/" : "https://quoteai.ca/fr/pilote/";
  const path = lang === "fr" ? "/fr/pilote/" : "/pilot/";

  function join() {
    if (offer?.enabled && offer.code) rememberPilotPromo(offer.code);
    navigate(isSignedIn ? "/dashboard/billing" : "/sign-up");
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={t("pilot.seoTitle")}
        description={t("pilot.seoDescription")}
        canonical={canonical}
        altCanonical={altCanonical}
        lang={lang === "fr" ? "fr-CA" : "en-CA"}
        jsonLd={[
          webPageJsonLd(t("pilot.seoTitle"), t("pilot.seoDescription"), path, "WebPage", lang),
          breadcrumbJsonLd([
            { name: lang === "fr" ? "Accueil" : "Home", path: lang === "fr" ? "/fr/" : "/" },
            { name: t("pilot.breadcrumb"), path },
          ]),
        ]}
      />

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ textAlign: "center", maxWidth: 800, margin: "0 auto", paddingBlock: "clamp(56px, 7vw, 92px)" }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 20, justifyContent: "center", display: "flex" }}>
            {t("pilot.eyebrow")}
          </p>
          <h1>{t("pilot.h1")}</h1>
          <p className="lead" style={{ margin: "0 auto" }}>{t("pilot.heroBody")}</p>

          <div className="pilot-code">
            {isLoading ? (
              <span className="chip chip-grey"><Loader2 className="h-3 w-3 mr-1 animate-spin" />{t("pilot.checking")}</span>
            ) : offer?.enabled && offer.code ? (
              <>
                <span className="pilot-code-tag"><Tag className="h-4 w-4" />{offer.code}</span>
                <span className="pilot-code-note">{t("pilot.codeNote")}</span>
              </>
            ) : (
              <span className="pilot-code-note">{t("pilot.notOpen")}</span>
            )}
          </div>

          <div className="hero-cta" style={{ justifyContent: "center" }}>
            <button onClick={join} className="btn btn-white">
              {offer?.enabled ? t("pilot.joinCta") : t("pilot.startFree")}
            </button>
            <Link href={lang === "fr" ? "/fr/tarifs/" : "/pricing/"} className="btn btn-outline-light">
              {t("pilot.seePricing")}
            </Link>
          </div>
          <p className="hero-note">{t("pilot.heroNote")}</p>
        </div>
      </section>

      {/* ── WHERE ──────────────────────────────────────────── */}
      <ScrollSection className="sec" id="provinces">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow">{t("pilot.whereEyebrow")}</span>
              <h2 className="h2">{t("pilot.whereTitle")}</h2>
            </div>
            <p className="lead">{t("pilot.whereBody")}</p>
          </div>
          <div className="news-grid">
            {PILOT_PROVINCES.map((p) => (
              <Link key={p.code} href={provincePath(p, lang)} className="card dd-card">
                <div className="price-name" style={{ marginBottom: 8 }}>
                  <MapPin className="h-4 w-4" />
                  <h3>{provinceName(p, lang)}</h3>
                </div>
                <p>{t(`pilot.province.${p.code}`)}</p>
                <span className="cta-link" style={{ marginTop: 12 }}>
                  {t("pilot.provinceLink")} <ArrowRight className="chev h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── WHAT YOU GET / WHAT WE ASK ─────────────────────── */}
      <ScrollSection className="sec soft" id="deal">
        <div className="wrap">
          <div className="split-2">
            <div className="card dd-card">
              <h3>{t("pilot.giveTitle")}</h3>
              <ul className="prov-notes">
                {GIVE_KEYS.map((k) => (
                  <li key={k}><Check className="h-4 w-4 shrink-0" /><span>{t(`pilot.${k}`)}</span></li>
                ))}
              </ul>
            </div>
            <div className="card dd-card">
              <h3>{t("pilot.askTitle")}</h3>
              <ul className="prov-notes">
                {ASK_KEYS.map((k) => (
                  <li key={k}><MessageCircle className="h-4 w-4 shrink-0" /><span>{t(`pilot.${k}`)}</span></li>
                ))}
              </ul>
              <p className="prov-fine">{t("pilot.askFine")}</p>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── HOW TO JOIN ────────────────────────────────────── */}
      <ScrollSection className="sec" id="how">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">{t("pilot.stepsEyebrow")}</span>
              <h2 className="h2">{t("pilot.stepsTitle")}</h2>
            </div>
          </div>
          <div className="steps3">
            {["1", "2", "3"].map((n) => (
              <div key={n} className="step">
                <span className="n">{n}</span>
                <b>{t(`pilot.step${n}Title`)}</b>
                <p>{t(`pilot.step${n}Body`)}</p>
              </div>
            ))}
          </div>
          <div className="cmp-cta">
            <button onClick={join} className="btn btn-navy">
              {offer?.enabled ? t("pilot.joinCta") : t("pilot.startFree")}
            </button>
          </div>
        </div>
      </ScrollSection>
    </div>
  );
}
