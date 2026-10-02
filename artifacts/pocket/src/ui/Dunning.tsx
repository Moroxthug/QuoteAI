// Dunning.dc.html: a vertical timeline of what happens when a payment doesn't go through. Each step has a node on the rail (red, amber, grey, green), a heading with a day on the
// right, a line, and its content (a miniature Home, a card with a 7-day meter, lists of what still works).
import type { ReactNode } from "react";
import { View } from "react-native";
import { Card, Hairline } from "./Card";
import { Icon, type IconName, type Tone } from "./Icon";
import { Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

export function Timeline({ children }: { children: ReactNode }) {
  return <View style={{ paddingTop: 22, gap: 26 }}>{children}</View>;
}

/** One step: the node (a dot in the given colour on a ring), the rail down to the next, the heading with its day, a muted line and the content. */
export function Step({ dot, title, right, caption, last, children }: { dot: ColorName; title: string; right?: ReactNode; caption: ReactNode; last?: boolean; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingLeft: 52, paddingRight: 16 }}>
      <View style={{ position: "absolute", left: 18, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.ground, borderWidth: 2, borderColor: colors.line2, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[dot] }} />
      </View>
      {last ? null : <View style={{ position: "absolute", left: 27, top: 28, bottom: -10, width: 2, backgroundColor: colors.line2 }} />}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 28 }}>
        <Text size={15} weight={600} tracking={-0.02} accessibilityRole="header">{title}</Text>
        {right}
      </View>
      <Text size={13.5} color="muted" leading={1.45} style={{ marginTop: 4, marginBottom: children ? 12 : 0 }}>{caption}</Text>
      {children}
    </View>
  );
}

/** The miniature Home: a greeting, the failed-payment banner (given) and two rows, fading out at the bottom. */
export function MiniHome({ label, greeting, banner, rows }: { label: string; greeting: string; banner: ReactNode; rows: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={{ borderRadius: 22, backgroundColor: colors.ground, borderWidth: 1, borderColor: colors.line2, paddingTop: 14, paddingHorizontal: 12, overflow: "hidden" }}>
      <Text size={21} weight={600} tracking={-0.035} style={{ paddingHorizontal: 4 }}>{greeting}</Text>
      <View style={{ marginTop: 12 }}>{banner}</View>
      <Card style={{ marginTop: 12, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>{rows}</Card>
    </View>
  );
}

/** Seven small bars, the first `on` of them amber: the days of the grace period. */
export function Meter({ on, label }: { on: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: "row", gap: 4, marginTop: 14 }}>
      {Array.from({ length: 7 }, (_, i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < on ? colors["warn-dot"] : colors.sunk }} />)}
    </View>
  );
}

/** A list of lines with a glyph (what still works; what is paused), under a small heading. */
export function LineList({ heading, items, off }: { heading: string; items: { icon: IconName; tone: Tone; text: string }[]; off?: boolean }) {
  return (
    <View>
      <Text size={12.5} weight={500} color="muted" style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 4 }}>{heading}</Text>
      {items.map((it, i) => (
        <View key={it.text}>
          {i ? <Hairline inset={0} /> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 16, minHeight: 44 }}>
            <Icon name={it.icon} tone={it.tone} size={22} />
            <Text size={14.5} color={off ? "muted" : "ink"} style={{ flexShrink: 1 }}>{it.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** The foot of the page. */
export function Foot({ children }: { children: string }) {
  return <Text size={12.5} color="faint" align="center" style={{ marginTop: 28, marginHorizontal: 20 }}>{children}</Text>;
}

/** The page's head: a 24 title and a muted paragraph. */
export function DunningHead({ title, intro }: { title: string; intro: string }) {
  return (
    <View>
      <Text size={24} weight={600} tracking={-0.035} leading={1.15} accessibilityRole="header">{title}</Text>
      <Text size={14.5} color="muted" leading={1.45} style={{ marginTop: 8 }}>{intro}</Text>
    </View>
  );
}

/** A muted two-line caption's day: "Day 1" in Manrope. */
export function DayWord({ children }: { children: string }) {
  return <Text size={12.5} color="muted">{children}</Text>;
}

/** Space above something (the board's 10 and 14). */
export function Gap({ top = 10, children }: { top?: number; children: ReactNode }) {
  return <View style={{ marginTop: top }}>{children}</View>;
}

/** The banner (given) with its two buttons under it. */
export function BannerWithActions({ banner, actions }: { banner: ReactNode; actions: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      {banner}
      <View style={{ flexDirection: "row", gap: 8 }}>{actions}</View>
    </View>
  );
}

/** The grace card's content: the amber clock, the message (given), the seven-day meter with its two ends and a button. */
export function GraceBody({ title, body, meter, from, to, action }: { title: string; body: string; meter: string; from: string; to: string; action: ReactNode }) {
  return (
    <Card padded>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <Icon name="clock" tone="amber" size={28} />
        <View style={{ flexShrink: 1, gap: 4 }}>
          <Text size={17} weight={600} tracking={-0.02} leading={1.3}>{title}</Text>
          <Text size={13.5} color="muted" leading={1.45}>{body}</Text>
        </View>
      </View>
      <Meter on={1} label={meter} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}><DayWord>{from}</DayWord><DayWord>{to}</DayWord></View>
      <Gap top={14}>{action}</Gap>
    </Card>
  );
}
