// Imports.dc.html: the three-part progress bar, a column of the file with the field it goes to (a button that cycles), the preview table, the ring while rows are added,
// the three figures when it is done, a possible duplicate to merge or keep, and a skipped row with its one action.
import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Card, Hairline } from "./Card";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Text, Num } from "./Text";
import { useTheme, type ColorName } from "./theme";

/** `.steps`: three 4 tall bars, the ones reached in `inv`. */
export function StepBar({ reached, label }: { reached: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: "row", gap: 6, paddingTop: 6, paddingHorizontal: 20 }}>
      {[1, 2, 3].map((n) => <View key={n} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: n <= reached ? colors.inv : colors.line2 }} />)}
    </View>
  );
}

/** One column of the file: its name and first value on the left, an arrow, and the field it goes to on a `sunk` button (outlined when it is skipped). */
export function MapRow({ col, example, to, skip, label, onPick }: { col: string; example: string; to: string; skip: boolean; label: string; onPick: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, paddingLeft: 16, paddingRight: 14 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{col}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{example}</Text>
      </View>
      <Glyph name="chevron" size={16} color="faint" />
      <Press onPress={onPick} accessibilityRole="button" accessibilityLabel={label}
        style={{ flex: 1.1, minWidth: 0, height: 44, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, paddingLeft: 12, paddingRight: 10, backgroundColor: skip ? "transparent" : colors.sunk, borderWidth: skip ? 1 : 0, borderColor: colors.line2 }}>
        <Text size={13.5} weight={500} color={skip ? "muted" : "ink"} numberOfLines={1} style={{ flexShrink: 1 }}>{to}</Text>
        <Glyph name="chevronDown" size={14} color="faint" />
      </Press>
    </View>
  );
}

/** The header and the first rows as the file will become them: three columns. */
export function PreviewTable({ head, rows }: { head: [string, string, string]; rows: [string, string, string][] }) {
  const line = (cells: [string, string, string], key: string, header?: boolean) => (
    <View key={key} style={{ flexDirection: "row", gap: 8, paddingVertical: 9, paddingHorizontal: 14 }}>
      {cells.map((c, i) => (
        <View key={i} style={{ flex: i === 0 ? 1.2 : i === 1 ? 1 : 1.3, minWidth: 0 }}>
          {header ? <Text size={11.5} color="muted" numberOfLines={1}>{c}</Text> : i === 1 ? <Num size={12.5} weight={500} numberOfLines={1}>{c}</Num> : <Text size={12.5} weight={i === 0 ? 500 : 400} color={i === 0 ? "ink" : "muted"} numberOfLines={1}>{c}</Text>}
        </View>
      ))}
    </View>
  );
  return (
    <Card>
      {line(head, "head", true)}
      {rows.map((r, i) => <View key={i}><Hairline inset={0} />{line(r, `r${i}`)}</View>)}
    </Card>
  );
}

