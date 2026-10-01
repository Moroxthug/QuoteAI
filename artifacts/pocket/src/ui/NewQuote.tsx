// Pieces of New quote (NewQuote.dc.html).
// DescribeCard: the 168-tall description box with the attach chips and the round mic under it. AttachChip: 36 tall, `soft`
// with a `line` ring, a 22 gradient icon and a 13.5/500 word. RoundMic: 52, `acc`, the violet glow (board.fqMicShadow).
// TargetBox: 44 tall, radius 12, `sunk`, the "$" beside the amount. ClientRow: a 34 avatar, name over address and a 22
// radio (an `ink` 6 ring when chosen, a 1.5 `line2` ring when not). WritingCard: the swirl, the title, the five steps
// (a check, a spinner or a dot) and, when it is done, the quote's summary. Manual: chapter heading, line, footer, the
// dashed "add a chapter", the taxes and totals card, the notes box. Price list: a row with Add / Added, a selection row.
import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { board } from "@/theme/board";
import { avatarTint, type AvatarTint } from "./Avatar";
import { Card, Hairline } from "./Card";
import type { NewClientForm } from "@/lib/newQuote";
import { inputText, noOutline, SelectField, TextField, usePlaceholder } from "./Field";
import { Glyph } from "./Icon";
import { Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { shadow } from "./shadow";
import { Switch } from "./Switch";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

// ── Write with AI ─────────────────────────────────────────────────────────────

export function DescribeCard({ value, onChange, label, placeholder, children }: { value: string; onChange: (v: string) => void; label: string; placeholder: string; children: ReactNode }) {
  const { colors } = useTheme();
  const ph = usePlaceholder();
  return (
    <Card style={{ paddingTop: 4, paddingHorizontal: 4, paddingBottom: 10 }}>
      <TextInput value={value} onChangeText={onChange} multiline accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={ph} textAlignVertical="top" autoCapitalize="sentences"
        style={[inputText(colors, {}), { minHeight: 168, fontSize: 16, lineHeight: 24, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 6 }, noOutline]} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 6, paddingRight: 8, paddingLeft: 10 }}>{children}</View>
    </Card>
  );
}

export function AttachChip({ label, text, icon, tone, onPress, on }: { label: string; text: string; icon: IconName; tone: Tone; onPress: () => void; on?: boolean }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }} hitSlop={{ top: 4, bottom: 4 }}
      style={{ height: 36, paddingLeft: 6, paddingRight: 10, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0, backgroundColor: on ? colors["acc-soft"] : colors.soft, boxShadow: `0 0 0 1px ${colors.line}` }}>
      <Icon name={icon} tone={tone} size={22} />
      <Text size={13.5} weight={500} color={on ? "acc-soft-t" : "ink"} numberOfLines={1}>{text}</Text>
    </Press>
  );
}

export type MicPhase = "idle" | "listening" | "busy";

/** The board's 52 round mic. Listening shows a tick (tap to finish) inside a ring; busy shows the three dots. */
export function RoundMic({ phase, label, onPress }: { phase: MicPhase; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} disabled={phase === "busy"} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: phase === "busy" }}
      style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.acc, alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: phase === "busy" ? 0.7 : 1,
        boxShadow: phase === "listening" ? `${board.fqMicShadow}, 0 0 0 5px ${colors["acc-soft"]}` : board.fqMicShadow }}>
      <Glyph name={phase === "listening" ? "check" : phase === "busy" ? "more" : "mic"} size={22} tint={board.white} weight={2} />
    </Press>
  );
}

/** A quiet line inside the describe card (a note about the mic, the photos that are attached) with an optional action. */
export function AttachNote({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, paddingTop: 8, paddingHorizontal: 14 }}>
      <Text size={12.5} color="muted" leading={1.4} style={{ flexShrink: 1 }}>{text}</Text>
      {action ? (
        <Press onPress={onAction} accessibilityRole="button" accessibilityLabel={action} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
          <Text size={12.5} weight={600} color="acc-soft-t">{action}</Text>
        </Press>
      ) : null}
    </View>
  );
}

