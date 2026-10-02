// A tab screen: the screen on its ground with the floating glass tab bar and the assistant orb over it (COMPONENTS §8). The bar is Home and the person's three tabs (their role's, or their own
// choice in Customize home); below Business it is the four the app started with. The orb opens the assistant layer (app/assistant.tsx). `RoleTabs` puts the same bar on any other screen that is one of the person's tabs.
import type { ReactNode } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { barHas, barOf, TAB_SCREEN } from "@/lib/roleTabs";
import { screenHref } from "@/lib/nav";
import { useJobRole } from "@/lib/useJobRole";
import { Screen, useRegisterTabInset } from "./Screen";
import { TabBar, TAB_BAR_SPACE, type TabKey } from "./TabBar";

function useBar(): string[] {
  const { me, tabs } = useJobRole();
  return barOf(me.included ? tabs : null);
}

function Bar({ active, bar }: { active: TabKey; bar: string[] }) {
  const { t } = useTranslation();
  const labels: Record<TabKey, string> = Object.fromEntries(bar.map((k) => [k, t(`jr.tab.${k}`)]));
  const go = (k: TabKey) => {
    if (k === active) return;
    // A tab not built yet opens Coming soon on top; a built one replaces the screen.
    const href = screenHref(TAB_SCREEN[k] ?? "SmartHome", labels[k] ?? "");
    if (typeof href === "object" && href.pathname === "/coming-soon") router.push(href);
    else router.replace(href);
  };
  return <TabBar active={active} onTab={go} labels={labels} keys={bar} label={t("tabs.main")} orbLabel={t("tabs.orb")} onOrb={() => router.push(screenHref("Assistant", t("tabs.orb")))} />;
}

export function TabScreen({ active, children }: { active: TabKey; children: ReactNode }) {
  const bar = useBar();
  return <Screen floating={<Bar active={active} bar={bar} />}>{children}</Screen>;
}

/** Put in a screen's `floating` slot: shows the bar when that screen is one of the person's tabs, and makes the page leave room for it. */
export function RoleTabs({ active }: { active: TabKey }) {
  const bar = useBar();
  const show = barHas(bar, active);
  useRegisterTabInset(show ? TAB_BAR_SPACE : 0);
  return show ? <Bar active={active} bar={bar} /> : null;
}

/** Whether `active` is one of the person's tabs (a screen that has its own floating button gives way to the bar then). */
export function useIsTab(active: TabKey): boolean {
  return barHas(useBar(), active);
}
