// COMPONENTS §19 and the People section of Components.dc.html.
// Avatar (.av): 38, round, initials 12.5/600. Five tints: tn1 green, tn2 violet, tn3 amber,
// tn4 blue, tn5 neutral (`av` / `ink`). `me`: 48, initials 15 on `inv` / `on-inv`.
// A photo fills the circle; until there is one, the board's blue placeholder with a user icon.
// Presence ring (.cp-ring): 2.5 of the ground, then 2 of the state colour (on site `ok-dot`,
// later today `warn-dot`, off `line2`). Always with a word nearby (the legend or the name).
// CompanyLogo: 44, radius 12, `card` with a 1 px `line2` ring, a 26 building icon (or the logo).
import { Image, View, type ImageSourcePropType } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { board } from "@/theme/board";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { useTheme, type ColorName, type Colors } from "./theme";

export type AvatarTint = 1 | 2 | 3 | 4 | 5;
export type Presence = "on" | "later" | "off";

export function avatarTint(tint: AvatarTint, colors: Colors): { bg: string; fg: ColorName } {
  switch (tint) {
    case 1: return { bg: colors["ok-soft"], fg: "ok" };
    case 2: return { bg: colors["acc-soft"], fg: "acc-soft-t" };
    case 3: return { bg: board.warnSoft, fg: "warn" };
    case 4: return { bg: colors["info-soft"], fg: "info" };
    case 5: return { bg: colors.av, fg: "ink" };
  }
}

function presenceRing(p: Presence, colors: Colors): string {
  const c = p === "on" ? colors["ok-dot"] : p === "later" ? colors["warn-dot"] : colors.line2;
  return `0 0 0 2.5px ${colors.ground}, 0 0 0 4.5px ${c}`;
}

type Props = {
  initials: string;
  tint?: AvatarTint;
  size?: number;
  /** The signed-in person: 48, `inv`, initials 15. */
  me?: boolean;
  photo?: ImageSourcePropType | "placeholder";
  presence?: Presence;
  /** Who it is, when the name isn't next to it. */
  label?: string;
};

export function Avatar({ initials, tint = 5, size, me, photo, presence, label }: Props) {
  const { colors } = useTheme();
  const d = size ?? (me || photo ? 48 : 38);
  const t = me ? { bg: colors.inv, fg: "on-inv" as ColorName } : avatarTint(tint, colors);
  const round = { width: d, height: d, borderRadius: d / 2 };
  return (
    <View accessible={!!label} accessibilityLabel={label} importantForAccessibility={label ? "yes" : "no-hide-descendants"}
      style={[round, { backgroundColor: t.bg, alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", boxShadow: presence ? presenceRing(presence, colors) : undefined }]}>
      {photo === "placeholder" ? (
        <LinearGradient colors={[board.photoFrom, board.photoTo]} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={[round, { alignItems: "center", justifyContent: "center" }]}>
          <Icon name="user" tone="slate" size={26} />
        </LinearGradient>
      ) : photo ? (
        <Image source={photo} style={round} />
      ) : (
        <Text size={me ? 15 : 12.5} weight={600} color={t.fg} allowFontScaling={false}>{initials}</Text>
      )}
    </View>
  );
}

export function CompanyLogo({ logo, label }: { logo?: ImageSourcePropType; label?: string }) {
  const { colors } = useTheme();
  return (
    <View accessible={!!label} accessibilityLabel={label}
      style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.line2}`, alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
      {logo ? <Image source={logo} style={{ width: 44, height: 44 }} /> : <Icon name="building" tone="violet" size={26} />}
    </View>
  );
}

/** The presence legend (.cp-legend): 8 dots with a 12.5 muted word, gap 6, rows gap 14. */
export function PresenceLegend({ items }: { items: { presence: Presence; label: string }[] }) {
  const { colors } = useTheme();
  const dot = (p: Presence) => (p === "on" ? colors["ok-dot"] : p === "later" ? colors["warn-dot"] : colors.line2);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
      {items.map((it) => (
        <View key={it.presence} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot(it.presence) }} />
          <Text size={12.5} color="muted">{it.label}</Text>
        </View>
      ))}
    </View>
  );
}
