// Pieces of the Quote editor (QuoteEditor.dc.html).
// EditableTitle: the title as a 24/600 field with no box. NavCard: a card row (title 14.5/500 over a 12.5 muted line, a status).
// ChapterBand: a chapter's header band (`soft`, hairline under, padding 12 16 10): its name 13.5/600, its subtotal 13.5 muted.
// LineEdit: a line: a 28 x 44 grip (move up) beside the name 14.5/500 and amount 14.5/600, and under them 36 tall fields
// (`sunk`, radius 10): quantity 58 wide, a unit chip, ×, rate 82 wide, then the price-check flag. Read-only drops the boxes.
// TierCard: an option (card, radius 22; chosen ring 2 `ink`): name, a muted line, the price 17/600, checks, Recommend / Edit.
// TermRow: a payment term (a 10 swatch, label over "when", a stepper or the percent, the amount 78 wide). ScheduleBar: segments in a 10 bar.
import { useEffect, useState, type ReactNode } from "react";
import { TextInput, View } from "react-native";
import { Card, Hairline } from "./Card";
import { inputText, noOutline, usePlaceholder } from "./Field";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

export function EditableTitle({ value, onChange, label, readOnly, placeholder }: { value: string; onChange: (v: string) => void; label: string; readOnly?: boolean; placeholder?: string }) {
  const { colors } = useTheme();
  const ph = usePlaceholder();
  return (
    <TextInput value={value} onChangeText={onChange} editable={!readOnly} accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={ph} multiline blurOnSubmit returnKeyType="done"
      style={[inputText(colors, {}), { fontSize: 24, lineHeight: 29, fontWeight: undefined, letterSpacing: -0.84, paddingVertical: 0, paddingHorizontal: 0, marginTop: 8 }, noOutline]} />
  );
}

export function NavCard({ title, sub, status, onPress }: { title: string; sub: string; status: ReactNode; onPress?: () => void }) {
  return (
    <Card>
      <Press onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={title} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingLeft: 16, paddingRight: 14, minHeight: 60 }}>
        <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
          <Text weight={500} numberOfLines={1}>{title}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
        </View>
        {status}
      </Press>
    </Card>
  );
}

export function ChapterBand({ name, sub }: { name: string; sub: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 12, paddingBottom: 10, paddingHorizontal: 16, backgroundColor: colors.soft, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text size={13.5} weight={600} numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
      <Num size={13.5} weight={400} color="muted">{sub}</Num>
    </View>
  );
}

