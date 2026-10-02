// SetRoles.dc.html and CustomizeHome.dc.html: a role row you pick (its glyph, who has it, up to two avatars and a radio), the block of a role's defaults (numbered section chips, tab
// chips), the person chips for the sensitive switches; and the home editor's pieces: a section row you lift to move, the miniature tab bar, the tab tiles and the density preview.
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Avatar } from "./Avatar";
import { Card, Hairline } from "./Card";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

export function RoleRow({ first, icon, tone, name, who, avatars, on, onPress }: { first?: boolean; icon: IconName; tone: Tone; name: string; who: string; avatars: { initials: string; tint: 1 | 2 | 3 | 4 | 5 }[]; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <Press onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${name}, ${who}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 60, backgroundColor: on ? colors.soft : "transparent" }}>
        <Icon name={icon} tone={tone} size={28} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}>{who}</Text>
        </View>
        <View style={{ flexDirection: "row", marginRight: 2 }}>{avatars.map((a, i) => <View key={i} style={{ marginLeft: i ? -10 : 0 }}><Avatar initials={a.initials} tint={a.tint} size={28} /></View>)}</View>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: on ? colors.inv : "transparent", borderWidth: on ? 0 : 1.6, borderColor: colors.line2, alignItems: "center", justifyContent: "center" }}>{on ? <Glyph name="check" size={13} color="on-inv" weight={3} /> : null}</View>
      </Press>
    </View>
  );
}

/** A block inside the defaults card: its padding and a hairline above all but the first. */
export function Block({ first, children }: { first?: boolean; children: ReactNode }) {
  return <View>{first ? null : <Hairline inset={0} />}<View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>{children}</View></View>;
}

/** "Home, in this order" with an Edit link on the right. */
export function BlockLabel({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <Text size={12.5} weight={500} color="muted">{label}</Text>
      {action && onAction ? <Press onPress={onAction} accessibilityRole="link" accessibilityLabel={`${action}, ${label}`} hitSlop={8}><Text size={13.5} weight={500} color="acc-t">{action}</Text></Press> : null}
    </View>
  );
}

/** The role's home sections as numbered chips. */
export function NumberedChips({ items }: { items: { n: number; text: string }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {items.map((c) => (
        <View key={c.n} style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingLeft: 8, paddingRight: 11, borderRadius: 999, backgroundColor: colors.sunk }}>
          <Num size={11.5} weight={600} color="muted">{String(c.n)}</Num>
          <Text size={13.5} weight={500}>{c.text}</Text>
        </View>
      ))}
    </View>
  );
}

