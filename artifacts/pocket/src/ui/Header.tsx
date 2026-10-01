// COMPONENTS §7 (.hdr): 52 tall, padding 8 8 0, three columns: a 44 back button, a centred title
// 15/600 (−0.02em, one line with ellipsis), a 44 "more" button. Tab screens use PageTitle
// (.ptitle 30/600, −0.045em, 1.1) instead. Icon buttons always carry a label.
import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Text } from "./Text";

export function IconButton({ glyph, label, onPress }: { glyph: "back" | "more" | "close" | "search" | "plus" | "gear"; label: string; onPress?: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
      <Glyph name={glyph} size={22} />
    </Press>
  );
}

export function Header({ title, onBack, backLabel, onMore, moreLabel, moreGlyph = "more", subtle }: { title: string; /** A reference (a quote number), not a name: 12.5 muted instead of 15/600. */ subtle?: boolean; onBack?: () => void; backLabel: string; onMore?: () => void; moreLabel?: string; moreGlyph?: "more" | "gear" }) {
  const insets = useSafeAreaInsets(); // the header sits below the status bar
  return (
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 52 + insets.top, paddingTop: 8 + insets.top, paddingHorizontal: 8 }}>
      <View style={{ width: 44 }}>{onBack ? <IconButton glyph="back" label={backLabel} onPress={onBack} /> : null}</View>
      <Text size={subtle ? 12.5 : undefined} weight={subtle ? 400 : 600} color={subtle ? "muted" : "ink"} tracking={subtle ? 0 : -0.02} align="center" numberOfLines={1} accessibilityRole="header" style={{ flex: 1 }}>{title}</Text>
      <View style={{ width: 44 }}>{onMore && moreLabel ? <IconButton glyph={moreGlyph} label={moreLabel} onPress={onMore} /> : null}</View>
    </View>
  );
}

export function PageTitle({ children }: { children: string }) {
  return <Text size={30} weight={600} tracking={-0.045} leading={1.1} accessibilityRole="header">{children}</Text>;
}

/** A tab screen's top: the large page title on the left and its actions on the right (padding 18 12 0 20 below the status bar). */
export function TabHeader({ title, children }: { title: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 18 + insets.top, paddingLeft: 20, paddingRight: 12 }}>
      <PageTitle>{title}</PageTitle>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>{children}</View>
    </View>
  );
}
