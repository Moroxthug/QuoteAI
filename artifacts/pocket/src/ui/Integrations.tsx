// Integrations.dc.html: the two-up grid of app tiles (the app's glyph, its category, name and what it does, and at the foot a Connect button, "Coming soon" or the plan it needs),
// the dashed "Missing an app?" tile, and the first-time card.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Button } from "./Button";
import { Card } from "./Card";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Tag } from "./Status";
import { Text } from "./Text";
import { useTheme } from "./theme";

export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{children}</View>;
}

/** One app: the glyph (given), the category in faint, the name, what it does, and the foot. */
export function AppTile({ icon, category, name, desc, foot }: { icon: ReactNode; category?: string; name: string; desc: string; foot: ReactNode }) {
  return (
    <View style={{ width: "48.5%", flexGrow: 1 }}>
      <Card style={{ minHeight: 150, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 12, alignItems: "flex-start", gap: 4 }}>
        {icon}
        {category ? <Text size={11.5} weight={500} color="faint" style={{ marginTop: 10 }}>{category}</Text> : null}
        <Text size={14.5} weight={600} tracking={-0.02} leading={1.25} style={{ marginTop: category ? 1 : 8 }}>{name}</Text>
        <Text size={12.5} color="muted" leading={1.35} style={{ flexGrow: 1 }}>{desc}</Text>
        <View style={{ alignSelf: "stretch", marginTop: 10, minHeight: 36, justifyContent: "center", alignItems: "flex-start" }}>{foot}</View>
      </Card>
    </View>
  );
}

/** The tile's foot: a full-width button. */
export function TileButton({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  return <View style={{ alignSelf: "stretch" }}><Button size="sm" kind="secondary" block label={label} onPress={onPress} disabled={busy} /></View>;
}

/** "Included in Elite" with a lock, on `acc-soft`. */
export function PlanTag({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Tag accent>{children}</Tag>
    </View>
  );
}

/** The dashed tile that asks which app is missing. */
export function SuggestTile({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: "48.5%", flexGrow: 1 }}>
      <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`}
        style={{ minHeight: 150, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line2, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 12, alignItems: "flex-start", gap: 4 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center" }}><Glyph name="plus" size={16} color="muted" /></View>
        <Text size={14.5} weight={600} tracking={-0.02} leading={1.25} style={{ marginTop: 10 }}>{title}</Text>
        <Text size={12.5} color="muted" leading={1.35}>{sub}</Text>
      </Press>
    </View>
  );
}

/** "Nothing connected yet": a sync glyph (given), the title and a line, in a card. */
export function FirstCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <Card style={{ paddingTop: 20, paddingHorizontal: 18, paddingBottom: 18 }}>
      {icon}
      <Text size={19} weight={600} tracking={-0.03} leading={1.25} style={{ marginTop: 12 }} accessibilityRole="header">{title}</Text>
      <Text size={13.5} color="muted" leading={1.45} style={{ marginTop: 5 }}>{body}</Text>
    </Card>
  );
}

/** The line under the page title: how many are connected. */
export function PageLede({ children }: { children: string }) {
  return <Text size={13.5} color="muted" style={{ marginTop: 6 }}>{children}</Text>;
}

/** A small note at the foot of the page (the plan note in muted, the trademark line in faint). */
export function FootNote({ children, faint }: { children: string; faint?: boolean }) {
  return <Text size={faint ? 11.5 : 12.5} color={faint ? "faint" : "muted"} leading={faint ? 1.5 : 1.45} style={{ marginHorizontal: 20, marginTop: faint ? 22 : 14 }}>{children}</Text>;
}