export function TargetBox({ value, onChange, label, placeholder, suffix }: { value: string; onChange: (v: string) => void; label: string; placeholder: string; /** French puts the $ after the amount. */ suffix?: boolean }) {
  const { colors } = useTheme();
  const ph = usePlaceholder();
  const sign = <Num size={15} weight={400} color="muted">$</Num>;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 44, width: 132, borderRadius: 12, backgroundColor: colors.sunk, paddingHorizontal: 12, flexShrink: 0 }}>
      {suffix ? null : sign}
      <TextInput value={value} onChangeText={onChange} accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={ph} keyboardType="number-pad"
        style={[inputText(colors, { numeric: true }), { flexGrow: 1, flexShrink: 1, minWidth: 0, textAlign: "right", paddingVertical: 0, paddingHorizontal: 0 }, noOutline]} />
      {suffix ? sign : null}
    </View>
  );
}

export function RadioDot({ on }: { on: boolean }) {
  const { colors } = useTheme();
  return <View style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, boxShadow: on ? `inset 0 0 0 6px ${colors.ink}` : `inset 0 0 0 1.5px ${colors.line2}` }} />;
}

/** A row of the client list: avatar (or a plus), the name over a muted line, the radio. */
export function ClientRow({ name, sub, initials, tint, plus, selected, onPress, first }: { name: string; sub?: string; initials?: string; tint?: AvatarTint; plus?: boolean; selected: boolean; onPress: () => void; first?: boolean }) {
  const { colors } = useTheme();
  const t = avatarTint(tint ?? 5, colors);
  return (
    <View>
      {!first ? <Hairline inset={0} /> : null}
      <Press onPress={onPress} accessibilityRole="radio" accessibilityLabel={sub ? `${name}, ${sub}` : name} accessibilityState={{ checked: selected }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 56 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: plus ? colors.sunk : t.bg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {plus ? <Glyph name="plus" size={15} weight={2.3} /> : <Text size={11.5} weight={600} color={t.fg}>{initials ?? ""}</Text>}
        </View>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
          {sub ? <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text> : null}
        </View>
        <RadioDot on={selected} />
      </Press>
    </View>
  );
}

/** A line inside the client card that is not a client (loading, can't load, none yet) with an optional retry. */
export function ClientNote({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16, minHeight: 56 }}>
      <Text size={13.5} color="muted" leading={1.4} style={{ flexShrink: 1, flexGrow: 1 }}>{text}</Text>
      {action ? <Press onPress={onAction} accessibilityRole="button" accessibilityLabel={action} style={{ minHeight: 44, justifyContent: "center" }}><Text size={13.5} weight={600} color="acc-soft-t">{action}</Text></Press> : null}
    </View>
  );
}

/** "Remember this client": the label and its switch. */
export function SwitchRow({ label, value, onChange, sub }: { label: string; value: boolean; onChange: (v: boolean) => void; sub?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44 }}>
      <View style={{ flexShrink: 1, gap: 1 }}>
        <Text size={14.5} weight={500}>{label}</Text>
        {sub ? <Text size={12.5} color="muted">{sub}</Text> : null}
      </View>
      <Switch value={value} onChange={onChange} label={label} />
    </View>
  );
}

// ── The writing card ──────────────────────────────────────────────────────────

function useSpin(ms: number) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduced) { turn.value = 0; return; }
    turn.value = withRepeat(withTiming(360, { duration: ms, easing: Easing.linear }), -1, false);
  }, [reduced, ms, turn]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
}

function StepMark({ state }: { state: "done" | "cur" | "todo" }) {
  const { colors } = useTheme();
  const spin = useSpin(900);
  return (
    <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {state === "done" ? (
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors["ok-soft"], alignItems: "center", justifyContent: "center" }}><Glyph name="check" size={13} color="ok" weight={3} /></View>
      ) : state === "cur" ? (
        <Animated.View style={spin}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={9} stroke={colors.line2} strokeWidth={2.4} />
            <Path d="M12 3a9 9 0 0 1 9 9" stroke={colors.acc} strokeWidth={2.4} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      ) : (
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line2 }} />
      )}
    </View>
  );
}

