// AccountantView.dc.html: the company line with the accountant's avatar, the month card with its four parts, a file row, the sales tax
// card, a deadline row, a comment and the box to write one. Sizes are the board's own (.av-ck, .av-hs, .av-b).
import type { ReactNode } from "react";
import { TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "./Card";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Progress } from "./Numbers";
import { MiniButton } from "./Books";
import { geist } from "./fonts";
import { Status, type StatusShape, type StatusTone } from "./Status";
import { Avatar } from "./Avatar";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

/** The company: its initials in a 40 square (`inv`), "Accountant access" over its name, and the accountant's own avatar that switches company. */
export function CompanyHeader({ initials, kicker, name, avatar, avatarLabel, onAvatar }: { initials: string; kicker: string; name: string; avatar: string; avatarLabel: string; onAvatar: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 14 + insets.top, paddingHorizontal: 16, paddingBottom: 6 }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center" }}>
        <Text size={13.5} weight={600} tracking={-0.02} color="on-inv" allowFontScaling={false}>{initials}</Text>
      </View>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 1 }}>
        <Text size={12.5} color="muted" numberOfLines={1}>{kicker}</Text>
        <Text size={15} weight={600} tracking={-0.02} numberOfLines={1}>{name}</Text>
      </View>
      <Press onPress={onAvatar} accessibilityRole="button" accessibilityLabel={avatarLabel} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
        <Avatar initials={avatar} tint={2} />
      </Press>
    </View>
  );
}

/** The month card's head: the month and what is said under it, with its status. */
export function MonthHead({ name, sub, status }: { name: string; sub: string; status: { tone: StatusTone; shape: StatusShape; label: string } }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 6 }}>
      <View style={{ gap: 2, flexShrink: 1 }}>
        <Text size={17} weight={600} tracking={-0.02}>{name}</Text>
        <Text size={12.5} color="muted">{sub}</Text>
      </View>
      <Status tone={status.tone} shape={status.shape}>{status.label}</Status>
    </View>
  );
}

/** One part of the month: the label and its count (green when whole), a 5 tall bar (amber while unfinished) and a muted line. */
export function CheckLine({ label, value, complete, pct, note, first }: { label: string; value: string; complete: boolean; pct: number; note: string; first?: boolean }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}, ${value}. ${note}`} style={{ gap: 7, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text size={14.5} style={{ flexShrink: 1 }}>{label}</Text>
        <Num size={14.5} weight={600} color={complete ? "ok" : "ink"}>{value}</Num>
      </View>
      <Progress value={pct / 100} fill={complete ? "ok-dot" : "warn-dot"} height={5} />
      <Text size={12.5} color="muted">{note}</Text>
    </View>
  );
}

/** A file: icon, name and what it holds, then Download (or Downloaded once it has been). */
export function FileRow({ icon, tone, title, sub, done, doneLabel, busy, button, buttonLabel, onPress }: {
  icon: IconName; tone: Tone; title: string; sub: string; done: boolean; doneLabel: string; busy: boolean; button: string; buttonLabel: string; onPress: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingVertical: 12, paddingHorizontal: 16 }}>
      <Icon name={icon} tone={tone} size={28} />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
      </View>
      {done ? <Status tone="ok" shape="check">{doneLabel}</Status> : <MiniButton label={button} accessibilityLabel={buttonLabel} disabled={busy} onPress={onPress} />}
    </View>
  );
}

/** The sales tax card: the period and how often, the net figure with its status, then the lines under it. */
export function TaxCard({ left, right, figure, status, lines }: { left: string; right: string; figure: string; status: { tone: StatusTone; shape: StatusShape; label: string }; lines: { label: string; value: string; muted?: boolean }[] }) {
  const { colors } = useTheme();
  return (
    <Card style={{ paddingTop: 16, paddingHorizontal: 18, paddingBottom: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text size={12.5} color="muted" style={{ flexShrink: 1 }}>{left}</Text>
        <Text size={12.5} color="muted">{right}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
        <Num size={32} weight={600} tracking={-0.035}>{figure}</Num>
        <Status tone={status.tone} shape={status.shape}>{status.label}</Status>
      </View>
      <View style={{ marginTop: 12 }}>
        {lines.map((l, i) => (
          <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.line }}>
            <Text size={13.5} color="t2" style={{ flexShrink: 1 }}>{l.label}</Text>
            <Num size={13.5} weight={600} color={l.muted ? "muted" : "ink"}>{l.value}</Num>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** A deadline: a 26 icon, the title and a muted line, and its status. */
export function DeadlineRow({ icon, tone, title, sub, status, onPress }: { icon: IconName; tone: Tone; title: string; sub: string; status: { tone: StatusTone; shape: StatusShape; label: string }; onPress?: () => void }) {
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingVertical: 12, paddingHorizontal: 16 }}>
      <Icon name={icon} tone={tone} size={26} />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
      </View>
      <Status tone={status.tone} shape={status.shape}>{status.label}</Status>
    </View>
  );
  return onPress ? <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${status.label}`}>{body}</Press> : body;
}

/** A comment: who and when over a bubble (yours on the right in `inv`, theirs on the left in `sunk`). */
export function CommentBubble({ who, when, text, mine }: { who: string; when: string; text: string; mine: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ maxWidth: "84%", gap: 4, alignSelf: mine ? "flex-end" : "flex-start", alignItems: mine ? "flex-end" : "flex-start" }}>
      <Text size={11.5} color="muted" style={{ paddingHorizontal: 4 }}>{`${who} · ${when}`}</Text>
      <View style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: mine ? colors.inv : colors.sunk, borderRadius: 18, borderBottomRightRadius: mine ? 6 : 18, borderBottomLeftRadius: mine ? 18 : 6 }}>
        <Text size={14.5} leading={1.45} color={mine ? "on-inv" : "ink"}>{text}</Text>
      </View>
    </View>
  );
}

/** The box under the thread: a pill on `soft` with the round send button. */
export function CommentBox({ value, onChange, onSend, placeholder, sendLabel, busy }: { value: string; onChange: (v: string) => void; onSend: () => void; placeholder: string; sendLabel: string; busy: boolean }) {
  const { colors } = useTheme();
  const ready = value.trim().length > 0 && !busy;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingLeft: 16, paddingRight: 6, borderRadius: 26, backgroundColor: colors.soft, boxShadow: `0 0 0 1px ${colors.line2}` }}>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.faint} accessibilityLabel={placeholder} returnKeyType="send" onSubmitEditing={onSend}
        style={{ flexGrow: 1, minWidth: 0, height: 40, fontSize: 15, color: colors.ink, fontFamily: geist(400) }} />
      <Press onPress={onSend} disabled={!ready} accessibilityRole="button" accessibilityLabel={sendLabel} accessibilityState={{ disabled: !ready }}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center", opacity: ready ? 1 : 0.4 }}>
        <Glyph name="arrowUp" size={17} color="on-inv" weight={2.2} />
      </Press>
    </View>
  );
}

export function Thread({ children }: { children: ReactNode }) {
  return <View style={{ gap: 12 }}>{children}</View>;
}
