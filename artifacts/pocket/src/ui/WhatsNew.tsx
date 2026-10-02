// WhatsNew.dc.html: the sheet's stage (an overdue invoice row slid left to show its "Got paid" tile, the board's demonstration of the swipe), the version tag and the feature rows.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Icon, type IconName, type Tone } from "./Icon";
import { Status, Tag } from "./Status";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

/** The stage: a `soft` box with the action tile on the right and the row slid left over it. */
export function SwipeDemo({ tile, who, number, amount, late }: { tile: string; who: string; number: string; amount: string; late: string }) {
  const { colors } = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 96, borderRadius: 22, backgroundColor: colors.soft, overflow: "hidden", justifyContent: "center" }}>
      <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 78, backgroundColor: colors["info-soft"], alignItems: "center", justifyContent: "center", gap: 5 }}>
        <Icon name="check" tone="sky" size={22} />
        <Text size={12.5} weight={600} color="info" align="center">{tile}</Text>
      </View>
      <View style={{ marginRight: 78, height: 96, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center" }}><Text size={12.5} weight={600} allowFontScaling={false}>TH</Text></View>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{who}</Text>
          <Num size={12.5} color="muted">{number}</Num>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Num size={14.5} weight={600}>{amount}</Num>
          <Status tone="bad" shape="alert">{late}</Status>
        </View>
      </View>
    </View>
  );
}

export function VersionTag({ label, version }: { label: string; version: string }) {
  return <View style={{ alignItems: "center", marginTop: 6 }}><Tag>{`${label} ${version}`}</Tag></View>;
}

/** One feature: its glyph, a 15/600 title and a 13.5 muted paragraph. */
export function Feature({ icon, tone, title, text }: { icon: IconName; tone: Tone; title: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 10 }}>
      <View style={{ width: 32, alignItems: "center" }}><Icon name={icon} tone={tone} size={32} /></View>
      <View style={{ flexShrink: 1, gap: 3 }}>
        <Text size={15} weight={600}>{title}</Text>
        <Text size={13.5} color="muted" leading={1.45}>{text}</Text>
      </View>
    </View>
  );
}

export function SheetBody({ children }: { children: ReactNode }) {
  return <View style={{ paddingHorizontal: 20, paddingBottom: 28 }}>{children}</View>;
}

/** "What's new" at 28/600, centred. */
export function BigTitle({ children }: { children: string }) {
  return <Text size={28} weight={600} tracking={-0.04} align="center" style={{ marginTop: 10 }} accessibilityRole="header">{children}</Text>;
}

export function FeatureList({ children }: { children: ReactNode }) {
  return <View style={{ marginTop: 12 }}>{children}</View>;
}

export function SheetActions({ children }: { children: ReactNode }) {
  return <View style={{ marginTop: 16, gap: 4 }}>{children}</View>;
}
