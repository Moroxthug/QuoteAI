// The company assistant's three boards (AssistantProposals / Activity / Permissions .dc.html): a proposal card (what it would do, why, and the
// Approve / Edit / Dismiss row), the closed card that says what was done, an activity row, and the permissions rows (the three-stop level control,
// the spending stepper, the quiet-hours values and the voice orbs). Sizes are the board's own (.ap-*, .aa-*, .pm-*).
import { useEffect, useId, useState, type ReactNode } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { thumbBox } from "@/lib/assistant";
import { board } from "@/theme/board";
import { Button } from "./Button";
import { Card, Hairline } from "./Card";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { easing, Press } from "./motion";
import { Progress } from "./Numbers";
import { shadow } from "./shadow";
import { Tag } from "./Status";
import { Tabs } from "./Tabs";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

/** An icon that keeps its size when the words beside it run long. */
function Ico({ name, tone, size }: { name: IconName; tone: Tone; size: number }) {
  return <View style={{ width: size, height: size, flexShrink: 0 }}><Icon name={name} tone={tone} size={size} /></View>;
}

// ── Proposals ────────────────────────────────────────────────────────────────

/** `.ap-card`: the icon and what it would do, then the box that shows it, then why, then the buttons. */
export function ProposalCard({ icon, tone, title, meta, why, whyLabel, children, actions }: {
  icon: IconName; tone: Tone; title: string; meta: string; why?: string; whyLabel: string; children?: ReactNode; actions: ReactNode;
}) {
  return (
    <Card accessibilityLabel={title}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingTop: 16, paddingHorizontal: 16 }}>
        <View style={{ marginTop: 1 }}><Ico name={icon} tone={tone} size={30} /></View>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 4 }}>
          <Text size={16} weight={600} tracking={-0.02} leading={1.3}>{title}</Text>
          <Text size={12.5} color="muted" leading={1.35}>{meta}</Text>
        </View>
      </View>
      {children}
      {why ? (
        <Text size={13.5} color="t2" leading={1.45} style={{ marginTop: 12, marginHorizontal: 16 }}>
          <Text size={13.5} weight={600} leading={1.45}>{whyLabel}</Text>
          {` · ${why}`}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16 }}>{actions}</View>
    </Card>
  );
}

/** `.ap-do`: what it will do, in a `sunk` box with the channel as a tag. */
export function DoBox({ label, channel, children }: { label: string; channel: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 14, marginHorizontal: 16, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.sunk }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <Text size={12.5} color="muted" style={{ flexShrink: 1 }}>{label}</Text>
        <Tag onCard>{channel}</Tag>
      </View>
      {children}
    </View>
  );
}

/** `.ap-msg`: the text it would send, with the subject of an email in 600 above it. */
export function MessageBody({ subject, text }: { subject?: string; text: string }) {
  return (
    <Text size={14.5} color="t2" leading={1.5}>
      {subject ? <Text size={14.5} weight={600} leading={1.5}>{`${subject}\n`}</Text> : null}
      {text}
    </Text>
  );
}

/** `.ap-li` and `.ap-tot`: the lines of an order, with a hairline between them, and the total under a hairline. */
export function OrderBody({ lines, totalLabel, total }: { lines: { name: string; amount: string }[]; totalLabel: string; total: string }) {
  const { colors } = useTheme();
  return (
    <View>
      {lines.map((l, i) => (
        <View key={`${l.name}-${i}`} style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingVertical: 5, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.line2 }}>
          <Text size={14.5} style={{ flexShrink: 1, minWidth: 0 }}>{l.name}</Text>
          <Num size={13.5} weight={500}>{l.amount}</Num>
        </View>
      ))}
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.line2 }}>
        <Text size={14.5} weight={600}>{totalLabel}</Text>
        <Num size={14.5} weight={600}>{total}</Num>
      </View>
    </View>
  );
}

