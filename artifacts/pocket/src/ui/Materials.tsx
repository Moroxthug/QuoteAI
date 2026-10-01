// The Materials boards: PriceBook, Inventory, Suppliers and Supplier. The pieces they draw that no other screen has (the rate with its unit,
// an assembly's parts, a stock row with its bar, the reorder suggestion, the quantity stepper, a price's sparkline). Sizes are the boards' own.
import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { Hairline } from "./Card";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

// ── PriceBook ─────────────────────────────────────────────────────────────────

/** `.pb-rate`: the price in Manrope 14.5/600 and the unit beside it, 12.5 muted, on one baseline. */
export function RateFigure({ rate, unit }: { rate: string; unit: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
      <Num size={14.5} weight={600}>{rate}</Num>
      <Text size={12.5} color="muted" numberOfLines={1}>{unit}</Text>
    </View>
  );
}

/** `.pb-parts`: an assembly's parts under its row (inset 54, past the icon), a dashed rule over each, and the company's cost in 600 last. */
export function PartsList({ parts, costLabel, cost }: { parts: { name: string; value: string }[]; costLabel: string; cost?: string }) {
  const { colors } = useTheme();
  const line = { flexDirection: "row" as const, justifyContent: "space-between" as const, gap: 10, paddingVertical: 7, borderTopWidth: 1, borderStyle: "dashed" as const, borderTopColor: colors.line2 };
  return (
    <View style={{ paddingTop: 2, paddingBottom: 14, paddingLeft: 54, paddingRight: 16 }}>
      {parts.map((p, i) => (
        <View key={i} style={line}>
          <Text size={13.5} color="t2" style={{ flexShrink: 1 }}>{p.name}</Text>
          <Num size={13.5} style={{ flexShrink: 0 }}>{p.value}</Num>
        </View>
      ))}
      {cost ? (
        <View style={line}>
          <Text size={13.5} weight={600}>{costLabel}</Text>
          <Num size={13.5} weight={600}>{cost}</Num>
        </View>
      ) : null}
    </View>
  );
}

/** A figure with its label above it in the Add item sheet: the margin line, "Margin 32%" with the figure green. */
export function MarginLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 4, paddingLeft: 2 }}>
      <Text size={12.5} color="muted">{label}</Text>
      <Num size={12.5} weight={600} color="ok">{value}</Num>
    </View>
  );
}

/** A group of rows that rests on the page between a section's rows (the added item flashes `acc-soft`). */
export function Flash({ on, children }: { on: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ backgroundColor: on ? colors["acc-soft"] : undefined }}>{children}</View>;
}

// ── Inventory ─────────────────────────────────────────────────────────────────

/** `.inv-step`: a `sunk` well, radius 13, padding 3, with 44 square buttons (radius 11) around the figure in Manrope 17/600. */
export function QtyStepper({ value, onDec, onInc, decLabel, incLabel }: { value: string; onDec: () => void; onInc: () => void; decLabel: string; incLabel: string }) {
  const { colors } = useTheme();
  const btn = (glyph: "minus" | "plus", label: string, onPress: () => void) => (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center" }}>
      <Glyph name={glyph} size={16} weight={2.2} />
    </Press>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.sunk, borderRadius: 13, padding: 3, flexShrink: 0 }}>
      {btn("minus", decLabel, onDec)}
      <Num size={17} weight={600} align="center" accessibilityLiveRegion="polite" style={{ minWidth: 44 }}>{value}</Num>
      {btn("plus", incLabel, onInc)}
    </View>
  );
}

/** `.inv-radio` inside a `.lrow`: a 22 ring that fills with `inv` (inset 7) when chosen. */
export function Radio({ on }: { on: boolean }) {
  const { colors } = useTheme();
  return <View style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, borderWidth: on ? 7 : 1.5, borderColor: on ? colors.inv : colors.line2 }} />;
}

/** One choice of a radio list in a card (a supplier to reorder from): the radio, name and sub-line, the price and a tag under it. */
export function OptionRow({ on, title, sub, price, tag, tagTone, onPress, label, first }: {
  on: boolean; title: string; sub: string; price?: string; tag?: string; tagTone?: ColorName; onPress: () => void; label: string; first?: boolean;
}) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <Press onPress={onPress} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: on }}
        style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16 }}>
        <Radio on={on} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
          {sub ? <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text> : null}
        </View>
        {price || tag ? (
          <View style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
            {price ? <Num size={14.5} weight={600}>{price}</Num> : null}
            {tag ? <Text size={11.5} color={tagTone ?? "muted"}>{tag}</Text> : null}
          </View>
        ) : null}
      </Press>
    </View>
  );
}