/** The 150 ring: the share done in the middle and "{n} of {total}" under it. */
export function ProgressRing({ pct, done, total, of, label }: { pct: number; done: string; total: string; of: string; label: string }) {
  const { colors } = useTheme();
  const c = 389.6;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ width: 150, height: 150 }}>
      <Svg width={150} height={150} viewBox="0 0 150 150" style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={75} cy={75} r={62} fill="none" stroke={colors.sunk} strokeWidth={10} />
        <Circle cx={75} cy={75} r={62} fill="none" stroke={colors.acc} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${c}`} strokeDashoffset={c * (1 - pct / 100)} />
      </Svg>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <Num size={32} weight={600} tracking={-0.04}>{`${pct}%`}</Num>
        <Text size={12.5} color="muted"><Num size={12.5} color="muted">{done}</Num>{` ${of} `}<Num size={12.5} color="muted">{total}</Num></Text>
      </View>
    </View>
  );
}

/** "Added / To check / Skipped": three figures in one card with hairlines between them. */
export function ImportSummary({ items }: { items: { label: string; value: string; tone?: Extract<ColorName, "ok" | "warn" | "bad"> }[] }) {
  const { colors } = useTheme();
  return (
    <Card style={{ flexDirection: "row", paddingVertical: 14, paddingHorizontal: 4 }}>
      {items.map((k, i) => (
        <View key={k.label} style={{ flex: 1, gap: 3, paddingHorizontal: 12, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.line }}>
          <Text size={11.5} color="muted">{k.label}</Text>
          <Num size={19} weight={600} tracking={-0.03} color={k.tone ?? "ink"}>{k.value}</Num>
        </View>
      ))}
    </Card>
  );
}

/** A row of a list in a card: whatever sits left, the text, and what sits right. */
export function ImportLine({ left, title, sub, subTone, right, first, onPress, chevron }: { left?: ReactNode; title: string; sub?: string; subTone?: Extract<ColorName, "bad">; right?: ReactNode; first?: boolean; onPress?: () => void; chevron?: boolean }) {
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: onPress ? 13 : 12, paddingHorizontal: 16, minHeight: 44 }}>
      {left}
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
        {sub ? <Text size={12.5} color={subTone ?? "muted"} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {right}
      {chevron ? <Glyph name="chevron" size={15} color="faint" /> : null}
    </View>
  );
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      {onPress ? <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={[title, sub].filter(Boolean).join(", ")}>{body}</Press> : body}
    </View>
  );
}

/** The row's number in the file, in Manrope, for a skipped row. */
export function RowNo({ children }: { children: string }) {
  return <Num size={12.5} color="muted" style={{ width: 58 }} numberOfLines={1}>{children}</Num>;
}

/** A step's heading: 24/600 over a 13.5 muted line. */
export function StepHead({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text size={24} weight={600} tracking={-0.035} accessibilityRole="header">{title}</Text>
      <Text size={13.5} color="muted">{sub}</Text>
    </View>
  );
}

/** "In your file" over the left column, "In quoteAI" over the right one. */
export function MapHeader({ left, right }: { left: string; right: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, paddingTop: 12, paddingBottom: 8, paddingHorizontal: 16 }}>
      <Text size={11.5} color="muted" style={{ flex: 1 }}>{left}</Text>
      <Text size={11.5} color="muted" style={{ flex: 1.1, marginLeft: 26 }}>{right}</Text>
    </View>
  );
}

/** While rows go in: the ring, a 21 title and a line, centred. */
export function RunHead({ pct, done, total, of, title, sub }: { pct: number; done: string; total: string; of: string; title: string; sub: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <ProgressRing pct={pct} done={done} total={total} of={of} label={title} />
      <Text size={21} weight={600} tracking={-0.03} align="center" style={{ marginTop: 22 }} accessibilityRole="header">{title}</Text>
      <Text size={13.5} color="muted" align="center" style={{ marginTop: 6 }}>{sub}</Text>
    </View>
  );
}

/** When it is done: a big check, the title and the file line. */
export function DoneHead({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      {icon}
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Text size={24} weight={600} tracking={-0.035} accessibilityRole="header">{title}</Text>
        <Text size={13.5} color="muted">{sub}</Text>
      </View>
    </View>
  );
}

/** A client in the file that looks like one you have: who, why, its state and (until decided) the two buttons. */
export function MatchRow({ first, avatar, name, sub, state, actions }: { first?: boolean; avatar: ReactNode; name: string; sub: string; state: ReactNode; actions?: ReactNode }) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <View style={{ paddingVertical: 13, paddingHorizontal: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {avatar}
          <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
            <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
            <Text size={12.5} color="muted" numberOfLines={2}>{sub}</Text>
          </View>
          {state}
        </View>
        {actions ? <View style={{ flexDirection: "row", gap: 8, paddingLeft: 50 }}>{actions}</View> : null}
      </View>
    </View>
  );
}
