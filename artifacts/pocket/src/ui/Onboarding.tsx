// Pieces of Onboarding.dc.html that the kit does not have: the step bar, the trade tiles, a
// disclosure row, form-card rows that act instead of type, the quote preview, the sheet's rows
// and the fixed bottom bar. Exact sizes from the board's own CSS; colours from the theme only.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/theme/tokens";
import { Hairline } from "./Card";
import { IconButton } from "./Header";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { easing, Press } from "./motion";
import { shadow } from "./shadow";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** .steps: three 4 tall bars (`line2`), the done ones filled `inv`; back on the left, a Skip text button on the right. */
export function StepBar({ step, total = 3, progressLabel, onBack, backLabel, onSkip, skipLabel }: {
  step: number; total?: number; progressLabel: string; onBack?: () => void; backLabel: string; onSkip: () => void; skipLabel: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60 + insets.top, paddingTop: 8 + insets.top, paddingLeft: 8, paddingRight: 12 }}>
      {onBack ? <IconButton glyph="back" label={backLabel} onPress={onBack} /> : <View style={{ width: 4 }} />}
      <View accessible accessibilityRole="progressbar" accessibilityLabel={progressLabel} accessibilityValue={{ min: 1, max: total, now: step }}
        style={{ flex: 1, flexDirection: "row", gap: 6 }}>
        {Array.from({ length: total }, (_, i) => (
          <Bar key={i} on={i < step} />
        ))}
      </View>
      <Press onPress={onSkip} accessibilityRole="button" accessibilityLabel={skipLabel} hitSlop={{ top: 2, bottom: 2 }}
        style={{ height: 44, paddingHorizontal: 8, justifyContent: "center" }}>
        <Text size={14.5} weight={500} color="muted">{skipLabel}</Text>
      </Press>
    </View>
  );
}

function Bar({ on }: { on: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const w = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    w.value = reduced ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: 600, easing: easing("out") });
  }, [on, reduced, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ flex: 1, height: tokens.size.progressBar, borderRadius: tokens.radius.bar, backgroundColor: colors.line2, overflow: "hidden" }}>
      <Animated.View style={[{ height: tokens.size.progressBar, backgroundColor: colors.inv }, fill]} />
    </View>
  );
}

/** .tile-grid: three equal columns, gap 8. Tiles read the column width from here. */
const TileWidth = createContext(0);
export function TileGrid({ children }: { children: ReactNode }) {
  const [w, setW] = useState(0);
  const col = w > 0 ? Math.floor(((w - 2 * tokens.space.tileGap) / 3) * 100) / 100 : 0;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space.tileGap }}>
      <TileWidth.Provider value={col}>{col > 0 ? children : null}</TileWidth.Provider>
    </View>
  );
}

/** .ttile: 90 tall, radius 18, ring (selected: 2 `ink`), a 32 icon over a 13.5/500 label, a round tick top right. */
export function TradeTile({ label, icon, tone, selected, onPress }: { label: string; icon: IconName; tone: Tone; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const colW = useContext(TileWidth);
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.value = reduced ? (selected ? 1 : 0) : withTiming(selected ? 1 : 0, { duration: 350, easing: easing("spring") });
  }, [selected, reduced, on]);
  const tick = useAnimatedStyle(() => ({ transform: [{ scale: on.value }] }));
  const glyph = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.08 * on.value }] }));
  return (
    <Press onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={label}
      style={{ width: colW, minHeight: 90, paddingVertical: 12, paddingHorizontal: 6, borderRadius: tokens.radius.tile, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", gap: 8, boxShadow: selected ? shadow("tileSelected", colors) : shadow("ring", colors) }}>
      <Animated.View style={[{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center" }, tick]}>
        <Glyph name="check" size={11} weight={3.2} color="on-inv" />
      </Animated.View>
      <Animated.View style={glyph}><Icon name={icon} tone={tone} size={32} /></Animated.View>
      <Text size={13.5} weight={500} align="center" leading={1.2}>{label}</Text>
    </Press>
  );
}

/** A card row that opens something: icon 24, bold title over a muted line, a chevron that turns over. */
export function DisclosureRow({ icon, tone, title, sub, open, onPress }: { icon: IconName; tone: Tone; title: string; sub: string; open: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  const r = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    r.value = reduced ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: 350, easing: easing("out") });
  }, [open, reduced, r]);
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 180}deg` }] }));
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${title}. ${sub}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: tokens.radius.card, boxShadow: shadow("ring", colors) }}>
      <Icon name={icon} tone={tone} size={24} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text weight={600}>{title}</Text>
        <Text size={12.5} color="muted" leading={1.35}>{sub}</Text>
      </View>
      <Animated.View style={turn}><Glyph name="chevronDown" size={16} color="faint" /></Animated.View>
    </Press>
  );
}

/** A form-card row that acts instead of taking text (the logo): same layout as FormRow, label over a 15/500 `acc-t` value. */
export function FormAction({ icon, tone, label, value, onPress, first, busy }: { icon: IconName; tone: Tone; label: string; value: string; onPress: () => void; first?: boolean; busy?: boolean }) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <Press onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={`${label}. ${value}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 13, minHeight: 62, paddingVertical: 10, paddingLeft: 16, paddingRight: 14, opacity: busy ? 0.6 : 1 }}>
        <Icon name={icon} tone={tone} size={24} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text size={12.5} color="muted" importantForAccessibility="no">{label}</Text>
          <Text size={15} weight={500} color="acc-t" numberOfLines={1}>{value}</Text>
        </View>
      </Press>
    </View>
  );
}

