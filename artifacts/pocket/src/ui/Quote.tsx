// Pieces of the Quote screen (Quote.dc.html), also used by the Quote editor.
// QuoteHead: the status (plain) and "Valid until ..." (12.5 muted), the title 24/600 (-0.035em, 1.2), then the client:
// a 32 avatar, the name 14.5/500 over the address 12.5 muted, and a `sunk` "Change" pill (32, radius 10).
// ScopeCard: a card (padding 14 16): "Scope, as understood" 13.5/500 muted with "Edit" (12.5/500, accent text), then the text 14.5 (1.5, `t2`).
// LineCard: one card of lines (padding 2 0); each line padding 13 16: name 14.5/500 and amount Num 14.5/500, then the detail
// (12.5 muted) and a stepper, or "fixed" (11.5 faint).
// TotalsCard: Subtotal and tax (13.5 muted, the figure in `ink`), a rule, then Total 14.5/500 and the figure 28/600 with the cents in 16 faint.
// DepositCard: the deposit's switch row and, when on, "Due on acceptance" under a hairline.
// ChannelPicker: a 3-way control (track `sunk`, radius 14, padding 3; thumb `card`, radius 11) whose options are 50 tall: the name 13.5/500 over a 10.5 line.
import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { board } from "@/theme/board";
import { tokens } from "@/theme/tokens";
import { Card, Hairline } from "./Card";
import { easing, Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

export function QuoteHead({ status, valid, title, titleNode, avatar, client, address, changeLabel, onChange }: {
  status: ReactNode; valid: string; title: string; /** An editable title replaces the plain one. */ titleNode?: ReactNode; avatar: ReactNode; client: string; address?: string; changeLabel?: string; onChange?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingTop: 8, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{status}<Text size={12.5} color="muted">{valid}</Text></View>
      {titleNode ?? <Text size={24} weight={600} tracking={-0.035} leading={1.2} accessibilityRole="header" style={{ marginTop: 8 }}>{title}</Text>}
      <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
        {avatar}
        <View style={{ flexGrow: 1, flexShrink: 1, gap: 1 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{client}</Text>
          {address ? <Text size={12.5} color="muted" numberOfLines={1}>{address}</Text> : null}
        </View>
        {onChange && changeLabel ? (
          <Press onPress={onChange} accessibilityRole="button" accessibilityLabel={changeLabel} style={{ minHeight: 44, justifyContent: "center" }}>
            <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.sunk, justifyContent: "center" }}><Text size={12.5} weight={500}>{changeLabel}</Text></View>
          </Press>
        ) : null}
      </View>
    </View>
  );
}

export function ScopeCard({ title, text, editLabel, onEdit }: { title: string; text: string; editLabel?: string; onEdit?: () => void }) {
  return (
    <Card padded style={{ paddingVertical: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text size={13.5} weight={500} color="muted">{title}</Text>
        {onEdit && editLabel ? (
          <Press onPress={onEdit} accessibilityRole="button" accessibilityLabel={`${editLabel}: ${title}`} style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end", marginVertical: -8 }}>
            <Text size={12.5} weight={500} color="acc-t">{editLabel}</Text>
          </Press>
        ) : null}
      </View>
      <Text color="t2" leading={1.5} style={{ marginTop: 6 }}>{text}</Text>
    </Card>
  );
}

export type QuoteLine = { key: string; name: string; detail: string; amount: string; stepper?: ReactNode; fixed?: string; onPress?: () => void };

export function LineCard({ lines }: { lines: QuoteLine[] }) {
  return (
    <Card style={{ paddingVertical: 2 }}>
      {lines.map((l, i) => {
        const body = (
          <View style={{ paddingVertical: 13, paddingHorizontal: 16, gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 12, justifyContent: "space-between", alignItems: "baseline" }}>
              <Text size={14.5} weight={500} leading={1.3} style={{ flexShrink: 1 }}>{l.name}</Text>
              <Num size={14.5} weight={500} style={{ flexShrink: 0 }}>{l.amount}</Num>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text size={12.5} color="muted" leading={1.35} style={{ flexShrink: 1 }}>{l.detail}</Text>
              {l.stepper ?? (l.fixed ? <Text size={11.5} color="faint">{l.fixed}</Text> : null)}
            </View>
          </View>
        );
        return (
          <View key={l.key}>
            {i > 0 ? <Hairline inset={0} /> : null}
            {l.onPress ? <Press onPress={l.onPress} accessibilityRole="button" accessibilityLabel={`${l.name}, ${l.amount}`}>{body}</Press> : body}
          </View>
        );
      })}
    </Card>
  );
}

export function TotalsCard({ rows, totalLabel, whole, cents }: { rows: { label: string; value: string }[]; totalLabel: string; whole: string; cents: string }) {
  const { colors } = useTheme();
  return (
    <Card padded>
      {rows.map((r, i) => (
        <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: i ? 8 : 0 }}>
          <Text size={13.5} color="muted">{r.label}</Text>
          <Num size={13.5} weight={400}>{r.value}</Num>
        </View>
      ))}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
        <Text size={14.5} weight={500}>{totalLabel}</Text>
        <Num size={28} weight={600} tracking={-0.035} accessibilityLabel={`${totalLabel} ${whole}${cents}`}>{whole}<Num size={16} weight={600} color="faint" tracking={-0.01}>{cents}</Num></Num>
      </View>
    </Card>
  );
}

export function DepositCard({ title, sub, switchNode, dueLabel, due }: { title: string; sub: string; switchNode: ReactNode; dueLabel?: string; due?: string }) {
  const { colors } = useTheme();
  return (
    <Card padded style={{ paddingVertical: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexShrink: 1, gap: 1 }}>
          <Text size={14.5} weight={500}>{title}</Text>
          <Text size={12.5} color="muted">{sub}</Text>
        </View>
        {switchNode}
      </View>
      {due ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line }}>
          <Text size={13.5} color="muted">{dueLabel}</Text>
          <Num size={13.5} weight={500}>{due}</Num>
        </View>
      ) : null}
    </Card>
  );
}

export type Channel3 = { key: string; label: string; sub: string };

export function ChannelPicker({ options, value, onChange, label }: { options: Channel3[]; value: number; onChange: (i: number) => void; label: string }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(value);
  useEffect(() => { x.value = withTiming(value, { duration: reduced ? 0 : tokens.motion.segmentThumb.duration, easing: easing("out") }); }, [value, reduced, x]);
  const thumbW = w ? (w - 6) / options.length : 0;
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * thumbW }] }));
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", padding: 3, borderRadius: 14, backgroundColor: colors.sunk }}>
      {thumbW ? <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 3, left: 3, width: thumbW, height: 50, borderRadius: 11, backgroundColor: colors.card, boxShadow: board.knobShadow }, thumb]} /> : null}
      {options.map((o, i) => {
        const on = i === value;
        return (
          <Press key={o.key} onPress={() => onChange(i)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${o.label}, ${o.sub}`} style={{ flex: 1, minWidth: 0, height: 50, alignItems: "center", justifyContent: "center", gap: 1 }}>
            <Text size={13.5} weight={500} color={on ? "ink" : "muted"} numberOfLines={1}>{o.label}</Text>
            <Num size={10.5} weight={500} color={on ? "ink" : "muted"} opacity={0.7} numberOfLines={1}>{o.sub}</Num>
          </Press>
        );
      })}
    </View>
  );
}
