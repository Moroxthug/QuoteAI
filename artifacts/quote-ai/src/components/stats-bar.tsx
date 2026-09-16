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
    <div ref={ref as React.RefObject<HTMLDivElement>} className="text-center px-4">
      <div className="text-3xl sm:text-4xl font-bold text-gray-900 tabular-nums">
        {display}
        {suffix}
      </div>
      <div className="text-xs sm:text-sm text-gray-500 mt-1.5 leading-snug">{label}</div>
    </div>
  );
}

export function StatsBar() {
  const { lang } = useLanguage();

  return (
    <section className="py-8 sm:py-10 bg-white border-y border-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          <div className="pb-4 sm:pb-0">
            <StatTile
              target={30}
              suffix={lang === "fr" ? " s" : " sec"}
              label={lang === "fr" ? "Pour générer une soumission" : "To generate a quote"}
            />
          </div>
          <div className="pb-4 sm:pb-0">
            <StatTile
              target={TRADES_COUNT}
              suffix="+"
              label={lang === "fr" ? "Métiers pris en charge" : "Trades supported"}
            />
          </div>
          <div className="pt-4 sm:pt-0">
            <StatTile
              target={CITIES_COUNT}
              suffix="+"
              label={lang === "fr" ? "Villes canadiennes couvertes" : "Canadian cities covered"}
            />
          </div>
          <div className="pt-4 sm:pt-0">
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
      </div>
    </section>
  );
}
