// Analytics.dc.html: a card of one figure (.an-card, .an-lbl, .an-big, .an-cap), the revenue columns (.an-col), the horizontal bars (.an-hb), the
// average-quote line (.an-line), the quote-to-cash stack (.an-stack, .an-leg), a job to look at and a client. Sizes are the board's own.
import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Avatar, type AvatarTint } from "./Avatar";
import { Card, Hairline } from "./Card";
import { Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Status, type StatusShape, type StatusTone } from "./Status";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";
import { useState } from "react";

/** `.an-card`: padding 16 16 14. */
export function AnCard({ children }: { children: ReactNode }) {
  return <Card style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14 }}>{children}</Card>;
}

/** `.an-lbl`: 12.5 muted. */
export function AnLabel({ children }: { children: string }) {
  return <Text size={12.5} color="muted">{children}</Text>;
}

/** `.an-big`: a 32/600 figure, tight, with an optional word after it (the "days" of quote to cash). */
export function BigFigure({ value, unit, tone = "ink" }: { value: string; unit?: string; tone?: ColorName }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
      <Num size={32} weight={600} tracking={-0.04} leading={1.05} color={tone}>{value}</Num>
      {unit ? <Text size={19} color="muted" tracking={-0.02}>{unit}</Text> : null}
    </View>
  );
}

/** `.an-cap`: 13.5 in `t2` under a card's figure. */
export function Caption({ children }: { children: string }) {
  return <Text size={13.5} leading={1.45} color="t2" style={{ marginTop: 12 }}>{children}</Text>;
}

