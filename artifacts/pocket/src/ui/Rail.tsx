// Tablet.dc.html: at tablet width the floating tab bar becomes a rail on the left (96 wide): Home, Quotes, Jobs, Clients, Invoices, Schedule, then Menu
// and the person's avatar (Profile) at the bottom. The active item sits on the sunk ground in ink 600; the others are grey and quiet. Same screens and the
// same rule as the tab bar: shown wherever the bar would be (`barHiddenOn`).
import { useWindowDimensions, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activeTabOf, barHiddenOn } from "@/lib/barRoutes";
import { useCrewSession } from "@/lib/crewSession";
import { initialsOf } from "@/lib/invites";
import { BUILT, screenHref } from "@/lib/nav";
import { TAB_SCREEN } from "@/lib/roleTabs";
import { useSession } from "@/lib/useSession";
import { Avatar } from "./Avatar";
import { Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** The board's breakpoint: the tablet layout from 1024 wide (a tablet held sideways); below it, the phone layout. */
export const WIDE_MIN = 1024;
export const useWide = (): boolean => useWindowDimensions().width >= WIDE_MIN;

const RAIL: [key: string, icon: IconName, tone: Tone][] = [
  ["home", "house", "amber"], ["quotes", "doc", "violet"], ["jobs", "cone", "amber"], ["clients", "users", "sage"], ["invoices", "receipt", "rose"], ["schedule", "cal", "azure"],
];

function Item({ icon, tone, label, on, onPress }: { icon: IconName; tone: Tone; label: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="link" accessibilityState={{ selected: on }} accessibilityLabel={label}
      style={{ width: 76, minHeight: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: on ? colors.sunk : "transparent" }}>
      <View style={{ opacity: on ? 1 : 0.55 }}><Icon name={icon} tone={on ? tone : "slate"} size={24} /></View>
      <Text size={11.5} weight={on ? 600 : 500} color={on ? "ink" : "muted"}>{label}</Text>
    </Press>
  );
}

/** The rail where the tab bar would be, at tablet width (root layout, left of the screens). */
export function RailSlot() {
  const wide = useWide();
  const path = usePathname();
  const { status } = useSession();
  const crew = useCrewSession();
  const show = wide && (status === "in" || status === "offline") && !crew.token && !barHiddenOn(path);
  return show ? <Rail /> : null;
}

export function Rail() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const { user } = useSession();
  const routes = Object.fromEntries(RAIL.map(([k]) => [k, (BUILT as Record<string, string>)[TAB_SCREEN[k] ?? ""]]));
  const active = activeTabOf(path, routes);
  const go = (k: string) => {
    if (k === active) return;
    const href = screenHref(TAB_SCREEN[k] ?? "SmartHome", t(`jr.tab.${k}`));
    if (typeof href === "object" && href.pathname === "/coming-soon") router.push(href);
    else router.replace(href);
  };
  return (
    <View accessibilityRole="tablist" accessibilityLabel={t("tabs.main")}
      style={{ width: 96, alignItems: "center", gap: 4, paddingTop: insets.top + 22, paddingBottom: insets.bottom + 22, borderRightWidth: 1, borderRightColor: colors.line, backgroundColor: colors.ground }}>
      {RAIL.map(([k, icon, tone]) => <Item key={k} icon={icon} tone={tone} label={t(`jr.tab.${k}`)} on={k === active} onPress={() => go(k)} />)}
      <View style={{ flex: 1 }} />
      <Item icon="list" tone="slate" label={t("tb.rail.menu")} on={path === "/menu"} onPress={() => router.push(screenHref("Menu", t("tb.rail.menu")))} />
      <Press onPress={() => router.push(screenHref("Profile", user?.name ?? ""))} accessibilityRole="link" accessibilityLabel={t("tb.rail.profile", { name: user?.name ?? "" })} style={{ marginTop: 8 }}>
        <Avatar initials={initialsOf(user?.name ?? "")} tint={2} size={44} />
      </Press>
    </View>
  );
}
