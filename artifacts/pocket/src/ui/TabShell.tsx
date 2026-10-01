// A tab screen: the screen on its ground with the floating glass tab bar and the assistant orb
// over it (COMPONENTS §8). Home, Quotes, Jobs and Clients share it. The orb is the assistant, built in phase 128.
import type { ReactNode } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { screenHref } from "@/lib/nav";
import { Screen } from "./Screen";
import { TabBar, type TabKey } from "./TabBar";
import { useToast } from "./Feedback";

export function TabScreen({ active, children }: { active: TabKey; children: ReactNode }) {
  const { t } = useTranslation();
  const toast = useToast();
  const labels: Record<TabKey, string> = { home: t("tabs.home"), quotes: t("tabs.quotes"), jobs: t("tabs.jobs"), clients: t("tabs.clients") };
  const go = (k: TabKey) => {
    if (k === active) return;
    const name = k === "home" ? "SmartHome" : k === "quotes" ? "Quotes" : k === "jobs" ? "Jobs" : "Clients";
    // A tab not built yet opens Coming soon on top; a built one replaces the screen.
    const href = screenHref(name, labels[k]);
    if (typeof href === "object" && href.pathname === "/coming-soon") router.push(href);
    else router.replace(href);
  };
  return (
    <Screen floating={<TabBar active={active} onTab={go} labels={labels} label={t("tabs.main")} orbLabel={t("tabs.orb")} onOrb={() => toast({ message: t("tabs.orbSoon") })} />}>
      {children}
    </Screen>
  );
}
