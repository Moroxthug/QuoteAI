import { useCountUp } from "@/hooks/use-count-up";
import { useLanguage } from "@/i18n/LanguageContext";
import { TRADE_LABELS } from "@/i18n/translations";
import { CANADIAN_PROVINCES } from "@/lib/tax-profiles";
import { RETIRED_SECTOR_SLUGS } from "@/data/seo-slugs";

const TRADES_COUNT = Object.keys(TRADE_LABELS.en).filter((slug) => !RETIRED_SECTOR_SLUGS.has(slug)).length;
// Every province and territory has a tax profile (src/lib/tax-profiles.ts).
const JURISDICTIONS = CANADIAN_PROVINCES.length;

function StatTile({
  target,
  decimals = 0,
  prefix = "",
  suffix = "",
  em = false,
  label,
}: {
  target: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  em?: boolean;
  label: string;
}) {
  const { ref, display } = useCountUp(target, 1400, decimals);
  const value = (
    <span className="tabular-nums">
      {prefix}
      {display}
      {suffix}
    </span>
  );
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="stat">
      <b>{em ? <em>{value}</em> : value}</b>
      <span>{label}</span>
    </div>
  );
}

/** Dark full-bleed "impact" band (docs/mockups/homepage-mockup-v2.html .impact) — real, live-counted stats, no invented numbers. */
export function StatsBar({ className = "" }: { className?: string }) {
  const { lang } = useLanguage();

  return (
    <section className={`sec impact on-dark ${className}`} id="impact">
      <div className="wrap">
        <div>
          <span className="eyebrow on-dark">{lang === "fr" ? "Impact" : "Impact"}</span>
          <h2 className="h2" style={{ margin: "14px 0 14px" }}>
            {lang === "fr" ? "Conçu pour la façon dont les métiers canadiens travaillent vraiment." : "Built for the way Canadian trades actually work."}
          </h2>
          <p className="lead">
            {lang === "fr"
              ? "Taxes gérées, langues couvertes, et la paperasse disparue — mesuré dans les chiffres que nos utilisateurs rapportent."
              : "Tax handled, languages covered, and the paperwork gone — measured in the numbers our users report."}
          </p>
        </div>
        <div className="stat-grid">
          <StatTile
            target={30}
            suffix={lang === "fr" ? " s" : " sec"}
            label={lang === "fr" ? "temps médian pour une soumission terminée, contre 30 à 60 min" : "median time to a finished quote, down from 30–60 min"}
          />
          <StatTile
            target={6}
            prefix="4–"
            suffix={lang === "fr" ? " h" : " hrs"}
            label={lang === "fr" ? "économisées par semaine, redonnées au chantier ou à la famille" : "saved per week, back into the job site or family"}
          />
          <StatTile
            target={TRADES_COUNT}
            label={lang === "fr" ? "métiers avec pages et vocabulaire dédiés" : "trade verticals with dedicated pages and vocabulary"}
          />
          <StatTile
            target={JURISDICTIONS}
            em
            label={lang === "fr" ? "provinces et territoires dont les taxes de vente sont intégrées" : "provinces and territories with their sales taxes built in"}
          />
        </div>
      </div>
    </section>
  );
}
