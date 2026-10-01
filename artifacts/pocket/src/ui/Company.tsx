// The company pieces the join screens share (JoinCode, Invites and CompanyPicker boards).
// CompanyTile (.jc-co / .iv-co): a `sunk` square, radius 14 (15 at 48), holding a gradient icon.
// CanList (.jc-can / .iv-can): ticks in `ok` and 13.5 muted lines, gap 10.
// PickRadio (.iv-radio): a 22 ring that fills to a 7 `inv` ring when chosen.
// CompanyChoice (.cp-co): the picker's row, radius 22, a 46 initials logo, name 15/600, a role tag and
// city, a "last opened" line; chosen it takes a 2 `ink` ring and an `inv` round tick; "No access" rows
// sit at 55 % with a status.
import type { ReactNode } from "react";
import { View } from "react-native";
import { tokens } from "@/theme/tokens";
import { avatarTint, type AvatarTint } from "./Avatar";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { shadow } from "./shadow";
import { Status, Tag } from "./Status";
import { Text } from "./Text";
import { useTheme } from "./theme";

export function CompanyTile({ size = 44, icon = "building", tone = "violet" }: { size?: 44 | 48; icon?: IconName; tone?: Tone }) {
  const { colors } = useTheme();
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: size === 48 ? 15 : 14, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon name={icon} tone={tone} size={size === 48 ? 30 : 28} />
    </View>
  );
}

export function CanList({ items }: { items: string[] }) {
  return (
    <View style={{ gap: 10 }}>
      {items.map((line) => (
        <View key={line} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
          <View style={{ marginTop: 1 }}><Glyph name="check" size={16} color="ok" /></View>
          <Text size={13.5} color="muted" leading={1.4} style={{ flexShrink: 1 }}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

export function PickRadio({ on }: { on: boolean }) {
  const { colors } = useTheme();
  return (
    <View importantForAccessibility="no-hide-descendants"
      style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, borderWidth: on ? 7 : 1.5, borderColor: on ? colors.inv : colors.line2, backgroundColor: on ? colors.card : "transparent" }} />
  );
}

export function CompanyChoice({ initials, tint, name, role, accent, meta, last, selected, gone, goneLabel, onPress }: {
  initials: string; tint: AvatarTint; name: string; role: string; accent?: boolean; meta?: string; last?: string;
  selected: boolean; gone?: boolean; goneLabel: string; onPress: () => void;
}) {
  const { colors } = useTheme();
  const t = avatarTint(tint, colors);
  let end: ReactNode = null;
  if (gone) end = <View><Status tone="mute">{goneLabel}</Status></View>;
  else end = (
    <View importantForAccessibility="no-hide-descendants"
      style={{ width: 24, height: 24, borderRadius: 12, flexShrink: 0, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.inv : "transparent", borderWidth: selected ? 0 : 2, borderColor: colors.line2 }}>
      {selected ? <Glyph name="check" size={13} color="on-inv" /> : null}
    </View>
  );
  const label = [name, role, last, gone ? goneLabel : null].filter(Boolean).join(", ");
  return (
    <Press onPress={gone ? undefined : onPress} disabled={!!gone} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected && !gone, disabled: !!gone }}
      style={{
        flexDirection: "row", alignItems: "center", gap: 14, minHeight: 44, paddingVertical: 14, paddingHorizontal: 16, borderRadius: tokens.radius.card, backgroundColor: colors.card, opacity: gone ? 0.55 : 1,
        boxShadow: selected && !gone ? `0 0 0 2px ${colors.ink}, 0 14px 30px -20px ${colors.shadow}` : shadow("ring", colors),
      }}>
      <View importantForAccessibility="no-hide-descendants" style={{ width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: t.bg, flexShrink: 0 }}>
        <Text size={15} weight={600} color={t.fg} allowFontScaling={false}>{initials}</Text>
      </View>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 4 }}>
        <Text size={15} weight={600} tracking={-0.015} numberOfLines={1}>{name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
          <View><Tag accent={accent}>{role}</Tag></View>
          {meta ? <Text size={12.5} color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{meta}</Text> : null}
        </View>
        {last ? <Text size={12.5} color="muted" numberOfLines={1}>{last}</Text> : null}
      </View>
      {end}
    </Press>
  );
}