export function WritingCard({ title, sub, steps, stepSr, ready, children }: { title: string; sub: string; steps: { label: string; state: "done" | "cur" | "todo" }[]; stepSr: Record<"done" | "cur" | "todo", string>; ready: boolean; children?: ReactNode }) {
  const spin = useSpin(6000);
  return (
    <Card style={{ paddingTop: 26, paddingHorizontal: 20, paddingBottom: 20 }}>
      <View style={{ alignItems: "center", gap: 6 }}>
        <Animated.View style={ready ? undefined : spin}><Icon name="orb" tone="violet" size={52} /></Animated.View>
        <Text size={21} weight={600} tracking={-0.03} align="center" accessibilityRole="header" accessibilityLiveRegion="polite" style={{ marginTop: 10 }}>{title}</Text>
        <Text size={13.5} color="muted" align="center">{sub}</Text>
      </View>
      <View style={{ marginTop: 22, gap: 2 }}>
        {steps.map((s, i) => (
          <View key={i} accessible accessibilityLabel={`${s.label}, ${stepSr[s.state]}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 40 }}>
            <StepMark state={s.state} />
            <Text size={14.5} weight={s.state === "cur" ? 600 : 400} color={s.state === "todo" ? "faint" : "ink"} style={{ flexShrink: 1 }}>{s.label}</Text>
          </View>
        ))}
      </View>
      {children}
    </Card>
  );
}

/** The ready card's summary: the quote's name, "5 lines in 2 chapters · Q-2026-119" and the total. */
export function ReadySummary({ title, meta, number, total }: { title: string; meta: string; number: string; total: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 16, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.soft, boxShadow: `0 0 0 1px ${colors.line}`, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Text size={14.5} weight={500}>{title}</Text>
        <Text size={12.5} color="muted">{number ? `${meta} · ${number}` : meta}</Text>
      </View>
      <Num size={19} weight={600} tracking={-0.03}>{total}</Num>
    </View>
  );
}

// ── Manual ────────────────────────────────────────────────────────────────────

/** The quote's client in the manual card: avatar 32, name over address, "Change". */
export function ClientLine({ name, sub, initials, tint, action, onAction }: { name: string; sub?: string; initials?: string; tint?: AvatarTint; action: string; onAction: () => void }) {
  const { colors } = useTheme();
  const t = avatarTint(tint ?? 5, colors);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: initials ? t.bg : colors.sunk, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {initials ? <Text size={11.5} weight={600} color={t.fg}>{initials}</Text> : <Glyph name="user" size={15} color="muted" weight={1.8} />}
      </View>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 1 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
        {sub ? <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text> : null}
      </View>
      <Press onPress={onAction} accessibilityRole="button" accessibilityLabel={action} hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
        style={{ height: 36, borderRadius: 11, paddingHorizontal: 13, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center" }}>
        <Text size={13.5} weight={600}>{action}</Text>
      </Press>
    </View>
  );
}

/** A chapter's heading: its number and name (or a field while renaming) and the "Rename" / "Done" link. */
export function ChapterHeading({ n, title, editing, onTitle, onToggle, renameLabel, doneLabel, fieldLabel, placeholder }: {
  n: number; title: string; editing: boolean; onTitle: (v: string) => void; onToggle: () => void; renameLabel: string; doneLabel: string; fieldLabel: string; placeholder: string;
}) {
  const { colors } = useTheme();
  const ph = usePlaceholder();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 4, paddingBottom: 10, minHeight: 44 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, flexGrow: 1 }}>
        <Num size={15} weight={600} color="faint">{n}</Num>
        {editing ? (
          <TextInput value={title} onChangeText={onTitle} autoFocus accessibilityLabel={fieldLabel} placeholder={placeholder} placeholderTextColor={ph} returnKeyType="done" onSubmitEditing={onToggle}
            style={[inputText(colors, { weight: 600 }), { flexGrow: 1, flexShrink: 1, minWidth: 0, paddingVertical: 0, paddingHorizontal: 0, letterSpacing: -0.3 }, noOutline]} />
        ) : (
          <Text size={15} weight={600} tracking={-0.02} numberOfLines={1} accessibilityRole="header" style={{ flexShrink: 1 }}>{title || placeholder}</Text>
        )}
      </View>
      <Press onPress={onToggle} accessibilityRole="button" accessibilityLabel={editing ? doneLabel : renameLabel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}>
        <Text size={13.5} color="muted">{editing ? doneLabel : renameLabel}</Text>
      </Press>
    </View>
  );
}

function Cell({ label, flex, end, children }: { label: string; flex: number; end?: boolean; children: ReactNode }) {
  return (
    <View style={{ flex, minWidth: 0, gap: 4, alignItems: end ? "flex-end" : "stretch" }}>
      <Text size={11.5} color="muted" numberOfLines={1}>{label}</Text>
      {children}
    </View>
  );
}

/** A 36 tall field in `sunk` for a cell of a line (unit, quantity, price). Numbers hold what is typed and commit on blur. */
function CellInput({ value, onCommit, label, numeric }: { value: string; onCommit: (v: string) => void; label: string; numeric?: boolean }) {
  const { colors } = useTheme();
  const [text, setText] = useState(value);
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setText(value); }, [value, focus]);
  const done = () => { setFocus(false); onCommit(text); };
  return (
    <TextInput value={text} onChangeText={setText} onFocus={() => setFocus(true)} onBlur={done} onSubmitEditing={done} accessibilityLabel={label} keyboardType={numeric ? "decimal-pad" : "default"} selectTextOnFocus={numeric} autoCapitalize="none"
      style={[inputText(colors, { numeric }), { height: 36, borderRadius: 10, paddingHorizontal: 8, fontSize: 13.5, backgroundColor: focus ? colors.card : colors.sunk, boxShadow: focus ? `0 0 0 1.5px ${colors.acc}` : undefined }, noOutline]} />
  );
}

export function ManualLine({ description, onDescription, descLabel, descPlaceholder, improve, improveLabel, onImprove, unit, onUnit, unitLabel, qty, onQty, qtyLabel, price, onPrice, priceLabel, total, totalLabel }: {
  description: string; onDescription: (v: string) => void; descLabel: string; descPlaceholder: string; improve: string; improveLabel: string; onImprove: () => void;
  unit: string; onUnit: (v: string) => void; unitLabel: string; qty: string; onQty: (v: string) => void; qtyLabel: string; price: string; onPrice: (v: string) => void; priceLabel: string; total: string; totalLabel: string;
}) {
  const { colors } = useTheme();
  const ph = usePlaceholder();
  return (
    <View style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <TextInput value={description} onChangeText={onDescription} multiline accessibilityLabel={descLabel} placeholder={descPlaceholder} placeholderTextColor={ph} blurOnSubmit
          style={[inputText(colors, { weight: 500 }), { flexGrow: 1, flexShrink: 1, minWidth: 0, fontSize: 14.5, lineHeight: 20, paddingTop: 5, paddingBottom: 0, paddingHorizontal: 0 }, noOutline]} />
        <Press onPress={onImprove} accessibilityRole="button" accessibilityLabel={improveLabel} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          style={{ height: 32, paddingLeft: 6, paddingRight: 10, borderRadius: 10, backgroundColor: colors["acc-soft"], flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <Icon name="orb" tone="violet" size={18} />
          <Text size={12.5} weight={600} color="acc-soft-t">{improve}</Text>
        </Press>
      </View>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 10, alignItems: "flex-end" }}>
        <Cell label={unitLabel} flex={1.1}><CellInput value={unit} onCommit={onUnit} label={unitLabel} /></Cell>
        <Cell label={qtyLabel} flex={1}><CellInput value={qty} onCommit={onQty} label={qtyLabel} numeric /></Cell>
        <Cell label={priceLabel} flex={1}><CellInput value={price} onCommit={onPrice} label={priceLabel} numeric /></Cell>
        <Cell label={totalLabel} flex={1.1} end><View style={{ height: 36, justifyContent: "center" }}><Num size={14.5} weight={600} numberOfLines={1}>{total}</Num></View></Cell>
      </View>
    </View>
  );
}

export function ChapterFooter({ addLabel, onAdd, subtotalLabel, subtotal }: { addLabel: string; onAdd: () => void; subtotalLabel: string; subtotal: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.soft }}>
      <Press onPress={onAdd} accessibilityRole="button" accessibilityLabel={addLabel} hitSlop={{ top: 4, bottom: 4, right: 8 }} style={{ height: 36, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Glyph name="plus" size={14} weight={2.4} />
        <Text size={13.5} weight={500}>{addLabel}</Text>
      </Press>
      <Text size={13.5} color="muted">{subtotalLabel} <Num size={13.5} weight={600}>{subtotal}</Num></Text>
    </View>
  );
}

/** The dashed "Add a chapter" button: 50 tall, radius 16, a 1.5 dashed `line2` outline. */
export function DashedAdd({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ height: 50, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.line2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
      <Glyph name="plus" size={14} weight={2.4} color="muted" />
      <Text size={14.5} weight={500} color="muted">{label}</Text>
    </Press>
  );
}

/** Taxes and totals: the province, tax-exempt, then subtotal, tax and a big total. */
export function TaxesCard({ provinceLabel, provinceValue, onProvince, exemptLabel, exemptSub, exempt, onExempt, subtotalLabel, subtotal, taxLabel, tax, totalLabel, total }: {
  provinceLabel: string; provinceValue: string; onProvince: () => void; exemptLabel: string; exemptSub: string; exempt: boolean; onExempt: (v: boolean) => void;
  subtotalLabel: string; subtotal: string; taxLabel: string; tax: string; totalLabel: string; total: string;
}) {
  return (
    <Card style={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 50 }}>
        <Text size={14.5} weight={500}>{provinceLabel}</Text>
        <Press onPress={onProvince} accessibilityRole="button" accessibilityLabel={`${provinceLabel}, ${provinceValue}`} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text size={14.5} color="muted">{provinceValue}</Text>
          <Glyph name="chevronDown" size={15} color="faint" />
        </Press>
      </View>
      <Hairline inset={0} />
      <View style={{ minHeight: 54, justifyContent: "center" }}><SwitchRow label={exemptLabel} sub={exemptSub} value={exempt} onChange={onExempt} /></View>
      <Hairline inset={0} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
        <Text size={13.5} color="muted">{subtotalLabel}</Text><Num size={13.5} weight={400}>{subtotal}</Num>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        <Text size={13.5} color="muted" style={{ flexShrink: 1 }}>{taxLabel}</Text><Num size={13.5} weight={400}>{tax}</Num>
      </View>
      <View style={{ marginTop: 12 }}><Hairline inset={0} /></View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingTop: 12 }}>
        <Text size={14.5} weight={500}>{totalLabel}</Text><Num size={28} weight={600} tracking={-0.035}>{total}</Num>
      </View>
    </Card>
  );
}

/** "Notes for the client": the label (15/600) over a multi-line box, like the other fields. */
export function NotesField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const { colors } = useTheme();
  const ph = usePlaceholder();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text size={15} weight={600} tracking={-0.02} style={{ paddingHorizontal: 4, paddingBottom: 4 }}>{label}</Text>
      <View style={{ borderRadius: 13, backgroundColor: colors.card, boxShadow: focus ? `0 0 0 1.5px ${colors.acc}` : `0 0 0 1px ${colors.line2}` }}>
        <TextInput value={value} onChangeText={onChange} multiline onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={ph} textAlignVertical="top"
          style={[inputText(colors, {}), { minHeight: 3 * 22 + 24, paddingHorizontal: 14, paddingVertical: 12, lineHeight: 22 }, noOutline]} />
      </View>
    </View>
  );
}

// ── Price list ────────────────────────────────────────────────────────────────

export function CatalogRowView({ icon, tone, name, meta, added, onToggle, addLabel, addedLabel, removeLabel, first }: {
  icon: IconName; tone: Tone; name: string; meta: string; added: boolean; onToggle: () => void; addLabel: string; addedLabel: string; removeLabel: string; first?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View>
      {!first ? <Hairline inset={0} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 56 }}>
        <Icon name={icon} tone={tone} size={26} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}>{meta}</Text>
        </View>
        <Press onPress={onToggle} accessibilityRole="button" accessibilityLabel={added ? `${removeLabel}: ${name}` : `${addLabel}: ${name}`} accessibilityState={{ selected: added }} hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
          style={{ height: 36, minWidth: 72, borderRadius: 11, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0, backgroundColor: added ? colors["ok-soft"] : colors.sunk }}>
          {added ? <Glyph name="check" size={13} color="ok" weight={3} /> : null}
          <Text size={13.5} weight={600} color={added ? "ok" : "ink"} numberOfLines={1}>{added ? addedLabel : addLabel}</Text>
        </Press>
      </View>
    </View>
  );
}

export function SelectionRow({ name, total, stepper, first }: { name: string; total: string; stepper: ReactNode; first?: boolean }) {
  return (
    <View>
      {!first ? <Hairline inset={0} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16 }}>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} leading={1.3}>{name}</Text>
          <Num size={13.5} weight={600}>{total}</Num>
        </View>
        {stepper}
      </View>
    </View>
  );
}

/** An empty spot inside a card: a 36 icon over one muted line (the selection before anything is added). */
export function NoteEmpty({ icon, tone, text }: { icon: IconName; tone: Tone; text: string }) {
  return (
    <View style={{ alignItems: "center", gap: 8, padding: 24 }}>
      <Icon name={icon} tone={tone} size={36} />
      <Text size={13.5} color="muted" leading={1.45} align="center" style={{ maxWidth: 260 }}>{text}</Text>
    </View>
  );
}

/** The "Before tax" footer of the selection card: `soft`, a hairline above, the total 19/600. */
export function BeforeTax({ label, total }: { label: string; total: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.soft }}>
      <Text size={13.5} color="muted">{label}</Text>
      <Num size={19} weight={600} tracking={-0.03}>{total}</Num>
    </View>
  );
}

// ── The new-client form (inside the client card) ──────────────────────────────

/** Name, address, city and province, postal code and phone, email, and the "Remember this client" switch. */
export function NewClientFields({ form, onChange, provinceName, onProvince, remember, onRemember }: {
  form: NewClientForm; onChange: (k: keyof NewClientForm, v: string) => void; provinceName: string; onProvince: () => void; remember: boolean; onRemember: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const f = (k: keyof NewClientForm) => (v: string) => onChange(k, v);
  return (
    <View style={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
      <TextField label={t("nq.ai.form.name")} value={form.name} onChangeText={f("name")} placeholder={t("nq.ai.form.namePlaceholder")} autoCapitalize="words" autoCorrect={false} />
      <TextField label={t("nq.ai.form.address")} value={form.address} onChangeText={f("address")} placeholder={t("nq.ai.form.addressPlaceholder")} autoCapitalize="words" />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1.3, minWidth: 0 }}><TextField label={t("nq.ai.form.city")} value={form.city} onChangeText={f("city")} placeholder={t("nq.ai.form.cityPlaceholder")} autoCapitalize="words" /></View>
        <View style={{ flex: 1, minWidth: 0 }}><SelectField label={t("nq.ai.form.province")} value={provinceName} onPress={onProvince} /></View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}><TextField label={t("nq.ai.form.postal")} value={form.postalCode} onChangeText={f("postalCode")} placeholder={t("nq.ai.form.postalPlaceholder")} autoCapitalize="characters" autoCorrect={false} /></View>
        <View style={{ flex: 1.3, minWidth: 0 }}><TextField label={t("nq.ai.form.phone")} value={form.phone} onChangeText={f("phone")} placeholder={t("nq.ai.form.phonePlaceholder")} keyboardType="phone-pad" numeric /></View>
      </View>
      <TextField label={t("nq.ai.form.email")} value={form.email} onChangeText={f("email")} placeholder={t("nq.ai.form.emailPlaceholder")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <View style={{ paddingTop: 2 }}><SwitchRow label={t("nq.ai.form.remember")} value={remember} onChange={onRemember} /></View>
    </View>
  );
}

/** A sheet's list: scrolls inside half the screen so a long list of clients or provinces still fits. */
export function SheetList({ children }: { children: ReactNode }) {
  const { height } = useWindowDimensions();
  return <ScrollView style={{ maxHeight: height * 0.5 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

// ── The primary button ────────────────────────────────────────────────────────

/** The board's `.fab-bar .btn`, in the flow at the end of the page: 56 tall pill, `inv`, the float shadow. */
export function PillAction({ label, onPress, icon, disabled, busy }: { label: string; onPress: () => void; icon?: ReactNode; disabled?: boolean; busy?: boolean }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} disabled={disabled || busy} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={{ height: 56, borderRadius: 28, backgroundColor: colors.inv, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18, opacity: disabled ? 0.4 : busy ? 0.55 : 1, boxShadow: shadow("float", colors) }}>
      {icon}
      <Text size={15} weight={600} color="on-inv" numberOfLines={1}>{label}</Text>
    </Press>
  );
}
