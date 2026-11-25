import { useCountUp } from "@/hooks/use-count-up";
import { useLanguage } from "@/i18n/LanguageContext";
import { TRADE_LABELS } from "@/i18n/translations";
import { CANADIAN_PROVINCES } from "@/lib/tax-profiles";
import { RETIRED_SECTOR_SLUGS, TOOL_SLUG_PAIRS } from "@/data/seo-slugs";

const TRADES_COUNT = Object.keys(TRADE_LABELS.en).filter((slug) => !RETIRED_SECTOR_SLUGS.has(slug)).length;
// Every province and territory has a tax profile (src/lib/tax-profiles.ts).
const JURISDICTIONS = CANADIAN_PROVINCES.length;
const TOOLS_COUNT = TOOL_SLUG_PAIRS.length;

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
              ? "Taxes gérées, deux langues, et la paperasse réduite : ce que le produit couvre aujourd'hui."
              : "Tax handled, two languages, and less paperwork: what the product covers today."}
          </p>
        </div>
        <div className="stat-grid">
          <StatTile
            target={2}
            label={lang === "fr" ? "langues, français et anglais, pour vous et vos clients" : "languages, English and French, for you and your clients"}
          />
          <StatTile
            target={TOOLS_COUNT}
            label={lang === "fr" ? "calculateurs gratuits : taxes, retenue, marge et taux horaire" : "free calculators: sales tax, holdback, markup and labour rate"}
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
