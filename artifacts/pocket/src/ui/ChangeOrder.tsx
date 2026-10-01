// ChangeOrder.dc.html's own pieces.
// StepsBar (.co-steps): four bars (4 tall, gap 6, padding 2 20 10); a step reached is `inv`, the current one's word is 11.5/600 `ink`.
// MicCard: a card (padding 18 16 16): a 76 round mic (`inv`; `bad` while listening), the title 16/600 and a line 12.5 muted, the heard text under a hairline.
// Summary (.co-sum): three cells (padding 12 14, label 11.5 muted, figure 15/600) under a hairline, hairlines between.
// LineRow: padding 13 16, the name 14.5/500 with the amount, the detail 12.5 muted. LinesFooter: `soft`, padding 14 16: subtotal, tax, the total 17/600.
// Hero (.co-hero): centred, the title 24/600, a muted line, a status pill. TrackItem: a dot (9, `acc` or a `line2` ring), the text 13.5/500, the time 11.5 faint.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Card, Hairline } from "./Card";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

export function StepsBar({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 1, max: steps.length, now: current + 1 }} style={{ flexDirection: "row", gap: 6, paddingTop: 2, paddingHorizontal: 20, paddingBottom: 10 }}>
      {steps.map((s, i) => (
        <View key={s} style={{ flex: 1, gap: 6 }}>
          <View style={{ height: 4, borderRadius: 4, backgroundColor: i <= current ? colors.inv : colors.line2 }} />
          <Text size={11.5} weight={i === current ? 600 : 400} color={i === current ? "ink" : "muted"} numberOfLines={1}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

export function MicCard({ listening, busy, title, sub, label, onPress, heard }: { listening: boolean; busy?: boolean; title: string; sub: string; label: string; onPress: () => void; heard?: string }) {
  const { colors } = useTheme();
  return (
    <Card padded>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Press onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label}
          style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: listening ? colors.bad : colors.inv, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
          <Glyph name="mic" size={30} color={listening ? "card" : "on-inv"} weight={1.9} />
        </Press>
        <View style={{ flexGrow: 1, flexShrink: 1, gap: 4 }}>
          <Text size={16} weight={600}>{title}</Text>
          <Text size={12.5} color="muted">{sub}</Text>
        </View>
      </View>
      {heard ? (
        <View style={{ marginTop: 16, paddingTop: 14 }}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0 }}><Hairline inset={0} /></View>
          <Text size={15} color="t2" leading={1.5}>{heard}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export function Summary({ cells }: { cells: { label: string; value: string }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line }}>
      {cells.map((c, i) => (
        <View key={c.label} style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.line }}>
          <Text size={11.5} color="muted" numberOfLines={1}>{c.label}</Text>
          <Num size={15} weight={600} numberOfLines={1}>{c.value}</Num>
        </View>
      ))}
    </View>
  );
}

export function LineRow({ name, detail, amount, onPress, label }: { name: string; detail?: string; amount: string; onPress?: () => void; label?: string }) {
  return (
    <Press onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={label ?? name} style={{ paddingVertical: 13, paddingHorizontal: 16, gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <Text size={14.5} weight={500} style={{ flexShrink: 1 }}>{name}</Text>
        <Num size={14.5} weight={500}>{amount}</Num>
      </View>
      {detail ? <Text size={12.5} color="muted">{detail}</Text> : null}
    </Press>
  );
}

export function LinesFooter({ subtotalLabel, subtotal, taxLabel, tax, totalLabel, total }: { subtotalLabel: string; subtotal: string; taxLabel: string; tax: string; totalLabel: string; total: string }) {
  const { colors } = useTheme();
  const row = (l: string, v: string) => <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text size={13.5} color="muted">{l}</Text><Num size={13.5} weight={400}>{v}</Num></View>;
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 7, backgroundColor: colors.soft, borderTopWidth: 1, borderTopColor: colors.line }}>
      {row(subtotalLabel, subtotal)}
      {row(taxLabel, tax)}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingTop: 7, borderTopWidth: 1, borderTopColor: colors.line }}>
        <Text size={13.5} weight={500}>{totalLabel}</Text>
        <Num size={17} weight={600}>{total}</Num>
      </View>
    </View>
  );
}

export function Hero({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 22, paddingHorizontal: 24 }}>
      <Text size={24} weight={600} tracking={-0.035} leading={1.2} align="center" accessibilityRole="header" style={{ marginTop: 12 }}>{title}</Text>
      <Text size={13.5} color="muted" align="center" style={{ marginTop: 6 }}>{sub}</Text>
      {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
    </View>
  );
}

export function TrackItem({ done, last, text, when, sub }: { done: boolean; last: boolean; text: string; when: string; sub?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingBottom: 16, paddingLeft: 24 }}>
      <View style={{ position: "absolute", left: 3, top: 5, width: 9, height: 9, borderRadius: 5, backgroundColor: done ? colors.acc : colors.card, boxShadow: done ? undefined : `inset 0 0 0 1.5px ${colors.line2}` }} />
      {last ? null : <View style={{ position: "absolute", left: 7, top: 18, bottom: 2, width: 1, backgroundColor: colors.line2 }} />}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <Text size={13.5} weight={500} leading={1.35} color={done ? "ink" : "muted"} style={{ flexShrink: 1 }}>{text}</Text>
        <Text size={11.5} color="faint">{when}</Text>
      </View>
      {sub ? <Text size={12.5} color="muted" style={{ marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

export function CompareRow({ title, sub, was, now }: { title: string; sub: string; was?: string; now: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 13, paddingHorizontal: 16 }}>
      <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
        <Text size={14.5} weight={500}>{title}</Text>
        <Text size={12.5} color="muted" leading={1.35}>{sub}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {was ? <Num size={12.5} weight={400} color="faint" style={{ textDecorationLine: "line-through" }}>{was}</Num> : null}
        <Num size={14.5} weight={600}>{now}</Num>
      </View>
    </View>
  );
}

/** The flat bar at the bottom of the screen (not the floating one): `ground`, a hairline above, padding 14 16 34 (the phone's bar added), buttons in a row with gap 10. */
export function BottomBar({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 34, backgroundColor: colors.ground, boxShadow: `0 -1px 0 ${colors.line}`, flexDirection: "row", gap: 10 }}>
      {children}
    </View>
  );
}

/** A hairline-separated stack of rows in a card (the board's `overflow: hidden` card with `lrow` rows). */
export function Rows({ children }: { children: ReactNode }) {
  return <Card>{children}</Card>;
}

/** The change's total, big: "+$1,120" at 32/600 and ".00" at 19 in `faint`. */
export function BigAmount({ whole, cents }: { whole: string; cents: string }) {
  return (
    <Num size={32} weight={600} tracking={-0.04} leading={1}>
      {whole}
      {cents ? <Num size={19} weight={600} color="faint" tracking={-0.01}>{cents}</Num> : null}
    </Num>
  );
}
