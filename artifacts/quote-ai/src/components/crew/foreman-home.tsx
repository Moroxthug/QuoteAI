import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import { NextUpCard } from "@/components/dashboard/today";
import { CrewBlockers, CrewFromTheField, CrewLocked, CrewWhoIsWhere, HoursToApprove } from "./crew-today-card";

/**
 * Phase 86 — the foreman's own landing page: a page about running today's
 * sites, not the owner's page about selling.
 *
 * Phase 108: the same calm layout as the owner's Today. What is stuck comes
 * first (only when something is), then who is where, the hours waiting (a
 * swipe list on a phone), what came in from the field, and the next five
 * things instead of a month grid. No row of shortcut buttons — Jobs, Schedule
 * and Crew are the bottom tabs on a phone and the sidebar on a desktop.
 */
export function ForemanHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")?.[0] || "";
  return (
    <div className="today animate-in fade-in duration-500" data-testid="foreman-home">
      <div className="page-head">
        <div>
          <h1>{firstName ? t("dashboard.index.greetingName").replace("{name}", firstName) : t("dashboard.index.greetingFallback")}</h1>
          <p className="sub">{t("crew.foremanSub")}</p>
        </div>
      </div>
      <div className="today-grid">
        <div className="today-main">
          <CrewLocked />
          <CrewBlockers />
          <CrewWhoIsWhere />
          <HoursToApprove />
        </div>
        <div className="today-side">
          <CrewFromTheField />
          <NextUpCard />
        </div>
      </div>
    </div>
  );
}