/** `.ap-mv`: the day it is on now (struck through) and the day it would move to, with a note under them. */
export function MoveBody({ from, fromSub, to, toSub, note, arrowLabel }: { from: string; fromSub?: string; to: string; toSub?: string; note?: string; arrowLabel: string }) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.card }}>
          <Text size={14.5} weight={600} color="muted" style={{ textDecorationLine: "line-through", textDecorationColor: colors.faint }}>{from}</Text>
          {fromSub ? <Text size={12.5} color="muted">{fromSub}</Text> : null}
        </View>
        <View accessible accessibilityLabel={arrowLabel} style={{ width: 22, alignItems: "center" }}><Glyph name="chevron" size={18} color="faint" /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 2, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.card }}>
          <Text size={14.5} weight={600}>{to}</Text>
          {toSub ? <Text size={12.5} color="muted">{toSub}</Text> : null}
        </View>
      </View>
      {note ? <Text size={13.5} color="t2" leading={1.45} style={{ marginTop: 10 }}>{note}</Text> : null}
    </View>
  );
}

/** `.ap-done`: the closed card: what was done, how it came out, and Undo. */
export function DoneCard({ icon, tone, text, status, undo, undoLabel }: { icon: IconName; tone: Tone; text: string; status: ReactNode; /** Missing once it can no longer be taken back (a message that went out). */ undo?: () => void; undoLabel: string }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingLeft: 16, paddingRight: 12 }}>
        <Ico name={icon} tone={tone} size={26} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 4 }}>
          <Text size={14.5} weight={500} leading={1.3}>{text}</Text>
          {status}
        </View>
        {undo ? <Button size="sm" kind="secondary" label={undoLabel} onPress={undo} /> : null}
      </View>
    </Card>
  );
}

/** `.ap-lock`: the plan card the assistant's boards show when it isn't on the plan. */
export function LockCard({ title, body, tag, note, action, onAction }: { title: string; body: string; tag: string; note: string; action: string; onAction: () => void }) {
  return (
    <Card>
      <View style={{ alignItems: "center", gap: 10, paddingTop: 28, paddingHorizontal: 22, paddingBottom: 22 }}>
        <Icon name="lock" tone="violet" size={44} />
        <Text size={17} weight={600} tracking={-0.02} align="center" accessibilityRole="header" style={{ marginTop: 4 }}>{title}</Text>
        <Text size={13.5} color="muted" leading={1.45} align="center" style={{ maxWidth: 270 }}>{body}</Text>
        <Tag accent>{tag}</Tag>
        <Text size={12.5} color="faint" align="center">{note}</Text>
        <View style={{ alignSelf: "stretch", marginTop: 4 }}><Button size="md" kind="secondary" label={action} onPress={onAction} block /></View>
      </View>
    </Card>
  );
}

// ── Activity ─────────────────────────────────────────────────────────────────

/** `.aa-row`: the icon, what it did with its detail, when and who (a rule is an accent tag), and what can be done now on the right. */
export function ActivityLine({ first, icon, tone, title, detail, time, who, auto, undone, right }: {
  first?: boolean; icon: IconName; tone: Tone; title: string; detail?: string; time: string; who: string; auto?: boolean; undone?: boolean; right?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <>
      {first ? null : <Hairline inset={0} />}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14, paddingLeft: 16, paddingRight: 12 }}>
        <View style={{ marginTop: 2 }}><Ico name={icon} tone={tone} size={26} /></View>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 3 }}>
          <Text size={14.5} weight={500} leading={1.35} color={undone ? "muted" : "ink"} style={undone ? { textDecorationLine: "line-through", textDecorationColor: colors.faint } : undefined}>{title}</Text>
          {detail ? <Text size={12.5} color="muted" leading={1.4}>{detail}</Text> : null}
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
            <Num size={12.5} weight={500} color="muted">{time}</Num>
            <Tag accent={auto}>{who}</Tag>
          </View>
        </View>
        {right ? <View style={{ flexShrink: 0, alignItems: "flex-end", gap: 6, paddingTop: 1 }}>{right}</View> : null}
      </View>
    </>
  );
}

// ── Permissions ──────────────────────────────────────────────────────────────

/** `.pm-gt`: a group's title, and its rows in one card. */
export function PermGroup({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View>
      <Text size={17} weight={600} tracking={-0.025} accessibilityRole="header" style={{ marginTop: 26, marginBottom: 10, marginHorizontal: 20 }}>{title}</Text>
      <View style={{ marginHorizontal: 16 }}><Card>{children}</Card></View>
      {note ? <Text size={12.5} color="muted" leading={1.45} style={{ marginTop: 8, marginHorizontal: 20 }}>{note}</Text> : null}
    </View>
  );
}

