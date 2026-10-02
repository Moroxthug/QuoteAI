// A role's home (RoleHomes.dc.html): the person's sections in their order, each bound to what the app already has (Needs you, money, quotes, today, weather) or, where it has nothing yet, a card that
// opens the screen it belongs to and says so. NOT BUILT: safety (certificates, incidents, toolbox talks, inspections) and the bookkeeper's reconcile, receipts and HST have no counts on the server.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { SECTIONS } from "@/lib/jobRoles";
import { screenHref } from "@/lib/nav";
import { RoleLine, RoleSection } from "@/ui/RoleSection";
import { WidgetRow } from "@/ui/Widgets";
import { Section } from "@/ui/Layout";
import type { IconName, Tone } from "@/ui/Icon";
import type { WidgetEntry } from "./widgets";

const GO: Record<string, [string, string]> = {
  visits: ["Schedule", "schedule"], win: ["Analytics", "analytics"], leads: ["Leads", "leads"], atRisk: ["Jobs", "jobs"], activeJobs: ["Jobs", "jobs"], budget: ["Jobs", "jobs"], changeOrders: ["Jobs", "jobs"],
  crewNow: ["CrewMap", "map"], unassigned: ["Schedule", "schedule"], tomorrow: ["Schedule", "schedule"], reconcile: ["Books", "books"], receipts: ["Documents", "docs"], hst: ["Books", "books"], comingUp: ["Books", "books"],
  certificates: ["Compliance", "compliance"], incidents: ["Compliance", "compliance"], toolbox: ["Compliance", "compliance"], inspections: ["Compliance", "compliance"],
  clock: ["CrewHours", "hours"], blockers: ["Jobs", "jobs"], crewToday: ["CrewNow", "crew"], tasks: ["Jobs", "jobs"], tasksToday: ["CrewHours", "hours"], reports: ["Documents", "docs"], crew: ["Crew", "crew"],
  needs: ["Notifications", "notifications"], money: ["Invoices", "invoices"], quotes: ["Quotes", "quotes"], waiting: ["Quotes", "quotes"], today: ["Schedule", "schedule"], week: ["Schedule", "schedule"], weather: ["Schedule", "schedule"],
};
const WIDGETS: Record<string, string[]> = { money: ["collected", "owed"], quotes: ["quotes"], waiting: ["followups"], today: ["tasks"], week: ["tasks"], weather: ["weather"] };

export function RoleSections({ sections, entries, needs }: { sections: { key: string; on: boolean }[]; entries: WidgetEntry[]; needs: ReactNode }) {
  const { t } = useTranslation();
  return (
    <>
      {sections.filter((s) => s.on).map((s) => {
        const def = SECTIONS[s.key]!;
        const name = (t(`jr.sec.${s.key}`, { returnObjects: true }) as unknown as string[]);
        const go = GO[s.key] ?? ["Notifications", "notifications"];
        const open = () => router.push(screenHref(go[0]!, name[0] ?? ""));
        const mine = entries.filter((e) => (WIDGETS[s.key] ?? []).includes(e.id));
        // What the app already has for a section is drawn exactly as on Home (the cards that open in place); only a section with nothing behind it is a plain card that opens its screen.
        if (s.key === "needs") return <Section key={s.key}>{needs}</Section>;
        if (mine.length) return <Section key={s.key}><WidgetRow title={name[0] ?? s.key} ids={mine.map((e) => e.id)}>{mine.map((e) => e.node)}</WidgetRow></Section>;
        return (
          <RoleSection key={s.key} icon={def.icon as IconName} tone={def.tone as Tone} title={name[0] ?? s.key} sub={name[1] ?? ""} link={t("jr.rh.seeAll")} onLink={open}>
            <RoleLine>{t("jr.rh.notBuilt")}</RoleLine>
          </RoleSection>
        );
      })}
    </>
  );
}
