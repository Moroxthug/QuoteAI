// Menu.dc.html pieces that only the Menu uses.
// MenuIdentity: an 88 round `inv` avatar (30/600, −0.03em) with a 4 ground ring and a 1.5 `line2`
// ring outside it, a 26 round camera badge on its lower right; the name 24/600 (−0.035em); the
// company and role 13.5 muted. MenuPlanHead: the plan card (`card`, radius 22, ring): a 36 plan
// icon, the plan name 16/600 with an accent tag, a 12.5 muted line, a 15 chevron in a 28 circle.
// MenuQuick: three equal cards (radius 20, ring, padding 16/4/14): a 30 icon over a 12.5/500 label.
// MenuGroup: a 17/600 title (−0.025em) at 20 over a card holding the rows.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Card } from "./Card";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Tag } from "./Status";
import { Text } from "./Text";
import { useTheme } from "./theme";

export function MenuIdentity({ initials, name, sub, photoLabel, onPhoto, onName }: { initials: string; name: string; sub: string; photoLabel: string; onPhoto?: () => void; onName?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 20, paddingTop: 6 }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 4px ${colors.ground}, 0 0 0 5.5px ${colors.line2}` }}>
        <Text size={30} weight={600} color="on-inv" tracking={-0.03} allowFontScaling={false}>{initials}</Text>
        <Press onPress={onPhoto} accessibilityRole="button" accessibilityLabel={photoLabel}
          style={{ position: "absolute", right: -2, bottom: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 1px ${colors.ring}` }}>
          <Glyph name="camera" size={13} color="ink" />
        </Press>
      </View>
      <Press onPress={onName} accessibilityRole="button" style={{ marginTop: 16, minHeight: 32, justifyContent: "center" }}>
        <Text size={24} weight={600} tracking={-0.035} numberOfLines={1}>{name}</Text>
      </Press>
      <Text size={13.5} color="muted" style={{ marginTop: 4 }} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

export function MenuPlanHead({ plan, tag, line, label, onPress }: { plan: string; tag: string; line: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card>
      <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
        style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 15, paddingBottom: 15, paddingLeft: 16, paddingRight: 14 }}>
        <Icon name="tier3" tone="violet" size={36} />
        <View style={{ flexGrow: 1, flexShrink: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text size={16} weight={600} tracking={-0.02}>{plan}</Text>
            <Tag accent>{tag}</Tag>
          </View>
          <Text size={12.5} color="muted" leading={1.35}>{line}</Text>
        </View>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center" }}>
          <Glyph name="chevronDown" size={15} color="ink" />
        </View>
      </Press>
    </Card>
  );
}

export function MenuQuick({ items }: { items: { icon: IconName; tone: Tone; label: string; onPress: () => void }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {items.map((q) => (
        <Press key={q.label} onPress={q.onPress} accessibilityRole="button" accessibilityLabel={q.label}
          style={{ flex: 1, alignItems: "center", gap: 9, paddingTop: 16, paddingBottom: 14, paddingHorizontal: 4, borderRadius: 20, backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.ring}` }}>
          <Icon name={q.icon} tone={q.tone} size={30} />
          <Text size={12.5} weight={500} numberOfLines={1}>{q.label}</Text>
        </Press>
      ))}
    </View>
  );
}

export function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <Text size={17} weight={600} tracking={-0.025} style={{ marginHorizontal: 20, marginTop: 26, marginBottom: 10 }} accessibilityRole="header">{title}</Text>
      <View style={{ marginHorizontal: 16 }}>
        <Card>{children}</Card>
      </View>
    </View>
  );
}

/** The board's sign-out card: one centred row, 15/500 in `bad`, min 54. */
export function MenuSignOut({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Card>
      <Press onPress={onPress} accessibilityRole="button" style={{ minHeight: 54, alignItems: "center", justifyContent: "center" }}>
        <Text weight={500} color="bad">{label}</Text>
      </Press>
    </Card>
  );
}
