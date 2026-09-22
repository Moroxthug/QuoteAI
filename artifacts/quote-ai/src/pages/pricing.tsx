// Phase 81 — the public pricing page (/pricing, /fr/tarifs).
//
// Until now "See plans" on the homepage pointed at an anchor inside a prose
// card, /whatsapp linked to "/#pricing" (an anchor that does not exist), and
// the only real plan grid lived behind the login. This is the page those
// links wanted: the same three tiers, the same monthly/annual cadence the
// billing page offers, the pay-per-quote options, an honest comparison table
// built from the plan feature map the server gates on, and the questions a
// contractor asks before typing a card number.
//
// Prices come from data/pricing.ts at build time (so the prerendered HTML and
// the crawler see real numbers) and are refreshed from GET /api/payments/plans
// after hydration, which is also what tells the page whether annual checkout
// is configured yet (owner track O9).

import { Link, useLocation } from "wouter";
import { useState } from "react";
import { ArrowRight, Check, Minus, Crown, Zap, Sparkles, FileText } from "lucide-react";
import { useGetPlans, getGetPlansQueryKey } from "@workspace/api-client-react";
import { SeoHead } from "@/components/seo-head";
import { MarketingImage } from "@/components/marketing-image";
import { useAuth } from "@/hooks/use-auth";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { useLanguage } from "@/i18n/LanguageContext";
import { breadcrumbJsonLd, pricingJsonLd, faqJsonLd } from "@/data/json-ld";
import {
  MARKETING_PLANS,
  ONE_SHOT_OPTIONS,
  PRICING_ROWS,
  PRICING_FAQ_KEYS,
  monthlyEquivalent,
  rowValue,
  yearlyPrice,
  type MarketingPlan,
} from "@/data/pricing";

