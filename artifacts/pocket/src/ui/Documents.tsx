// Documents.dc.html: the price-move card (the item that moved most, its chart and who charges what), the "almost ready" row, a key-material row with
// its price line, a "read by AI" row, a folder tile, and the upload sheet's options. Sizes are the board's own (.dc-spark, .dc-sup, .dc-fold, .dc-opt).
import { useState, type ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, Path, Polygon, Polyline } from "react-native-svg";
import { chartPoints } from "@/lib/documents";
import { tokens } from "@/theme/tokens";
import { Card, Hairline } from "./Card";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Spark } from "./Materials";
import { Press } from "./motion";
import { Status, type StatusShape, type StatusTone } from "./Status";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

/** An icon that keeps its size when the words beside it run long. */
function Ico({ name, tone, size }: { name: IconName; tone: Tone; size: number }) {
  return <View style={{ width: size, height: size, flexShrink: 0 }}><Icon name={name} tone={tone} size={size} /></View>;
}

/** `.dc-spark` big: the price line over six months with its area under it and a dot on the last price, drawn at the width it is given. */
export function TrendChart({ values, color, label }: { values: number[]; color: ColorName; label: string }) {
  const { colors } = useTheme();
  const [w, setW] = useState(320);
  const { line, last } = chartPoints(values, w, 64, 4);
  const pts = line.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} onLayout={(e) => setW(Math.max(120, Math.round(e.nativeEvent.layout.width)))} style={{ marginTop: 14 }}>
      <Svg width="100%" height={64} viewBox={`0 0 ${w} 64`}>
        <Polygon points={`4,64 ${pts} ${w - 4},64`} fill={colors[color]} fillOpacity={0.1} />
        <Polyline points={pts} fill="none" stroke={colors[color]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={last[0]} cy={last[1]} r={4} fill={colors[color]} />
      </Svg>
    </View>
  );
}

/** The thin arrow between the old price and the new one (16×12, 1.8 stroke). */
function Arrow() {
  const { colors } = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={16} height={12} viewBox="0 0 16 12"><Path d="M1 6h13M10 2l4 4-4 4" fill="none" stroke={colors.faint} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
    </View>
  );
}

