// SmartHome widget rows (HOME-WIDGETS-SPEC.md, SmartHome.dc.html .stack / .wcard).
// WidgetRow: a title (15/600, -0.02em) with page dots on the right (5 x 5 `track-off`; the active one
// stretches to 16 x 5 `ink` over .4 s) over a sideways snap row of cards (342 wide, 10 apart, 16 side
// padding, the next card peeking). WidgetCard: radius 22, `card` with the ring, min height 198, padding
// 16 18; the top line is a label on the left and a context on the right (12.5 muted). Tapping the card
// opens it in place (ExpandCard): the row locks, the card widens to 358, its neighbours fade out and what
// is below moves down. Only one is open on the screen.
import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { board } from "@/theme/board";
import { tokens } from "@/theme/tokens";
import { ExpandCard, useExpandOpen, useOpenCardId } from "./Expand";
import { easing } from "./motion";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

const CARD_W = 342;
const OPEN_W = 358;
const GAP = 10;
const WIDTH = easing("expand");

function Dot({ on }: { on: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const w = useSharedValue(on ? 16 : 5);
  useEffect(() => { w.value = withTiming(on ? 16 : 5, { duration: reduced ? 0 : 400 }); }, [on, reduced, w]);
  const a = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[{ height: 5, borderRadius: 3, backgroundColor: on ? colors.ink : colors["track-off"] }, a]} />;
}

export function WidgetRow({ title, ids, children }: { title: string; /** The ids of the row's cards, to know whether one of them is open. */ ids: string[]; children: ReactNode }) {
  const [at, setAt] = useState(0);
  const open = useOpenCardId();
  const locked = !!open && ids.includes(open);
  const count = ids.length;
  return (
    <View style={{ paddingTop: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 10 }}>
        <Text size={15} weight={600} tracking={-0.02} accessibilityRole="header">{title}</Text>
        {count > 1 ? <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>{ids.map((id, i) => <Dot key={id} on={i === at} />)}</View> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={!locked} snapToInterval={CARD_W + GAP} decelerationRate="fast" scrollEventThrottle={32}
        onScroll={(e) => setAt(Math.max(0, Math.min(count - 1, Math.round(e.nativeEvent.contentOffset.x / (CARD_W + GAP)))))}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: locked ? 26 : 6, gap: GAP, alignItems: "flex-start" }} accessibilityLabel={title}>
        {children}
      </ScrollView>
    </View>
  );
}

/** One widget: the collapsed card (`children`) and, opened in place, `expanded`. */
export function WidgetCard({ id, label, left, right, children, expanded }: { id: string; label: string; left: string; right?: string; children: ReactNode; expanded: ReactNode }) {
  const open = useExpandOpen(id);
  const anyOpen = useOpenCardId();
  const reduced = useReducedMotion();
  const w = useSharedValue(CARD_W);
  const show = useSharedValue(1);
  useEffect(() => { w.value = withTiming(open ? OPEN_W : CARD_W, { duration: reduced ? 0 : tokens.motion.expand.height.duration, easing: WIDTH }); }, [open, reduced, w]);
  const faded = !!anyOpen && !open;
  useEffect(() => { show.value = withTiming(faded ? 0 : 1, { duration: reduced ? 0 : 300 }); }, [faded, reduced, show]);
  const a = useAnimatedStyle(() => ({ width: w.value, opacity: show.value }));
  return (
    <Animated.View style={a} pointerEvents={faded ? "none" : "auto"}>
      <ExpandCard id={id} label={label} head={
        <View style={{ minHeight: open ? 0 : 150, paddingRight: 30 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text size={12.5} color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{left}</Text>
            {right ? <Text size={12.5} color="muted" numberOfLines={1} style={{ flexShrink: 0 }}>{right}</Text> : null}
          </View>
          {children}
        </View>
      }>
        {expanded}
      </ExpandCard>
    </Animated.View>
  );
}

/** A big figure: Num 32/600 (-0.035em), with an optional smaller faint tail (cents, a unit). */
export function BigFigure({ value, tail, size = 32 }: { value: string; tail?: string; size?: 32 | 34 }) {
  return (
    <Num size={size} weight={600} tracking={size === 34 ? -0.04 : -0.035} leading={1.05} style={{ marginTop: 6 }}>
      {value}
      {tail ? <Num size={16} weight={600} color="faint" tracking={-0.01}>{tail}</Num> : null}
    </Num>
  );
}

/** A 2 line (`acc`) over an 8% fill with a ringed end dot (the Collected sparkline). */
export function Sparkline({ line, area, end, width, height }: { line: string; area: string; end: { x: number; y: number }; width: number; height: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ marginTop: 14 }}>
      <Path d={area} fill={colors.acc} fillOpacity={0.08} />
      <Path d={line} fill="none" stroke={colors.acc} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={end.x} cy={end.y} r={4} fill={board.white} stroke={colors.acc} strokeWidth={2} />
    </Svg>
  );
}

/** A split bar: segments (6 or 8 high, 3 apart, radius 6) sized by their share. */
export function SplitBar({ parts, height = 6 }: { parts: { share: number; color: string }[]; height?: 6 | 8 }) {
  return (
    <View style={{ flexDirection: "row", gap: 3, height, borderRadius: 6, overflow: "hidden", marginTop: 14 }}>
      {parts.filter((p) => p.share > 0).map((p, i) => <View key={i} style={{ flexGrow: p.share, backgroundColor: p.color }} />)}
    </View>
  );
}

/** Columns of a figure over a label, divided by hairlines (the Quotes pipeline). */
export function Columns({ items }: { items: { value: string; label: string }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", marginTop: 12 }}>
      {items.map((c, i) => (
        <View key={c.label} style={{ flex: 1, minWidth: 0, gap: 2, paddingLeft: i ? 12 : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.line }}>
          <Num size={24} weight={600} tracking={-0.03}>{c.value}</Num>
          <Text size={11.5} color="muted" numberOfLines={1}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** A footer line under a widget visual: 12.5, one line. */
export function WidgetFoot({ children, tone = "muted" }: { children: string; tone?: "muted" | "ok" | "bad" | "warn" }) {
  return <Text size={12.5} color={tone} numberOfLines={1} style={{ marginTop: 8 }}>{children}</Text>;
}

/** A pill for the worst case on a card (the most overdue invoice): `bad-soft`, client left, figure right. */
export function AlertPill({ left, right }: { left: string; right: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 12, backgroundColor: colors["bad-soft"] }}>
      <Text size={12.5} weight={500} color="bad" numberOfLines={1} style={{ flexShrink: 1 }}>{left}</Text>
      <Num size={12.5} weight={600} color="bad" style={{ flexShrink: 0 }}>{right}</Num>
    </View>
  );
}