/** `.an-cols`: up to six columns on a 128 tall plot, the last one dark with its figure above it. `height` is 0 to 82, the share of the tallest column. */
export function Columns({ bars, label }: { bars: { label: string; height: number; value?: string; on?: boolean }[]; label: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 128, marginTop: 16 }}>
      {bars.map((b, i) => (
        <View key={i} style={{ flex: 1, minWidth: 0, height: "100%", gap: 6, alignItems: "center" }}>
          <View style={{ flex: 1, width: "100%", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
            {b.value ? <Num size={11.5} weight={600} numberOfLines={1}>{b.value}</Num> : null}
            <View style={{ width: "100%", height: Math.max(6, (Math.min(82, b.height) / 82) * 84), borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: b.on ? colors.inv : colors.sunk }} />
          </View>
          <Text size={11.5} color={b.on ? "ink" : "muted"} weight={b.on ? 600 : 400} numberOfLines={1}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** `.an-hb`: a name, a track with a bar, and a figure; the best one is green. */
export function HBarRow({ name, width, value, hi, trail, valueTone }: { name: string; width: number; value: string; hi?: boolean; trail?: string; valueTone?: ColorName }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={[name, trail, value].filter(Boolean).join(", ")} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 30 }}>
      <Text size={13.5} numberOfLines={1} style={{ width: 96 }}>{name}</Text>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
        <View style={{ flex: 1, height: 8, borderRadius: 8, backgroundColor: colors.sunk, overflow: "hidden" }}>
          <View style={{ width: `${Math.max(0, Math.min(100, width))}%`, height: "100%", borderRadius: 8, backgroundColor: hi ? colors["ok-dot"] : colors.inv }} />
        </View>
        {trail ? <View style={{ width: 30 }}><Num size={12.5} weight={500} color="muted">{trail}</Num></View> : null}
      </View>
      <View style={{ width: 40, alignItems: "flex-end" }}><Num size={13.5} weight={600} color={valueTone ?? "ink"}>{value}</Num></View>
    </View>
  );
}

/** `.an-line`: the average quote's line over its area, 84 tall, a dot on the last point; the months go under it. */
export function AreaLine({ values, labels, label }: { values: (number | null)[]; labels: string[]; label: string }) {
  const { colors } = useTheme();
  const [w, setW] = useState(300);
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  const mn = Math.min(...pts.map((p) => p.v));
  const mx = Math.max(...pts.map((p) => p.v));
  const rg = mx - mn || 1;
  const n = Math.max(1, values.length - 1);
  const xy = pts.map((p) => [(p.i / n) * w, mx === mn ? 42 : 84 - 8 - ((p.v - mn) / rg) * 62] as const);
  const line = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const last = xy[xy.length - 1];
  return (
    <View>
      <View accessible accessibilityRole="image" accessibilityLabel={label} onLayout={(e) => setW(Math.max(120, Math.round(e.nativeEvent.layout.width)))} style={{ height: 84, marginTop: 14 }}>
        {xy.length > 1 && last ? (
          <Svg width="100%" height={84} viewBox={`0 0 ${w} 84`} style={{ overflow: "visible" }}>
            <Path d={`M${xy[0]![0]} 84 L${line.slice(1)} L${last[0]} 84 Z`} fill={colors["acc-soft"]} />
            <Path d={line} fill="none" stroke={colors.acc} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={last[0]} cy={last[1]} r={8} fill={colors.card} />
            <Circle cx={last[0]} cy={last[1]} r={5} fill={colors.acc} />
          </Svg>
        ) : null}
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        {labels.map((l, i) => <Text key={i} size={11.5} color={i === labels.length - 1 ? "ink" : "muted"} weight={i === labels.length - 1 ? 600 : 400}>{l}</Text>)}
      </View>
    </View>
  );
}

/** `.an-stack` and `.an-leg`: the three steps from quote to cash as one bar (each as wide as its days) and a key of three. */
export function CashStack({ steps, label }: { steps: { days: string; word: string; weight: number; color: ColorName }[]; label: string }) {
  const { colors } = useTheme();
  return (
    <View>
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ flexDirection: "row", gap: 3, height: 14, marginTop: 16 }}>
        {steps.map((s, i) => <View key={i} style={{ flexGrow: Math.max(0.0001, s.weight), flexBasis: 0, height: "100%", borderRadius: 5, backgroundColor: colors[s.color] }} />)}
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        {steps.map((s, i) => (
          <View key={i} style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: colors[s.color] }} />
              <Num size={15} weight={600}>{s.days}</Num>
            </View>
            <Text size={11.5} color="muted">{s.word}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A job to look at: a 26 icon, name over what is wrong, and its status. */
export function RiskRow({ icon, tone, name, sub, status, statusTone, statusShape, onPress, first }: { icon: IconName; tone: Tone; name: string; sub: string; status: string; statusTone: StatusTone; statusShape: StatusShape; onPress: () => void; first?: boolean }) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}, ${sub}, ${status}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
        <View style={{ width: 28, height: 28, flexShrink: 0 }}><Icon name={icon} tone={tone} size={28} /></View>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
        </View>
        <Status tone={statusTone} shape={statusShape}>{status}</Status>
      </Press>
    </View>
  );
}

/** A top client: the initials, name over a line, what they were invoiced and their share. */
export function ClientRow({ initials, tint, name, sub, amount, share, onPress, first }: { initials: string; tint: AvatarTint; name: string; sub: string; amount: string; share: string; onPress: () => void; first?: boolean }) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}, ${sub}, ${amount}, ${share}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
        <Avatar initials={initials} tint={tint} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <Num size={14.5} weight={600}>{amount}</Num>
          <Text size={11.5} color="muted">{share}</Text>
        </View>
      </Press>
    </View>
  );
}

/** The lead table's column heads: Source, Share of leads, Won. */
export function LeadHead({ source, share, won }: { source: string; share: string; won: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingBottom: 4 }}>
      <Text size={11.5} color="muted" style={{ width: 96 }}>{source}</Text>
      <Text size={11.5} color="muted" style={{ flex: 1 }}>{share}</Text>
      <Text size={11.5} color="muted" align="right" style={{ width: 40 }}>{won}</Text>
    </View>
  );
}