/** A number field that holds what is being typed and hands the number over when the person is done (blur or return). */
export function NumField({ value, onCommit, label, width, readOnly, format }: { value: number; onCommit: (text: string) => void; label: string; width: number; readOnly?: boolean; format: (n: number) => string }) {
  const { colors } = useTheme();
  const [text, setText] = useState(format(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setText(format(value)); }, [value, focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => { setFocus(false); onCommit(text); };
  return (
    <TextInput value={text} onChangeText={setText} onFocus={() => setFocus(true)} onBlur={commit} onSubmitEditing={commit} editable={!readOnly} accessibilityLabel={label} keyboardType="decimal-pad" selectTextOnFocus
      style={[inputText(colors, { numeric: true }), { width, height: 36, borderRadius: 10, textAlign: "right", paddingHorizontal: readOnly ? 2 : 10, fontSize: 14.5, backgroundColor: readOnly ? "transparent" : focus ? colors.card : colors.sunk, boxShadow: focus ? `0 0 0 1.5px ${colors.acc}` : undefined }, noOutline]} />
  );
}

export function LineEdit({ name, nameLabel, onName, amount, qty, onQty, unit, onUnit, rate, onRate, flag, flagLabel, onFlag, onUp, upLabel, qtyLabel, rateLabel, readOnly, format }: {
  name: string; nameLabel: string; onName?: (v: string) => void; amount: string; qty: number; onQty: (text: string) => void; unit: string; onUnit?: (v: string) => void; rate: number; onRate: (text: string) => void;
  flag?: ReactNode; flagLabel?: string; onFlag?: () => void; onUp?: () => void; upLabel?: string; qtyLabel: string; rateLabel: string; readOnly?: boolean; format: (n: number) => string;
}) {
  const { colors } = useTheme();
  const ph = usePlaceholder();
  return (
    <View style={{ flexDirection: "row", gap: 6, paddingVertical: 12, paddingRight: 16, paddingLeft: readOnly ? 16 : 8 }}>
      {!readOnly ? (
        <Press onPress={onUp} accessibilityRole="button" accessibilityLabel={upLabel} hitSlop={6} style={{ width: 28, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Glyph name="grip" size={14} color="faint" />
        </Press>
      ) : null}
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <TextInput value={name} onChangeText={onName} editable={!readOnly} accessibilityLabel={nameLabel} placeholderTextColor={ph} multiline blurOnSubmit
            style={[inputText(colors, { weight: 500 }), { flexShrink: 1, flexGrow: 1, minWidth: 0, fontSize: 14.5, lineHeight: 19, paddingVertical: 0, paddingHorizontal: 0 }, noOutline]} />
          <Num size={14.5} weight={600} style={{ flexShrink: 0 }}>{amount}</Num>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <NumField value={qty} onCommit={onQty} label={qtyLabel} width={58} readOnly={readOnly} format={format} />
          <View style={{ height: 36, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.soft, boxShadow: `inset 0 0 0 1px ${colors.line2}`, justifyContent: "center", flexShrink: 0, maxWidth: 80 }}>
            <TextInput value={unit} onChangeText={onUnit} editable={!readOnly && !!onUnit} accessibilityLabel={`${qtyLabel}: ${unit}`} autoCapitalize="none" maxLength={10}
              style={[inputText(colors, {}), { fontSize: 12.5, paddingVertical: 0, paddingHorizontal: 0, minWidth: 24, textAlign: "center" }, noOutline]} />
          </View>
          <Text size={13.5} color="faint">×</Text>
          <NumField value={rate} onCommit={onRate} label={rateLabel} width={82} readOnly={readOnly} format={format} />
          <View style={{ flexGrow: 1 }} />
          {flag ? <Press onPress={onFlag} accessibilityRole="link" accessibilityLabel={flagLabel} hitSlop={8}>{flag}</Press> : null}
        </View>
      </View>
    </View>
  );
}

/** One card of chapters (each a band and its lines) with hairlines between lines and an optional footer. */
export function LineEditCard({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <Card>
      {children}
      {footer ? <View><Hairline inset={0} />{footer}</View> : null}
    </Card>
  );
}

export function Divided({ children }: { children: ReactNode[] }) {
  return <>{children.map((c, i) => <View key={i}>{i > 0 ? <Hairline inset={0} /> : null}{c}</View>)}</>;
}

export function ExclusionRow({ text, onRemove, removeLabel }: { text: string; onRemove?: () => void; removeLabel?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingVertical: 8, paddingLeft: 16, paddingRight: 8 }}>
      <Text leading={1.35} style={{ flexShrink: 1, flexGrow: 1 }}>{text}</Text>
      {onRemove ? (
        <Press onPress={onRemove} accessibilityRole="button" accessibilityLabel={removeLabel} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Glyph name="close" size={16} color="faint" /></Press>
      ) : null}
    </View>
  );
}

export function TierCard({ name, sub, price, priceSub, chosen, icon, includes, children }: { name: string; sub: string; price: string; priceSub: string; chosen: boolean; icon: ReactNode; includes: string[]; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: 16, paddingTop: 14, gap: 10, borderRadius: 22, backgroundColor: colors.card, boxShadow: chosen ? `0 0 0 2px ${colors.ink}, 0 12px 24px -16px ${colors.shadow}` : `0 0 0 1px ${colors.ring}` }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {icon}
        <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
          <Text size={15} weight={600}>{name}</Text>
          {sub ? <Text size={12.5} color="muted" numberOfLines={2}>{sub}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 1 }}>
          <Num size={17} weight={600} tracking={-0.02}>{price}</Num>
          <Text size={11.5} color="muted">{priceSub}</Text>
        </View>
      </View>
      {includes.length ? (
        <View style={{ gap: 4, paddingLeft: 42 }}>
          {includes.map((x, i) => <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}><Glyph name="check" size={14} weight={2.4} color="ink" /><Text size={13.5} color="t2" leading={1.35} style={{ flexShrink: 1 }}>{x}</Text></View>)}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, paddingLeft: 42 }}>{children}</View>
    </View>
  );
}

export function ScheduleBar({ segments }: { segments: { id: string; pct: number; color: ColorName }[] }) {
  const { colors } = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", height: 10, borderRadius: 6, overflow: "hidden", gap: 2, backgroundColor: colors.sunk }}>
      {segments.filter((s) => s.pct > 0).map((s) => <View key={s.id} style={{ width: `${Math.min(100, s.pct)}%`, height: "100%", backgroundColor: colors[s.color] }} />)}
    </View>
  );
}

export function TermRow({ color, label, when, right, amount, amountColor = "ink" }: { color: ColorName; label: string; when: string; right: ReactNode; amount: string; amountColor?: ColorName }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 60 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors[color], flexShrink: 0 }} />
      <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
        <Text weight={500} numberOfLines={1}>{label}</Text>
        <Text size={12.5} color="muted" numberOfLines={2}>{when}</Text>
      </View>
      {right}
      <Num size={14.5} weight={600} color={amountColor} align="right" style={{ width: 78, flexShrink: 0 }}>{amount}</Num>
    </View>
  );
}


/** A section title (15/600) with a control on the right (a switch, a status), padding 0 4 10. */
export function SectionTitleRow({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 4, paddingBottom: 10, minHeight: 44 }}>
      <Text size={15} weight={600} tracking={-0.02} accessibilityRole="header" style={{ flexShrink: 1 }}>{title}</Text>
      {right}
    </View>
  );
}

/** A quiet note under a section: 12.5 muted, 1.4, padding 4 horizontal. */
export function Hint({ children }: { children: string }) {
  return <Text size={12.5} color="muted" leading={1.4} style={{ marginHorizontal: 4 }}>{children}</Text>;
}

/** A card holding one muted line (the "One price only" card). */
export function NoteCard({ children }: { children: string }) {
  return <Card padded style={{ paddingVertical: 14 }}><Text size={13.5} color="muted">{children}</Text></Card>;
}