/** "On your quotes": the company as it will print, 18 padding, 17/600 name, a hairline, the province and number. */
export function QuotePreview({ name, contact, number, province, taxId }: { name: string; contact: ReactNode; number: string; province: string; taxId: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: tokens.radius.card, boxShadow: shadow("ring", colors), paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={17} weight={600} numberOfLines={1}>{name}</Text>
          <Text size={12.5} color="muted" style={{ marginTop: 3 }} numberOfLines={2}>{contact}</Text>
        </View>
        <Text size={12.5} color="faint" style={{ paddingTop: 3 }}>{number}</Text>
      </View>
      <View style={{ height: 1, backgroundColor: colors.line, marginTop: 14, marginBottom: 12 }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: 12, rowGap: 4 }}>
        <Text size={13.5} color="muted" style={{ flexShrink: 1 }}>{province}</Text>
        <Text size={13.5} color="muted" style={{ flexShrink: 1 }}>{taxId}</Text>
      </View>
    </View>
  );
}

/** The role tag on an invited person: a tappable .tag, 32 tall, padding 12. */
export function RolePill({ label, accent, a11y, onPress }: { label: string; accent?: boolean; a11y: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={{ top: 6, bottom: 6 }}
      style={{ height: 32, paddingHorizontal: 12, borderRadius: 8, justifyContent: "center", backgroundColor: accent ? colors["acc-soft"] : colors.sunk }}>
      <Text size={11.5} weight={600} color={accent ? "acc-soft-t" : "t2"} numberOfLines={1}>{label}</Text>
    </Press>
  );
}

/** A card row with a leading icon, a title over a line, and a control at the end (the crew switch, the codes). */
export function ControlRow({ icon, tone, title, sub, children, minHeight = 64 }: { icon: IconName; tone: Tone; title: string; sub: string; children: ReactNode; minHeight?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight, paddingVertical: 12, paddingHorizontal: 16 }}>
      <Icon name={icon} tone={tone} size={26} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500}>{title}</Text>
        <Text size={12.5} color="muted" leading={1.35}>{sub}</Text>
      </View>
      {children}
    </View>
  );
}

/** The sheet's title row: 19/600 and a close button. */
export function SheetTitle({ title, closeLabel, onClose }: { title: string; closeLabel: string; onClose: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4, paddingBottom: 10, paddingLeft: 20, paddingRight: 16 }}>
      <Text size={19} weight={600} accessibilityRole="header" style={{ flexShrink: 1 }}>{title}</Text>
      <IconButton glyph="close" label={closeLabel} onPress={onClose} />
    </View>
  );
}

/** A choice in the province sheet: name over its taxes, a check on the chosen one. 54 tall, radius 14. */
export function PickRow({ title, sub, selected, onPress }: { title: string; sub: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${title}, ${sub}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: selected ? colors.soft : "transparent" }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text size={16} weight={500}>{title}</Text>
        <Text size={12.5} color="muted">{sub}</Text>
      </View>
      {selected ? <Glyph name="check" size={18} weight={2.4} color="acc-t" /> : null}
    </Press>
  );
}

/** The fixed bar under the steps: 14 / 16 / 34 padding on `ground`, a hairline above. */
export function BottomBar({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 20 + Math.max(insets.bottom, 14), backgroundColor: colors.ground, boxShadow: `0 -1px 0 ${colors.line}` }}>
      {children}
    </View>
  );
}

/** A card row that opens a sheet (Province or territory): 26 icon, a 12.5 label over a 16/600 value, a chevron. */
export function PickerRow({ icon, tone, label, value, onPress }: { icon: IconName; tone: Tone; label: string; value: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ${value}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 62, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.card, borderRadius: tokens.radius.card, boxShadow: shadow("ring", colors) }}>
      <Icon name={icon} tone={tone} size={26} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text size={12.5} color="muted">{label}</Text>
        <Text size={16} weight={600} numberOfLines={1}>{value}</Text>
      </View>
      <Glyph name="chevron" size={15} color="faint" />
    </Press>
  );
}

/** The sheet's scrolling list: up to 520 tall, 12 side padding. */
export function SheetList({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}
