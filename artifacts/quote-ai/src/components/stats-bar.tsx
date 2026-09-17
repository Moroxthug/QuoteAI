import { useCountUp } from "@/hooks/use-count-up";
import { useLanguage } from "@/i18n/LanguageContext";
import { TRADE_LABELS } from "@/i18n/translations";
import { CITIES } from "@/data/seo-data";
import { AGGREGATE_RATING } from "@/components/testimonials-section";

const TRADES_COUNT = Object.keys(TRADE_LABELS.en).length;
const CITIES_COUNT = CITIES.length;
const RATING = parseFloat(AGGREGATE_RATING.ratingValue);

function StatTile({
  target,
  decimals = 0,
  suffix = "",
  label,
}: {
  target: number;
  decimals?: number;
  suffix?: string;
  label: string;
}) {
  const { ref, display } = useCountUp(target, 1400, decimals);
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="stat">
      <b className="tabular-nums">
        {display}
        {suffix}
      </b>
      <span>{label}</span>
    </div>
  );
}

/** Dark full-bleed "impact" band (docs/mockups/homepage-mockup.html .impact) — real, live-counted stats, no invented numbers. */
export function StatsBar() {
  const { lang } = useLanguage();

  return (
    <section className="impact on-dark" id="impact">
      <div className="wrap">
        <div>
          <p className="eyebrow">{lang === "fr" ? "Impact" : "Impact"}</p>
          <h2 className="sec-title">{lang === "fr" ? "Un rythme que nos clients peuvent mesurer." : "Momentum our customers can measure."}</h2>
          <p className="sec-sub">
            {lang === "fr"
              ? "Les équipes sur quoteai chiffrent plus vite et couvrent tout le pays. Voici à quoi ça ressemble sur la plateforme."
              : "Teams on quoteai quote faster and cover the whole country. Here is what that looks like across the platform."}
          </p>
        </div>
        <div className="stat-grid">
          <StatTile
            target={30}
            suffix={lang === "fr" ? " s" : " sec"}
            label={lang === "fr" ? "Pour générer une soumission" : "To generate a quote"}
          />
          <StatTile
            target={TRADES_COUNT}
            suffix="+"
            label={lang === "fr" ? "Métiers pris en charge" : "Trades supported"}
          />
          <StatTile
            target={CITIES_COUNT}
            suffix="+"
            label={lang === "fr" ? "Villes canadiennes couvertes" : "Canadian cities covered"}
          />
          <StatTile
            target={RATING}
            decimals={1}
            suffix="/5"
            label={
              lang === "fr"
                ? `Note moyenne (${AGGREGATE_RATING.reviewCount} avis)`
                : `Average rating (${AGGREGATE_RATING.reviewCount} reviews)`
            }
          />
        </div>
      </div>
    </section>
  );
}
