// COMPONENTS §21 and the Numbers section of Components.dc.html.
// StatStrip: one card (padding 14 4) with 3 equal columns (padding 0 12, gap 3), a 1 px `line`
// between them; label 11.5 muted, value Num 19/600 (−0.03em), sub-line 11.5 in its tone.
// KpiTile (.kpi): a card, padding 14 16, gap 3; label 12.5 muted, value Num 19/600, sub 11.5.
// KpiGrid: 2 columns, gap 10.
// Progress (.bar): 4 tall (6 in progress rows), radius 4, `sunk` track, `inv` fill (or a tone)
// that grows in from the left over 1.2 s after 0.2 s with the `out` easing, on first view.
// ProgressRow: label 13.5 and the figure Num 600 in its tone over the bar, gap 8, padding 14 16.
import { Children, Fragment, useEffect, type ReactNode } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { tokens } from "@/theme/tokens";
import { Card, Hairline } from "./Card";
import { easing } from "./motion";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

export type Figure = { label: string; value: string; sub?: string; subTone?: Extract<ColorName, "muted" | "ok" | "bad" | "warn"> };

function Value({ children }: { children: string }) {
  return <Num size={19} weight={600} tracking={-0.03}>{children}</Num>;
}

export function StatStrip({ items }: { items: Figure[] }) {
  const { colors } = useTheme();
  return (
    <Card style={{ flexDirection: "row", paddingVertical: 14, paddingHorizontal: 4 }}>
      {items.map((k, i) => (
        <View key={i} accessible accessibilityLabel={[k.label, k.value, k.sub].filter(Boolean).join(", ")}
          style={{ flex: 1, minWidth: 0, gap: 3, paddingHorizontal: 12, borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: colors.line }}>
          <Text size={11.5} color="muted">{k.label}</Text>
          <Value>{k.value}</Value>
          {k.sub ? <Text size={11.5} color={k.subTone ?? "muted"}>{k.sub}</Text> : null}
        </View>
      ))}
    </Card>
  );
}

export function KpiTile({ label, value, sub, subTone = "muted" }: Figure) {
  return (
    <Card accessible accessibilityLabel={[label, value, sub].filter(Boolean).join(", ")} style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 3 }}>
      <Text size={12.5} color="muted">{label}</Text>
      <Value>{value}</Value>
      {sub ? <Text size={11.5} color={subTone}>{sub}</Text> : null}
    </Card>
  );
}

/** Two columns, gap 10. */
export function KpiGrid({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  items.forEach((c, i) => (i % 2 ? rows[rows.length - 1]!.push(c) : rows.push([c])));
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 }}>
          {r.map((c, j) => <View key={j} style={{ flex: 1, minWidth: 0 }}>{c}</View>)}
          {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

const GROW = easing("out");

export function Progress({ value, fill = "inv", height = 4, label }: { /** 0 to 1; above 1 shows full. */ value: number; fill?: ColorName; height?: number; label?: string }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const w = Math.max(0, Math.min(1, value));
  const grow = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { grow.value = 1; return; }
    grow.value = withDelay(tokens.motion.progressGrow.delay, withTiming(1, { duration: tokens.motion.progressGrow.duration, easing: GROW }));
  }, [reduced, grow]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{ height, borderRadius: 4, backgroundColor: colors.sunk, overflow: "hidden" }}>
      <Animated.View style={[{ width: `${w * 100}%`, height: "100%", borderRadius: 4, backgroundColor: colors[fill], transformOrigin: "left" }, style]} />
    </View>
  );
}

export function ProgressRow({ label, figure, value, tone, fill }: { label: string; figure: string; value: number; tone?: Extract<ColorName, "warn" | "bad">; fill?: ColorName }) {
  return (
    <View style={{ gap: 8, paddingVertical: 14, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text size={13.5} style={{ flexShrink: 1 }}>{label}</Text>
        <Num size={13.5} weight={600} color={tone ?? "ink"}>{figure}</Num>
      </View>
      <Progress value={value} fill={fill} height={6} label={`${label}, ${figure}`} />
    </View>
  );
}

/** Progress rows in one card, divided by full-width hairlines (.cp-row + .cp-row: inset 16). */
export function ProgressList({ children }: { children: ReactNode }) {
  return (
    <Card>
      {Children.toArray(children).map((c, i) => (
        <Fragment key={i}>
          {i > 0 ? <Hairline /> : null}
          {c}
        </Fragment>
      ))}
    </Card>
  );
}
