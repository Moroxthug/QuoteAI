// The tab bar and the assistant orb on every screen a signed-in person uses (not sign-in, setup, the assistant itself, or a crew phone). It sits above the screens, so it stays put as they change,
// and goes away while the keyboard is open. Home and the person's three tabs (their role's, or their own choice in Customize home); the active one is the screen they are on.
import { useEffect, useState } from "react";
import { Keyboard } from "react-native";
import { router, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";
import { activeTabOf, barHiddenOn } from "@/lib/barRoutes";
import { setBarVisible } from "@/lib/barStore";
import { useCrewSession } from "@/lib/crewSession";
import { BUILT, screenHref } from "@/lib/nav";
import { barOf, TAB_SCREEN } from "@/lib/roleTabs";
import { useJobRole } from "@/lib/useJobRole";
import { useSession } from "@/lib/useSession";
import { TabBar } from "./TabBar";

export function GlobalTabBar() {
  const { t } = useTranslation();
  const path = usePathname();
  const { status } = useSession();
  const crew = useCrewSession();
  const { me, tabs } = useJobRole();
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener("keyboardDidShow", () => setTyping(true));
    const b = Keyboard.addListener("keyboardDidHide", () => setTyping(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  const show = (status === "in" || status === "offline") && !crew.token && !barHiddenOn(path) && !typing;
  useEffect(() => { setBarVisible(show); return () => setBarVisible(false); }, [show]);
  if (!show) return null;

  const bar = barOf(me.included ? tabs : null);
  const labels = Object.fromEntries(bar.map((k) => [k, t(`jr.tab.${k}`)]));
  const routes = Object.fromEntries(bar.map((k) => [k, (BUILT as Record<string, string>)[TAB_SCREEN[k] ?? ""]]));
  const active = activeTabOf(path, routes) ?? "";
  const go = (k: string) => {
    if (k === active) return;
    // A tab not built yet opens Coming soon on top; a built one replaces the screen.
    const href = screenHref(TAB_SCREEN[k] ?? "SmartHome", labels[k] ?? "");
    if (typeof href === "object" && href.pathname === "/coming-soon") router.push(href);
    else router.replace(href);
  };
  return <TabBar active={active} onTab={go} labels={labels} keys={bar} label={t("tabs.main")} orbLabel={t("tabs.orb")} onOrb={() => router.push(screenHref("Assistant", t("tabs.orb")))} />;
}
