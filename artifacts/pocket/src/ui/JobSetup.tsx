// JobSetup.dc.html's own pieces.
// MilestoneRow (.lrow, gap 10, padding 12 14 12 16): a 32×44 grip that moves the row up, the title 14.5/500 on up to two lines,
// "3 tasks · 15% of work · Oct 5 – 7" 12.5 muted, the payment-term chip (.term: 24 tall, radius 8, `acc-soft`, 11.5/600; "No payment
// linked" plain in `faint`), and a 36 close button.
// BudgetRow (.lrow, padding 10 12 10 16): name and note, the amount Num 14.5/600 (58 wide, `faint` at zero), and a `.step` well
// (`sunk`, radius 10, padding 2, two 32 buttons).
// MarginCard: a card (padding 16) of Contract value / Expected costs, then "Projected margin" with its note and the figure Num 28/600
// over the dollars, and a 6 tall bar.
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Card, Hairline } from "./Card";
import { Glyph } from "./Icon";
import { Progress } from "./Numbers";
import { Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

function Dots({ color }: { color: string }) {
  const dot = { width: 3, height: 3, borderRadius: 1.5, backgroundColor: color };
  return (
    <View style={{ gap: 3 }}>
      {[0, 1, 2].map((r) => <View key={r} style={{ flexDirection: "row", gap: 3 }}><View style={dot} /><View style={dot} /></View>)}
    </View>
  );
}

export function MilestoneRow({ title, meta, term, hasTerm, upLabel, onUp, canUp, delLabel, onDelete }: {
  title: string; meta: string; term: string; hasTerm: boolean; upLabel: string; onUp: () => void; canUp: boolean; delLabel: string; onDelete: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingLeft: 16, paddingRight: 14 }}>
      <Press onPress={onUp} disabled={!canUp} accessibilityRole="button" accessibilityLabel={upLabel} accessibilityState={{ disabled: !canUp }}
        style={{ width: 32, height: 44, marginLeft: -8, alignItems: "center", justifyContent: "center", opacity: canUp ? 1 : 0.5 }}>
        <Dots color={colors.faint} />
      </Press>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 4 }}>
        <Text size={14.5} weight={500} leading={1.3}>{title}</Text>
        <Text size={12.5} color="muted">{meta}</Text>
        <View style={{ flexDirection: "row", marginTop: 3 }}>
          {hasTerm ? (
            <View style={{ height: 24, paddingHorizontal: 8, borderRadius: 8, backgroundColor: colors["acc-soft"], justifyContent: "center" }}>
              <Text size={11.5} weight={600} color="acc-soft-t" numberOfLines={1}>{term}</Text>
            </View>
          ) : <Text size={11.5} weight={500} color="faint">{term}</Text>}
        </View>
      </View>
      <Press onPress={onDelete} accessibilityRole="button" accessibilityLabel={delLabel} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
        <Glyph name="close" size={16} color="faint" weight={2} />
      </Press>
    </View>
  );
}

export function MiniStepper({ decLabel, incLabel, onDec, onInc, canDec = true }: { decLabel: string; incLabel: string; onDec: () => void; onInc: () => void; canDec?: boolean }) {
  const { colors } = useTheme();
  const btn = (glyph: "minus" | "plus", label: string, on: () => void, enabled = true) => (
    <Press onPress={on} disabled={!enabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !enabled }} hitSlop={6}
      style={{ width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", opacity: enabled ? 1 : 0.35 }}>
      <Glyph name={glyph} size={13} weight={2.2} />
    </Press>
  );
  return <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.sunk, borderRadius: 10, padding: 2, flexShrink: 0 }}>{btn("minus", decLabel, onDec, canDec)}{btn("plus", incLabel, onInc)}</View>;
}

export function BudgetRow({ name, note, amount, zero, decLabel, incLabel, onDec, onInc, canDec }: {
  name: string; note: string; amount: string; zero: boolean; decLabel: string; incLabel: string; onDec: () => void; onInc: () => void; canDec: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 16, paddingRight: 12, minHeight: 44 }}>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
        {note ? <Text size={12.5} color="muted" numberOfLines={1}>{note}</Text> : null}
      </View>
      <Num size={14.5} weight={600} color={zero ? "faint" : "ink"} style={{ minWidth: 58, textAlign: "right" }}>{amount}</Num>
      <MiniStepper decLabel={decLabel} incLabel={incLabel} onDec={onDec} onInc={onInc} canDec={canDec} />
    </View>
  );
}

export function MarginCard({ valueLabel, value, costsLabel, costs, title, note, noteTone, pct, amount, fill, bar }: {
  valueLabel: string; value: string; costsLabel: string; costs: string; title: string; note: string; noteTone: Extract<ColorName, "ok" | "warn">; pct: string; amount: string; fill: Extract<ColorName, "ok-dot" | "warn-dot">; bar: number;
}) {
  return (
    <Card padded>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text size={13.5} color="muted">{valueLabel}</Text><Num size={13.5} weight={500}>{value}</Num></View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}><Text size={13.5} color="muted">{costsLabel}</Text><Num size={13.5} weight={500}>{costs}</Num></View>
      <View style={{ marginTop: 14, paddingTop: 14 }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0 }}><Hairline inset={0} /></View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <View style={{ gap: 2, flexShrink: 1 }}>
            <Text size={14.5} weight={500}>{title}</Text>
            <Text size={12.5} color={noteTone}>{note}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Num size={28} weight={600} tracking={-0.035}>{pct}</Num>
            <Num size={12.5} weight={500} color="muted">{amount}</Num>
          </View>
        </View>
        <View style={{ marginTop: 12 }}><Progress value={bar} fill={fill} height={6} label={title} /></View>
      </View>
    </Card>
  );
}

export function KpiPair({ cells, children }: { cells: { label: string; value: ReactNode; sub: ReactNode }[]; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line }}>
      {cells.map((c, i) => (
        <View key={i} style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 14, paddingHorizontal: 16, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.line }}>
          <Text size={12.5} color="muted">{c.label}</Text>
          {c.value}
          <Text size={11.5} color="muted">{c.sub}</Text>
        </View>
      ))}
      {children}
    </View>
  );
}

/** The page's top: a violet dot and the signing line, the 24/600 heading and one paragraph of 14.5 `t2`. */
export function SetupIntro({ line, heading, intro }: { line: string; heading: string; intro: string }) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.acc }} />
        <Text size={12.5} color="muted">{line}</Text>
      </View>
      <Text size={24} weight={600} tracking={-0.035} leading={1.2} accessibilityRole="header" style={{ marginTop: 8 }}>{heading}</Text>
      <Text size={14.5} color="t2" leading={1.45} style={{ marginTop: 6 }}>{intro}</Text>
    </View>
  );
}

/** The client's row (a 34 avatar, name, address) over the two figures, in one card. */
export function ClientFigures({ avatar, name, address, cells }: { avatar: ReactNode; name: string; address?: string; cells: { label: string; value: ReactNode; sub: ReactNode }[] }) {
  return (
    <Card style={{ marginTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
        {avatar}
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
          {address ? <Text size={12.5} color="muted" numberOfLines={1}>{address}</Text> : null}
        </View>
      </View>
      <KpiPair cells={cells} />
    </Card>
  );
}

/** "Shift everything to start on": a card (padding 14 16 16) with a title, a muted line and a row of chips that scrolls sideways. */
export function ShiftCard({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <Card padded>
      <Text size={14.5} weight={500}>{title}</Text>
      <Text size={12.5} color="muted" style={{ marginTop: 1 }}>{sub}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>{children}</ScrollView>
    </Card>
  );
}