/** `.pm-row` and `.pm-line`: an icon, the label over what it does now, the control on the right, and (for the three-stop control) the control under. */
export function PermRow({ first, icon, tone, label, sub, control, below }: { first?: boolean; icon: IconName; tone: Tone; label: string; sub: string; control?: ReactNode; below?: ReactNode }) {
  return (
    <>
      {first ? null : <Hairline inset={0} />}
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 60 }}>
          <Ico name={icon} tone={tone} size={28} />
          <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2, paddingVertical: 12 }}>
            <Text size={15} weight={500}>{label}</Text>
            <Text size={12.5} color="muted" leading={1.4}>{sub}</Text>
          </View>
          {control}
        </View>
        {below}
      </View>
    </>
  );
}

/** `.pm-seg`: Ask me first / Do it and tell me / Off, in columns of 1 : 1.3 : 0.7 with a thumb that slides under the chosen one. */
export function LevelSegment({ options, value, onChange, label, disabled }: { options: [string, string, string]; value: number; onChange: (i: number) => void; label: string; disabled?: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const box = thumbBox(value);
  const left = useSharedValue(box.left);
  const width = useSharedValue(box.width);
  useEffect(() => {
    const b = thumbBox(value);
    if (reduced) { left.value = b.left; width.value = b.width; return; }
    left.value = withTiming(b.left, { duration: 450, easing: easing("out") });
    width.value = withTiming(b.width, { duration: 450, easing: easing("out") });
  }, [value, reduced, left, width]);
  const inner = Math.max(0, w - 4);
  const thumb = useAnimatedStyle(() => ({ left: 2 + inner * left.value, width: inner * width.value }));
  const cols = [1, 1.3, 0.7];
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ flexDirection: "row", padding: 2, borderRadius: 12, backgroundColor: colors.sunk, marginBottom: 14 }}>
      {w > 0 ? <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 2, bottom: 2, borderRadius: 10, backgroundColor: colors.card, boxShadow: shadow("thumb", colors) }, thumb]} /> : null}
      {options.map((o, i) => {
        const on = i === value;
        return (
          <Press key={o} onPress={() => onChange(i)} disabled={disabled} accessibilityRole="radio" accessibilityLabel={o} accessibilityState={{ checked: on, disabled: !!disabled }}
            style={{ flex: cols[i]!, minHeight: 40, paddingVertical: 4, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.45 : 1 }}>
            <Text size={13.5} weight={on ? 600 : 500} color={on ? "ink" : "muted"} align="center" leading={1.2}>{o}</Text>
          </Press>
        );
      })}
    </View>
  );
}

/** `.pm-step`: a `sunk` well with 40 minus / plus buttons around the value. */
export function LimitStepper({ value, onDec, onInc, decLabel, incLabel, canDec, canInc, disabled }: {
  value: string; onDec: () => void; onInc: () => void; decLabel: string; incLabel: string; canDec: boolean; canInc: boolean; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const btn = (glyph: "minus" | "plus", label: string, onPress: () => void, enabled: boolean) => (
    <Press onPress={onPress} disabled={!enabled || disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !enabled || !!disabled }}
      style={{ width: 40, height: 40, borderRadius: 9, alignItems: "center", justifyContent: "center", opacity: enabled && !disabled ? 1 : 0.35 }}>
      <Glyph name={glyph} size={14} weight={2.2} />
    </Press>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.sunk, borderRadius: 11, padding: 2, flexShrink: 0 }}>
      {btn("minus", decLabel, onDec, canDec)}
      <Num size={14.5} weight={500} align="center" accessibilityLiveRegion="polite" style={{ minWidth: 52 }}>{value}</Num>
      {btn("plus", incLabel, onInc, canInc)}
    </View>
  );
}

/** `.pm-val`: a value with a chevron that opens a choice (the quiet hours' start and end). */
export function ValueLink({ value, onPress, label, disabled }: { value: string; onPress: () => void; label: string; disabled?: boolean }) {
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, opacity: disabled ? 0.45 : 1 }}>
      <Text size={13.5} color="muted">{value}</Text>
      <Glyph name="chevron" size={15} color="faint" />
    </Press>
  );
}

