// The crew's phone pieces (CrewNow.dc.html and its siblings).
// CrewHeader: the company (a 30 tile with its initials, the name 14.5/600, a chevron when there is more than one) on the left, the worker's avatar on the right; padding 12 12 0 16.
// ClockCard: a card (padding 18 18 16): the clock-state pill and "Today · 7:00–15:30", the timer Num 50/600 (−0.045em), a muted line, the clock button (min 72, radius 22: a
// 48 disc and two lines), a faint note, then the job, the address with Directions, the site lead with a round call button, and tiles.
// CrewTask (.lrow): a 26 round tick (`ok-dot` when done) and the task with its line, "New" for one the office added.
// ReportRow: the title and a line on the left, the status pill and the time on the right.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Avatar, type AvatarTint } from "./Avatar";
import { Button } from "./Button";
import { Card, Hairline } from "./Card";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Progress } from "./Numbers";
import { Status, type StatusShape, type StatusTone } from "./Status";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

export function CrewHeader({ company, initials, onCompany, canSwitch, switchLabel, worker, tint, workerLabel }: {
  company: string; initials: string; onCompany?: () => void; canSwitch?: boolean; switchLabel: string; worker: string; tint: AvatarTint; workerLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 12, paddingRight: 12, paddingLeft: 16 }}>
      <Press onPress={onCompany} disabled={!canSwitch} accessibilityRole={canSwitch ? "button" : undefined} accessibilityLabel={canSwitch ? switchLabel : company}
        style={{ flexDirection: "row", alignItems: "center", gap: 9, height: 44, paddingLeft: 4, paddingRight: 10, marginLeft: -4, borderRadius: 22, flexShrink: 1 }}>
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center" }}>
          <Text size={11.5} weight={600} color="on-inv" tracking={-0.02} allowFontScaling={false}>{initials}</Text>
        </View>
        <Text size={14.5} weight={600} tracking={-0.02} numberOfLines={1} style={{ flexShrink: 1 }}>{company}</Text>
        {canSwitch ? <Glyph name="chevronDown" size={14} color="muted" weight={2} /> : null}
      </Press>
      <Avatar initials={worker} tint={tint} size={38} label={workerLabel} />
    </View>
  );
}