/** A "Running low" row: the name and what is left, the status, and under them the suggestion in a `soft` box with its button. */
export function LowRow({ name, left, status, suggestion, suggestionSub, action, first }: {
  name: string; left: ReactNode; status: ReactNode; suggestion: string; suggestionSub: string; action?: ReactNode; first?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
            <Text size={14.5} weight={500}>{name}</Text>
            {left}
          </View>
          {status}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 12, paddingRight: 10, borderRadius: 14, backgroundColor: colors.soft, boxShadow: `0 0 0 1px ${colors.line}` }}>
          <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 1 }}>
            <Text size={13.5} weight={500}>{suggestion}</Text>
            <Text size={12.5} color="muted">{suggestionSub}</Text>
          </View>
          {action}
        </View>
      </View>
    </View>
  );
}

/** An "All stock" row: name and count, a 4 tall bar (amber when low, green when fine), where it is, and what is reserved with a lock. */
export function StockRow({ name, qty, unit, fill, low, where, reserved, first }: {
  name: string; qty: string; unit: string; /** 0 to 1 */ fill: number; low: boolean; where: ReactNode; reserved: ReactNode[]; first?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <Text size={14.5} weight={500} style={{ flexShrink: 1 }}>{name}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, flexShrink: 0 }}>
            <Num size={15} weight={600}>{qty}</Num>
            <Text size={12.5} color="muted">{unit}</Text>
          </View>
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 4, borderRadius: 4, backgroundColor: colors.sunk, overflow: "hidden" }}>
          <View style={{ width: `${Math.round(Math.min(1, Math.max(0, fill)) * 100)}%`, height: 4, borderRadius: 4, backgroundColor: low ? colors["warn-dot"] : colors["ok-dot"] }} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 4 }}>{where}</View>
        {reserved.map((r, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Glyph name="lock" size={13} weight={2.2} color="acc-t" />
            <Text size={12.5} color="acc-t" style={{ flexShrink: 1 }}>{r}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** One place and its count in a stock row: "Shop 8". */
export function Where({ name, n }: { name: string; n: string }) {
  return (
    <Text size={12.5} color="muted">
      {name} <Num size={12.5} weight={500} color="t2">{n}</Num>
    </Text>
  );
}

// ── Supplier ──────────────────────────────────────────────────────────────────

/** `.spd-spark`: a 64×28 line of the last prices, the last one dotted; coloured by which way it went. */
export function Spark({ points, color }: { points: number[]; color: ColorName }) {
  const { colors } = useTheme();
  const mn = Math.min(...points);
  const mx = Math.max(...points);
  const rg = mx - mn || 1;
  const pts = points.map((v, i) => [2 + i * (60 / Math.max(1, points.length - 1)), mx === mn ? 14 : 24 - ((v - mn) / rg) * 20] as const);
  const last = pts[pts.length - 1]!;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexShrink: 0 }}>
    <Svg width={64} height={28} viewBox="0 0 64 28">
      <Polyline points={pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} fill="none" stroke={colors[color]} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={2.6} fill={colors[color]} />
    </Svg>
    </View>
  );
}

/** `.spd-kv`: a label over a figure in a cell of the terms card. */
export function KeyCell({ label, value, first }: { label: string; value: string; first?: boolean }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 12, paddingHorizontal: 16, borderLeftWidth: first ? 0 : 1, borderLeftColor: colors.line }}>
      <Text size={11.5} color="muted">{label}</Text>
      <Num size={15} weight={600}>{value}</Num>
    </View>
  );
}

/** Two fields side by side, each half the width (the Add item sheet's price and cost, the supplier form's terms and discount). */
export function TwoCols({ children }: { children: [ReactNode, ReactNode] }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>{children[0]}</View>
      <View style={{ flex: 1, minWidth: 0 }}>{children[1]}</View>
    </View>
  );
}

/** A label with a line under it on the left and a control on the right (the reorder quantity and a count): the words give way when they run long. */
export function LabelRow({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500}>{title}</Text>
        {sub ? <Text size={12.5} color="muted">{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}