/** The role's tabs: the first (Home) is the dark one. */
export function TabChips({ items }: { items: string[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {items.map((t, i) => (
        <View key={t} style={{ height: 30, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: i === 0 ? colors.inv : colors.sunk }}>
          <Text size={13.5} weight={500} color={i === 0 ? "on-inv" : "ink"}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

/** The people who sign in, as chips with their avatar; the chosen one is dark. */
export function PersonChips({ items, selected, onPick, label }: { items: { id: string; initials: string; tint: 1 | 2 | 3 | 4 | 5; first: string }[]; selected: string; onPick: (id: string) => void; label: string }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={label} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingBottom: 12 }}>
      {items.map((p) => {
        const on = p.id === selected;
        return (
          <Press key={p.id} onPress={() => onPick(p.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={p.first}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 38, paddingLeft: 5, paddingRight: 13, borderRadius: 999, backgroundColor: on ? colors.inv : colors.sunk }}>
            <Avatar initials={p.initials} tint={p.tint} size={28} />
            <Text size={13.5} weight={500} color={on ? "on-inv" : "ink"}>{p.first}</Text>
          </Press>
        );
      })}
    </ScrollView>
  );
}

/** The person's name and role at the top of the switches, with how many differ from the role. */
export function PersonHead({ avatar, name, role, tag }: { avatar: ReactNode; name: string; role: string; tag?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 64 }}>
      {avatar}
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{role}</Text>
      </View>
      {tag}
    </View>
  );
}

export function Foot({ children }: { children: string }) {
  return <Text size={12.5} color="muted" leading={1.45} style={{ marginHorizontal: 20, marginTop: 10 }}>{children}</Text>;
}

/* ---------- CustomizeHome ---------- */

/** A section of the home: a handle you tap to lift the row (then arrows move it), its glyph, name and line, and the switch. Hidden ones fade. */
export function SectionRow({ first, icon, tone, name, sub, off, lifted, handle, onLift, onUp, onDown, upOff, downOff, up, down, control, locked }: {
  first?: boolean; icon: IconName; tone: Tone; name: string; sub: string; off?: boolean; lifted?: boolean; handle: string; onLift: () => void; onUp: () => void; onDown: () => void; upOff?: boolean; downOff?: boolean; up: string; down: string; control: ReactNode; locked?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View>
      {first || lifted ? null : <Hairline inset={0} />}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 14, paddingLeft: 6, minHeight: 62, backgroundColor: colors.card, borderRadius: lifted ? 16 : 0, transform: lifted ? [{ scale: 1.02 }] : undefined, boxShadow: lifted ? `0 14px 30px -12px ${colors.shadow}, 0 0 0 1px ${colors.ring}` : undefined, zIndex: lifted ? 2 : 0 }}>
        <Press onPress={onLift} disabled={locked} accessibilityRole="button" accessibilityState={{ selected: !!lifted }} accessibilityLabel={handle} style={{ width: 36, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Glyph name="grip" size={18} color={lifted ? "ink" : "faint"} />
        </Press>
        <View style={{ opacity: off ? 0.45 : 1 }}><Icon name={icon} tone={tone} size={28} /></View>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2, opacity: off ? 0.45 : 1 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
        </View>
        {lifted ? (
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Press onPress={onUp} disabled={upOff} accessibilityRole="button" accessibilityLabel={up} style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center", opacity: upOff ? 0.35 : 1 }}><Glyph name="arrowUp" size={16} /></Press>
            <Press onPress={onDown} disabled={downOff} accessibilityRole="button" accessibilityLabel={down} style={{ width: 44, height: 44, borderRadius: 11, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center", opacity: downOff ? 0.35 : 1 }}><View style={{ transform: [{ rotate: "180deg" }] }}><Glyph name="arrowUp" size={16} /></View></Press>
          </View>
        ) : control}
      </View>
    </View>
  );
}

/** The miniature tab bar: Home (always) and the person's three, the active one on `sunk`. */
export function NavPreview({ items, label }: { items: { label: string; icon: IconName; tone: Tone; on?: boolean }[]; label: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={{ height: 62, borderRadius: 31, backgroundColor: colors.glass, boxShadow: `0 10px 30px -12px ${colors.shadow}, 0 0 0 1px ${colors.ring}`, padding: 5, flexDirection: "row" }}>
      {items.map((n) => (
        <View key={n.label} style={{ flex: 1, minWidth: 0, borderRadius: 26, alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: n.on ? colors.sunk : "transparent" }}>
          <View style={{ opacity: n.on ? 1 : 0.5 }}><Icon name={n.icon} tone={n.tone} size={22} /></View>
          <Text size={10.5} weight={n.on ? 600 : 500} color={n.on ? "ink" : "muted"} numberOfLines={1} allowFontScaling={false}>{n.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** A tab to pick: a tile with its glyph and name, a number when chosen, a tick, and the lock look when the role may not have it. */
export function TabTile({ icon, tone, label, n, on, locked, onPress, a11y }: { icon: IconName; tone: Tone; label: string; n?: number; on: boolean; locked?: boolean; onPress: () => void; a11y: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: "31.5%", flexGrow: 1 }}>
      <Press onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on, disabled: !!locked }} accessibilityLabel={a11y}
        style={{ minHeight: 90, borderRadius: 18, backgroundColor: colors.card, boxShadow: on ? `0 0 0 2px ${colors.ink}` : `0 0 0 1px ${colors.ring}`, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 6, opacity: locked ? 0.5 : 1 }}>
        {n ? <View style={{ position: "absolute", top: 8, left: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center" }}><Num size={11.5} weight={600} color="muted">{String(n)}</Num></View> : null}
        {on ? <View style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center" }}><Glyph name="check" size={11} color="on-inv" weight={3} /></View> : null}
        <Icon name={icon} tone={tone} size={30} />
        <Text size={13.5} weight={500} align="center" numberOfLines={1}>{label}</Text>
      </Press>
    </View>
  );
}
export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>{children}</View>;
}

/** Four sample cards at the chosen density (bigger figures and lines, or smaller cards). */
export function DensityPreview({ compact, note }: { compact: boolean; note: string }) {
  const { colors } = useTheme();
  const figs = ["4", "62%", "3", "$18,640", "2"];
  return (
    <View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ borderRadius: 22, backgroundColor: colors.ground, borderWidth: 1, borderColor: colors.line2, padding: 14, height: 238, overflow: "hidden", marginTop: 12 }}>
        {figs.map((f, i) => (
          <View key={i} style={{ borderRadius: 14, backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.ring}`, height: compact ? 50 : 78, paddingVertical: compact ? 8 : 12, paddingHorizontal: compact ? 10 : 14, marginTop: i ? (compact ? 6 : 10) : 0 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}><View style={{ width: "38%", height: 6, borderRadius: 3, backgroundColor: colors.sunk }} /><View style={{ width: "16%", height: 6, borderRadius: 3, backgroundColor: colors.sunk }} /></View>
            <Num size={compact ? 16 : 24} weight={600} tracking={-0.03} style={{ marginTop: compact ? 4 : 8 }}>{f}</Num>
            {compact ? null : <View style={{ width: "70%", height: 6, borderRadius: 3, backgroundColor: colors.sunk, marginTop: 6 }} />}
          </View>
        ))}
      </View>
      <Text size={12.5} color="muted" style={{ marginTop: 10, marginHorizontal: 2 }}>{note}</Text>
    </View>
  );
}

export const Wide = ({ children }: { children: ReactNode }) => <Card style={{ overflow: "visible" }}>{children}</Card>;

/** A label with a muted line under it and a control on the right (a tag or a switch). */
export function LineBlock({ first, label, sub, control }: { first?: boolean; label: string; sub: string; control: ReactNode }) {
  return (
    <Block first={first}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexShrink: 1, gap: 2 }}><Text size={15} weight={500}>{label}</Text><Text size={12.5} color="muted">{sub}</Text></View>
        {control}
      </View>
    </Block>
  );
}

/** A heading above a group of rows. */
export function GroupHeading({ children }: { children: string }) {
  return <Text size={17} weight={600} tracking={-0.025} accessibilityRole="header" style={{ marginHorizontal: 20, marginBottom: 10 }}>{children}</Text>;
}

/** A banner with its action under it. */
export function BannerStack({ children }: { children: ReactNode }) {
  return <View style={{ gap: 10 }}>{children}</View>;
}
