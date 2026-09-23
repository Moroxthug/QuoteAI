import { Link } from "wouter";
import { CalendarRange, Clock, FolderKanban } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import { CalendarCard } from "@/components/dashboard/calendar-card";
import { CrewTodayCard } from "./crew-today-card";

/**
 * Phase 86 — the foreman's own landing page. Until now a foreman signed in to
 * the owner's dashboard with the quote and revenue parts greyed out: a page
 * about selling, for someone whose job is running today's sites. This one
 * answers their three questions in order — who is where, what is stuck,
 * whose hours are waiting — then the month.
 */
export function ForemanHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")?.[0] || "";
  const links = [
    { href: "/dashboard/schedule", icon: CalendarRange, label: t("crew.link.schedule") },
    { href: "/dashboard/jobs", icon: FolderKanban, label: t("crew.link.jobs") },
    { href: "/dashboard/team?tab=time", icon: Clock, label: t("crew.link.hours") },
  ];
  return (
    <div className="animate-in fade-in duration-500" data-testid="foreman-home">
      <div className="page-head">
        <div>
          <h1>{firstName ? t("dashboard.index.greetingName").replace("{name}", firstName) : t("dashboard.index.greetingFallback")}</h1>
          <p className="sub">{t("crew.foremanSub")}</p>
        </div>
        <div className="head-actions">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="btn btn-sm btn-outline-navy"><l.icon className="h-4 w-4" /> {l.label}</Link>
          ))}
        </div>
      </div>
      <div className="stack">
        <CrewTodayCard variant="foreman" />
        <CalendarCard />
      </div>
    </div>
  );
}