const ORBS = board.voiceOrbs;

/** `.pm-orb` (26) and `.vo` (48): a voice orb, a dark ground with three soft glows; on the Permissions board the chosen one gets a ring in `ink`, in Settings its picker draws the ring. */
export function VoiceOrb({ voice, on, size = 26, ring = true }: { voice: keyof typeof ORBS; on?: boolean; size?: number; ring?: boolean }) {
  const { colors } = useTheme();
  const id = useId().replace(/:/g, "");
  const o = ORBS[voice];
  const spots: [number, number][] = [[6.6, 9.8], [20.4, 19.4], [17.8, 4.6]];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", boxShadow: !ring ? undefined : on ? `0 0 0 2px ${colors.card}, 0 0 0 3.5px ${colors.ink}` : `0 0 0 1px ${colors.line2}` }}>
      <Svg width={size} height={size} viewBox="0 0 26 26">
        <Defs>
          {o.glow.map((c, i) => (
            <RadialGradient key={c} id={`${id}${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c} stopOpacity={0.95} />
              <Stop offset="1" stopColor={c} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        <Circle cx={13} cy={13} r={13} fill={o.base} />
        {spots.map(([cx, cy], i) => <Circle key={i} cx={cx} cy={cy} r={11} fill={`url(#${id}${i})`} />)}
      </Svg>
    </View>
  );
}

export function VoiceOrbs({ chosen, label, onPress, disabled }: { chosen: keyof typeof ORBS; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 }}>
      <View style={{ flexDirection: "row", gap: 6 }} importantForAccessibility="no-hide-descendants">
        {(["ember", "tide", "stone"] as const).map((v) => <VoiceOrb key={v} voice={v} on={v === chosen} />)}
      </View>
      <Glyph name="chevron" size={15} color="faint" />
    </Press>
  );
}

/** The icon of a cross-link row: 28, as in the board's `.lrow`. */
export function CrossIcon({ name, tone }: { name: IconName; tone: Tone }) {
  return <Ico name={name} tone={tone} size={28} />;
}

/** The strip under the assistant's header: Proposals (with how many wait), Activity, Permissions. */
export function AssistantTabs({ active, count, onTab }: { active: 0 | 1 | 2; count?: string; onTab: (i: 0 | 1 | 2) => void }) {
  const { t } = useTranslation();
  return (
    <View accessibilityLabel={t("as.tabsLabel")}>
      <Tabs tabs={[t("as.tabs.proposals"), t("as.tabs.activity"), t("as.tabs.permissions")]} active={active} counts={[count, null, null]} onChange={(i) => { if (i !== active) onTab(i as 0 | 1 | 2); }} />
    </View>
  );
}

/** `.ap-link`: 13.5/500 in `acc-t` with a small chevron ("What it can do on its own"). */
export function ArrowLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, alignSelf: "flex-start" }}>
      <Text size={13.5} weight={500} color="acc-t">{label}</Text>
      <Glyph name="chevron" size={14} color="acc-t" />
    </Press>
  );
}

/** The page's own title and its line under it (24/600 and 14.5 muted), the same on all three boards. */
export function AssistantHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
      <Text size={24} weight={600} tracking={-0.035} leading={1.2} accessibilityRole="header">{title}</Text>
      {sub ? <Text size={14.5} color="muted" leading={1.45} style={{ marginTop: 6 }}>{sub}</Text> : null}
    </View>
  );
}

/** `.aa-use`: the voice minutes used this month: the figure and the allowance, a bar, and when it resets. */
export function UsageCard({ title, used, of, pct, label, caption }: { title: string; used: string; of: string; pct: number; label: string; caption: string }) {
  return (
    <Card padded>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text size={14.5} weight={500} style={{ flexShrink: 1 }}>{title}</Text>
        <Text size={13.5} color="muted"><Num size={15} weight={600}>{used}</Num>{` ${of}`}</Text>
      </View>
      <View style={{ paddingTop: 10 }}><Progress value={pct} fill="acc" height={6} label={label} /></View>
      <Text size={12.5} color="muted" style={{ marginTop: 8 }}>{caption}</Text>
    </Card>
  );
}
