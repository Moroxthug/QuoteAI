import type React from "react";
import { Star } from "lucide-react";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { useLanguage } from "@/i18n/LanguageContext";

export const TESTIMONIALS = [
  {
    name: "RBA Construction",
    website: "rba-construction.ca",
    initials: "RB",
    rav: "g",
    rating: 5,
    key: "rba",
  },
  {
    name: "Abdul Contracting",
    website: "abdulcontracting.ca",
    initials: "AC",
    rav: "t",
    rating: 5,
    key: "abdul",
  },
];

export const AGGREGATE_RATING = {
  ratingValue: "5.0",
  reviewCount: TESTIMONIALS.length,
};

/** Reviews section (docs/mockups/homepage-mockup-v2.html .rev-grid/.rev-card) — real, verified testimonials. */
export function TestimonialsSection() {
  const ref = useScrollFade();
  const { t } = useLanguage();
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="fade-in-section sec soft" id="reviews">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="eyebrow">{t("testimonials.verifiedReviews")}</span>
            <h2 className="h2">{t("testimonials.whatPeopleSay")} {t("testimonials.aboutUs")}</h2>
          </div>
          <span className="chip chip-green" style={{ alignSelf: "center" }}>
            {AGGREGATE_RATING.ratingValue}/5 &middot; {AGGREGATE_RATING.reviewCount} {t("testimonials.reviews")}
          </span>
        </div>

        <div className="rev-grid">
          {TESTIMONIALS.map((item) => (
            <article key={item.name} className="card rev-card">
              <span className="stars" aria-label={t("testimonials.starRatingLabel").replace("{rating}", String(item.rating))}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} fill="currentColor" stroke="none" />
                ))}
              </span>
              <p className="rev-quote">&ldquo;{t(`testimonials.${item.key}.text`)}&rdquo;</p>
              <div className="rev-who">
                <span className={`rav ${item.rav}`}>{item.initials}</span>
                <div>
                  <b>{item.name}</b>
                  <span>{item.website}</span>
                </div>
                <span className="chip chip-grey">{t("testimonials.verified")}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