/** The card for the item that moved most: the title and its pill, "was → now", the chart with its months, and a row for each store. */
export function TrendCard({ title, sub, pill, pillTone, pillShape, was, now, color, values, chartLabel, months, stores, children }: {
  title: string; sub: string; pill: string; pillTone: StatusTone; pillShape: StatusShape; was: string; now: string; color: ColorName; values: number[]; chartLabel: string; months: string[];
  stores: { name: string; when: string; price: string; best?: boolean }[]; children?: ReactNode;
}) {
  return (
    <Card padded>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <Ico name="bars" tone="amber" size={28} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={15} weight={600}>{title}</Text>
          <Text size={12.5} color="muted">{sub}</Text>
        </View>
        <Status tone={pillTone} shape={pillShape}>{pill}</Status>
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 16 }}>
        {was ? <Num size={17} weight={400} color="muted" style={{ textDecorationLine: "line-through" }}>{was}</Num> : null}
        {was ? <Arrow /> : null}
        <Num size={32} weight={600} tracking={-0.04} leading={1}>{now}</Num>
      </View>
      <TrendChart values={values} color={color} label={chartLabel} />
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        {months.map((m, i) => <Text key={i} size={11.5} color="faint">{m}</Text>)}
      </View>
      {stores.length ? (
        <View style={{ marginTop: 14 }}>
          <Hairline inset={0} />
          {stores.map((s, i) => (
            <View key={i}>
              {i > 0 ? <Hairline inset={0} /> : null}
              <View accessible accessibilityLabel={`${s.name}, ${s.when}, ${s.price}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }}>
                <Text size={13.5} numberOfLines={1} style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>{s.name}</Text>
                <Text size={12.5} color="muted">{s.when}</Text>
                <View style={{ minWidth: 58, alignItems: "flex-end" }}><Num size={13.5} weight={600} color={s.best ? "ok" : "ink"}>{s.price}</Num></View>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {children ? <View style={{ marginTop: 8, gap: 8 }}>{children}</View> : null}
    </Card>
  );
}

/** The two-button row under the stores. */
export function ButtonPair({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 8 }}>{children}</View>;
}

/** "Insulation prices almost ready · 2 of 3 invoices in" with a bar of three marks, two of them filled. */
export function AlmostRow({ title, sub, have, need }: { title: string; sub: string; have: number; need: number }) {
  const { colors } = useTheme();
  return (
    <Card accessible accessibilityLabel={`${title}, ${sub}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
      <Ico name="box" tone="teal" size={28} />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={600}>{title}</Text>
        <Text size={12.5} color="muted">{sub}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 4, flexShrink: 0 }}>
        {Array.from({ length: need }, (_, i) => <View key={i} style={{ width: 14, height: 6, borderRadius: 3, backgroundColor: i < have ? colors.inv : colors.line2 }} />)}
      </View>
    </Card>
  );
}

/** A key material: the name over the store and how many invoices, its price line, the price and how it moved. */
export function MaterialRow({ name, sub, spark, color, price, change, first }: { name: string; sub: string; spark: number[]; color: ColorName; price: string; change: string; first?: boolean }) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <View accessible accessibilityLabel={`${name}, ${sub}, ${price}, ${change}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
        </View>
        <Spark points={spark} color={color} />
        <View style={{ alignItems: "flex-end", gap: 4, minWidth: 70, flexShrink: 0 }}>
          <Num size={14.5} weight={600}>{price}</Num>
          <Num size={11.5} weight={600} color={color}>{change}</Num>
        </View>
      </View>
    </View>
  );
}

/** A document the AI read (or is reading): its icon, name over what was read, and its status word. */
export function ReadRow({ icon, tone, name, sub, status, statusTone, statusShape, first }: { icon: IconName; tone: Tone; name: string; sub: string; status: string; statusTone: StatusTone; statusShape: StatusShape; first?: boolean }) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <View accessible accessibilityLabel={`${name}, ${sub}, ${status}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
        <Ico name={icon} tone={tone} size={26} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
        </View>
        <Status tone={statusTone} shape={statusShape}>{status}</Status>
      </View>
    </View>
  );
}

/** `.dc-fold`: a folder tile in the two-column grid, 112 tall at least, a 28 icon over the name and "client · files". */
export function FolderTile({ icon, tone, name, sub, onPress }: { icon: IconName; tone: Tone; name: string; sub: string; onPress?: () => void }) {
  const body = (
    <>
      <Icon name={icon} tone={tone} size={28} />
      <View style={{ gap: 2, minWidth: 0, width: "100%" }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
      </View>
    </>
  );
  const box = { alignItems: "flex-start", gap: 10, padding: 14, minHeight: 112 } as const;
  return onPress ? (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}, ${sub}`} style={{ flex: 1, minWidth: 0 }}>
      <Card style={{ ...box, borderRadius: tokens.radius.tile }}>{body}</Card>
    </Press>
  ) : (
    <View accessible accessibilityLabel={`${name}, ${sub}`} style={{ flex: 1, minWidth: 0 }}>
      <Card style={{ ...box, borderRadius: tokens.radius.tile }}>{body}</Card>
    </View>
  );
}

/** The folders in rows of two. */
export function FolderGrid({ children }: { children: ReactNode[] }) {
  const rows: ReactNode[][] = [];
  children.forEach((c, i) => (i % 2 ? rows[rows.length - 1]!.push(c) : rows.push([c])));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
          {r}
          {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

/** `.dc-opt`: a row of the upload sheet: a 28 icon, the label over a line, a chevron. */
export function UploadOption({ icon, tone, label, sub, onPress, first }: { icon: IconName; tone: Tone; label: string; sub: string; onPress: () => void; first?: boolean }) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ${sub}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 16, minHeight: 44 }}>
        <Ico name={icon} tone={tone} size={28} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500}>{label}</Text>
          <Text size={12.5} color="muted">{sub}</Text>
        </View>
        <Glyph name="chevron" size={15} color="faint" />
      </Press>
    </View>
  );
}

/** The upload sheet's head (.sheet): the title and a muted line, and a 36 round close button in `sunk` (the hit area is 44). */
export function SheetHead({ title, sub, closeLabel, onClose }: { title: string; sub: string; closeLabel: string; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 4, paddingBottom: 10, paddingLeft: 4 }}>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Text size={19} weight={600} tracking={-0.03} accessibilityRole="header">{title}</Text>
        <Text size={12.5} color="muted">{sub}</Text>
      </View>
      <Press onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} hitSlop={4} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center" }}>
        <Glyph name="close" size={16} weight={2.2} />
      </Press>
    </View>
  );
}