export function ChangesPill({ count, label, open, onPress }: { count: number; label: string; open: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${count}, ${label}`}
      style={{ alignSelf: "flex-start", height: 38, paddingLeft: 10, paddingRight: 12, borderRadius: 19, backgroundColor: colors["acc-soft"], flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.acc, alignItems: "center", justifyContent: "center" }}>
        <Num size={11.5} weight={600} color="on-inv" allowFontScaling={false}>{String(count)}</Num>
      </View>
      <Text size={13.5} weight={500} color="acc-soft-t">{label}</Text>
      <Glyph name="chevronDown" size={14} color="acc-soft-t" weight={2.2} />
    </Press>
  );
}

export function ChangeRow({ icon, tone, title, sub }: { icon: IconName; tone: Tone; title: string; sub?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 13, paddingHorizontal: 16 }}>
      <Icon name={icon} tone={tone} size={26} />
      <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
        <Text size={14.5} weight={500} leading={1.3}>{title}</Text>
        {sub ? <Text size={12.5} color="muted" leading={1.35}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export type ClockLook = "in" | "out" | "locating" | "done";

export function ClockCard({ pill, range, timer, timerRunning, timerSub, look, doneIn, title, sub, onClock, busy, note, children }: {
  pill: { tone: StatusTone; shape: StatusShape; word: string }; range?: string; timer: string; timerRunning: boolean; timerSub: string;
  look: ClockLook; doneIn?: boolean; title: string; sub: string; onClock: () => void; busy?: boolean; note: string; children?: ReactNode;
}) {
  const { colors } = useTheme();
  const bg = look === "done" ? colors["ok-soft"] : look === "locating" ? colors.sunk : look === "out" ? colors.sunk : colors.inv;
  const fg: ColorName = look === "done" ? "ok" : look === "in" ? "on-inv" : "ink";
  const disc = look === "done" ? { bg: colors["ok-dot"], fg: "card" as ColorName } : look === "locating" ? { bg: colors.card, fg: "acc-t" as ColorName } : look === "out" ? { bg: colors["bad-soft"], fg: "bad" as ColorName } : { bg: colors["ok-dot"], fg: "card" as ColorName };
  return (
    <Card padded style={{ paddingVertical: 18, paddingHorizontal: 18, paddingBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Status tone={pill.tone} shape={pill.shape}>{pill.word}</Status>
        {range ? <Text size={12.5} color="muted">{range}</Text> : null}
      </View>
      <Num size={50} weight={600} tracking={-0.045} leading={1} color={timerRunning ? "ink" : "muted"} accessibilityRole="timer" style={{ marginTop: 14 }}>{timer}</Num>
      <Text size={13.5} color="muted" style={{ marginTop: 8 }}>{timerSub}</Text>
      <Press onPress={onClock} disabled={busy || look === "locating"} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} accessibilityState={{ busy: !!busy }}
        style={{ marginTop: 18, minHeight: 72, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: bg, boxShadow: look === "in" ? `0 12px 28px -12px ${colors.shadow}` : undefined }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: disc.bg, boxShadow: look === "locating" ? `0 0 0 1px ${colors.ring}` : undefined }}>
          <Glyph name={look === "done" ? "check" : look === "locating" ? "search" : doneIn === false ? "arrowUp" : "play"} size={22} color={disc.fg} weight={2.2} />
        </View>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={17} weight={600} tracking={-0.02} color={fg}>{title}</Text>
          <Text size={12.5} color={fg} opacity={0.72}>{sub}</Text>
        </View>
      </Press>
      <Text size={12.5} color="faint" style={{ marginTop: 10, marginHorizontal: 2 }}>{note}</Text>
      <View style={{ marginTop: 16, marginHorizontal: -18, marginBottom: 4 }}><Hairline inset={0} /></View>
      {children}
    </Card>
  );
}

export function SiteRow({ title, sub, action, onAction, actionLabel, onPress, strong }: { title: string; sub?: string; action?: string; onAction?: () => void; actionLabel?: string; onPress?: () => void; strong?: boolean }) {
  const inner = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, minHeight: 44 }}>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={strong ? 15 : 14.5} weight={strong ? 600 : 500} numberOfLines={2}>{title}</Text>
        {sub ? <Text size={12.5} color="muted" numberOfLines={2}>{sub}</Text> : null}
      </View>
      {action && onAction ? <Button kind="secondary" size="sm" label={action} onPress={onAction} accessibilityLabel={actionLabel ?? action} /> : null}
    </View>
  );
  return onPress ? <Press onPress={onPress} accessibilityRole="link" accessibilityLabel={title}>{inner}</Press> : inner;
}

export function CallRow({ name, role, callLabel, onCall }: { name: string; role?: string; callLabel: string; onCall?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
      <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
        {role ? <Text size={12.5} color="muted" numberOfLines={1}>{role}</Text> : null}
      </View>
      {onCall ? (
        <Press onPress={onCall} accessibilityRole="button" accessibilityLabel={callLabel} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors["ok-soft"], alignItems: "center", justifyContent: "center" }}>
          <Glyph name="phone" size={20} color="ok" weight={1.9} />
        </Press>
      ) : null}
    </View>
  );
}

export function PhaseTile({ label, title, value }: { label: string; title: string; value: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 8, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, gap: 4, backgroundColor: colors.soft, boxShadow: `0 0 0 1px ${colors.line}` }}>
      <Text size={12.5} color="muted">{label}</Text>
      <Text size={16} weight={600} tracking={-0.02} leading={1.5}>{title}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flexGrow: 1 }}><Progress value={value} label={title} /></View>
        <Num size={11.5} weight={500} color="muted">{`${Math.round(value * 100)}%`}</Num>
      </View>
    </View>
  );
}

export function CrewTask({ title, sub, done, isNew, newLabel, onToggle }: { title: string; sub?: string; done: boolean; isNew?: boolean; newLabel: string; onToggle: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={title} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 56 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: done ? colors["ok-dot"] : "transparent", boxShadow: done ? undefined : `inset 0 0 0 1.6px ${colors.line2}` }}>
        {done ? <Glyph name="check" size={14} color="card" weight={3} /> : null}
      </View>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} color={done ? "muted" : "ink"}>{title}</Text>
        {sub ? <Text size={12.5} color="muted">{sub}</Text> : null}
      </View>
      {isNew ? <Status tone="acc" shape="dot">{newLabel}</Status> : null}
    </Press>
  );
}

export function UpcomingRow({ dow, day, title, sub, tag }: { dow: string; day: string; title: string; sub?: string; tag?: { tone: StatusTone; shape: StatusShape; word: string } }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16 }}>
      <View style={{ width: 42, alignItems: "center" }}>
        <Text size={11.5} weight={500} color="muted">{dow}</Text>
        <Num size={19} weight={600} tracking={-0.03} leading={1.2}>{day}</Num>
      </View>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
        {sub ? <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text> : null}
      </View>
      {tag ? <Status tone={tag.tone} shape={tag.shape}>{tag.word}</Status> : null}
    </View>
  );
}

export function ReportRow({ title, sub, status, time, onPress }: { title: string; sub: string; status: { tone: StatusTone; shape: StatusShape; word: string }; time: string; onPress?: () => void }) {
  return (
    <Press onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${title}. ${status.word}`}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 13, paddingHorizontal: 16 }}>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500}>{title}</Text>
        <Text size={12.5} color="muted" leading={1.35}>{sub}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Status tone={status.tone} shape={status.shape}>{status.word}</Status>
        <Num size={11.5} weight={400} color="faint">{time}</Num>
      </View>
    </Press>
  );
}

/** ForemanHome's quick link: a card with a 26 icon over its name (78 tall, ring). */
export function QuickLink({ icon, tone, label, onPress }: { icon: IconName; tone: Tone; label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="link" accessibilityLabel={label} style={{ flex: 1 }}>
      <Card style={{ height: 78, alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Icon name={icon} tone={tone} size={26} />
        <Text size={12.5} weight={500}>{label}</Text>
      </Card>
    </Press>
  );
}