function ScrollSection({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useScrollFade();
  return (
    <section id={id} ref={ref as React.RefObject<HTMLElement>} className={`fade-in-section ${className}`}>
      {children}
    </section>
  );
}

function money(n: number, lang: string): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const { t, lang } = useLanguage();
  const [, navigate] = useLocation();
  const [interval, setInterval] = useState<"month" | "year">("month");
  // The live plan list keeps the page honest if a Stripe price ever moves;
  // until it arrives (and on the prerendered HTML) data/pricing.ts is shown.
  // No retries: this is a marketing page, and a server that cannot answer
  // should cost one failed request, not four.
  const { data: livePlans } = useGetPlans({
    query: { queryKey: getGetPlansQueryKey(), retry: false, staleTime: 5 * 60_000 },
  });

  const priceOf = (plan: MarketingPlan): number => {
    const live = Array.isArray(livePlans) ? livePlans.find((p) => p.id === plan.id) : undefined;
    const monthly = live?.price ?? plan.monthly;
    return interval === "year" ? (live?.yearlyPrice ?? yearlyPrice(monthly)) : monthly;
  };
  const oneShotPrice = (id: string, fallback: number): number =>
    (Array.isArray(livePlans) ? livePlans.find((p) => p.id === id)?.price : undefined) ?? fallback;

  // Annual checkout only exists once the three yearly Stripe price ids are
  // set (owner track O9). Before that the toggle says so instead of sending
  // someone into a checkout that would 400.
  const annualAvailable = Array.isArray(livePlans) ? livePlans.some((p) => p.yearlyAvailable) : false;
  const effectiveInterval = interval === "year" && annualAvailable ? "year" : "month";

  const canonical = lang === "fr" ? "https://quoteai.ca/fr/tarifs/" : "https://quoteai.ca/pricing/";
  const altCanonical = lang === "fr" ? "https://quoteai.ca/pricing/" : "https://quoteai.ca/fr/tarifs/";
  const path = lang === "fr" ? "/fr/tarifs/" : "/pricing/";

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={t("pricing.seoTitle")}
        description={t("pricing.seoDescription")}
        canonical={canonical}
        altCanonical={altCanonical}
        lang={lang === "fr" ? "fr-CA" : "en-CA"}
        jsonLd={[
          pricingJsonLd(lang),
          faqJsonLd(PRICING_FAQ_KEYS.map((k) => ({ q: t(`pricing.faq.${k}.q`), a: t(`pricing.faq.${k}.a`) }))),
          breadcrumbJsonLd([
            { name: lang === "fr" ? "Accueil" : "Home", path: lang === "fr" ? "/fr/" : "/" },
            { name: t("pricing.breadcrumb"), path },
          ]),
        ]}
      />

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ textAlign: "center", maxWidth: 780, margin: "0 auto", paddingBlock: "clamp(56px, 7vw, 92px)" }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 20, justifyContent: "center", display: "flex" }}>
            {t("pricing.eyebrow")}
          </p>
          <h1>{t("pricing.h1")}</h1>
          <p className="lead" style={{ margin: "0 auto" }}>{t("pricing.heroBody")}</p>
          <p className="hero-note">{t("pricing.heroNote")}</p>
        </div>
      </section>

      {/* ── PLANS ──────────────────────────────────────────── */}
      <ScrollSection className="sec" id="plans">
        <div className="wrap">
          <div className="price-switch">
            <div className="seg seg-2" data-period={effectiveInterval === "year" ? "y" : "m"} role="group" aria-label={t("pricing.cadence")}>
              <div className="seg-thumb" aria-hidden="true" />
              <button type="button" className="seg-b" onClick={() => setInterval("month")} aria-pressed={effectiveInterval === "month"}>
                {t("pricing.monthly")}
              </button>
              <button
                type="button"
                className="seg-b"
                onClick={() => setInterval("year")}
                aria-pressed={effectiveInterval === "year"}
                disabled={!annualAvailable}
                title={annualAvailable ? undefined : t("pricing.annualSoon")}
              >
                {t("pricing.annual")}
              </button>
            </div>
            {annualAvailable ? (
              <span className="chip chip-green"><Sparkles className="h-3 w-3 mr-1" />{t("pricing.twoMonthsFree")}</span>
            ) : (
              <span className="chip chip-grey chip-wrap">{t("pricing.annualSoon")}</span>
            )}
          </div>

          <div className="price-grid">
            {MARKETING_PLANS.map((plan) => {
              const price = priceOf(plan);
              return (
                <div key={plan.id} className={`card price-card${plan.popular ? " is-popular" : ""}`}>
                  <div className="price-head">
                    <div className="price-name">
                      {plan.id === "monthly_starter" ? <Zap className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                      <h2>{plan.name}</h2>
                      {plan.popular && <span className="chip chip-teal">{t("pricing.mostPopular")}</span>}
                    </div>
                    <p className="price-amount">
                      {money(price, lang)}
                      <span>{effectiveInterval === "year" ? t("pricing.perYear") : t("pricing.perMonth")}</span>
                    </p>
                    {effectiveInterval === "year" && (
                      <p className="price-sub">{t("pricing.perMonthEquivalent").replace("{amount}", money(monthlyEquivalent(plan.monthly), lang))}</p>
                    )}
                    <p className="price-sub">
                      {plan.quotaPerMonth === null
                        ? t("pricing.quotaUnlimited")
                        : t("pricing.quotaPerMonth").replace("{count}", String(plan.quotaPerMonth))}
                    </p>
                  </div>
                  <ul className="price-feats">
                    {PRICING_ROWS.filter((r) => r.kind === "feature").map((row) => {
                      const on = rowValue(row, plan, t) === true;
                      // The tick/dash is the visual signal; the sr-only word
                      // is what a screen reader (or a page-text scrape) needs
                      // so a greyed-out line is not read as an inclusion.
                      return (
                        <li key={row.labelKey} className={on ? "" : "off"}>
                          {on ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Minus className="h-3.5 w-3.5" aria-hidden="true" />}
                          <span className="sr-only">{on ? t("pricing.value.included") : t("pricing.value.notIncluded")}: </span>
                          {t(row.labelKey)}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="price-foot">
                    <button
                      className={plan.popular ? "btn btn-navy w-full" : "btn btn-outline-navy w-full"}
                      onClick={() => navigate(isSignedIn ? "/dashboard/billing" : `/sign-up?plan=${plan.id}`)}
                    >
                      {isSignedIn ? t("pricing.choosePlan").replace("{name}", plan.name) : t("pricing.startFree")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="price-note">{t("pricing.taxesNote")}</p>
        </div>
      </ScrollSection>

      {/* ── PAY PER QUOTE ──────────────────────────────────── */}
      <ScrollSection className="sec soft" id="one-off">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">{t("pricing.oneOffEyebrow")}</span>
              <h2 className="h2">{t("pricing.oneOffTitle")}</h2>
            </div>
            <p className="lead">{t("pricing.oneOffBody")}</p>
          </div>
          <div className="split-2">
            {ONE_SHOT_OPTIONS.map((opt) => (
              <div key={opt.id} className="card dd-card">
                <div className="price-name" style={{ marginBottom: 8 }}>
                  <FileText className="h-4 w-4" />
                  <h3>{t(`pricing.oneOff.${opt.id}.name`)}</h3>
                </div>
                <p className="price-amount" style={{ marginBottom: 8 }}>{money(oneShotPrice(opt.id, opt.price), lang)}</p>
                <p>{t(`pricing.oneOff.${opt.id}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── COMPARISON ─────────────────────────────────────── */}
      <ScrollSection className="sec" id="compare">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">{t("pricing.compareEyebrow")}</span>
              <h2 className="h2">{t("pricing.compareTitle")}</h2>
            </div>
            <p className="lead">{t("pricing.compareBody")}</p>
          </div>
          <div className="card cmp-wrap" tabIndex={0}>
            <table className="cmp">
              <thead>
                <tr>
                  <th>{t("pricing.compareFeatureCol")}</th>
                  {MARKETING_PLANS.map((p) => (
                    <th key={p.id} className={p.popular ? "q" : undefined}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRICING_ROWS.map((row) => (
                  <tr key={row.labelKey}>
                    <td>{t(row.labelKey)}</td>
                    {MARKETING_PLANS.map((plan) => {
                      const value = rowValue(row, plan, t);
                      return (
                        <td key={plan.id} className={plan.popular ? "q" : undefined}>
                          {value === true ? (
                            <><Check className="h-4 w-4" aria-hidden="true" /><span className="sr-only">{t("pricing.value.included")}</span></>
                          ) : value === false ? (
                            <><Minus className="h-4 w-4" style={{ opacity: 0.45 }} aria-hidden="true" /><span className="sr-only">{t("pricing.value.notIncluded")}</span></>
                          ) : (
                            value
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ScrollSection>

      {/* ── FAQ ────────────────────────────────────────────── */}
      <ScrollSection className="sec soft" id="faq">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">{t("pricing.faqEyebrow")}</span>
              <h2 className="h2">{t("pricing.faqTitle")}</h2>
            </div>
          </div>
          <div className="dd-grid">
            {PRICING_FAQ_KEYS.map((key) => (
              <div key={key} className="card dd-card">
                <h3>{t(`pricing.faq.${key}.q`)}</h3>
                <p>{t(`pricing.faq.${key}.a`)}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── CTA ────────────────────────────────────────────── */}
      <ScrollSection className="cta on-dark" id="trial">
        <div className="cta-bg">
          <MarketingImage slot="cta-pricing" />
        </div>
        <div className="wrap cta-in">
          <span className="eyebrow on-dark">{t("pricing.ctaEyebrow")}</span>
          <h2>{t("pricing.ctaTitle")}</h2>
          <p>{t("pricing.ctaBody")}</p>
          <div className="cta-actions">
            <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-white">
              {t("pricing.ctaButton")}
            </button>
            <Link href={lang === "fr" ? "/fr/pilote/" : "/pilot/"} className="btn btn-outline-light">
              {t("pricing.ctaPilot")} <ArrowRight className="chev h-4 w-4" />
            </Link>
          </div>
          <p className="cta-fine">{t("pricing.ctaFine")}</p>
        </div>
      </ScrollSection>
    </div>
  );
}
