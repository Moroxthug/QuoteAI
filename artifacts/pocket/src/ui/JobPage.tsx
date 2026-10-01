// Job.dc.html's own pieces.
// JobTabs (.tabs): sticky under the quick actions, gap 22, padding 0 20, a 1 px `line` under them; a tab is 44 tall, 14.5/500
// `muted`, the current one 14.5/600 `ink` with a 2 px `ink` bar on the line.
// ProgressCard: a card; "Milestones · 3 of 6 done" with the percent at 24/600, six 5 px segments (gap 4: done `inv`, the current
// one filled to its share, the rest `sunk`), then four figure cells (.kp: padding 14 16, label 12.5 muted, value Num 19/600, a
// 11.5 sub-line) in two columns under a hairline.
// QuickTiles (.qa): three 78 tall tiles, radius 18, a 26 icon over a 12.5/500 label.
// FieldReport (.blk): a 26 avatar, the name 13.5/500, the time 11.5 faint, the kind pill at the right; the text 14.5 `t2`; two buttons.
// BudgetBars (.bw): the name and "spent / planned" on a line, a 6 tall bar with a 2×12 `acc` tick at the share of the work done.
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { tokens } from "@/theme/tokens";
import { Avatar, type AvatarTint } from "./Avatar";
import { Button } from "./Button";
import { Card, Hairline } from "./Card";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Progress } from "./Numbers";
import { Status, type StatusShape, type StatusTone } from "./Status";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

export function JobTabs({ tabs, active, onChange, label }: { tabs: { key: string; label: string }[]; active: string; onChange: (key: string) => void; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.ground }}>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, backgroundColor: colors.line }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={label} contentContainerStyle={{ gap: tokens.space.tabGap, paddingHorizontal: 20 }}>
        {tabs.map((tab) => {
          const on = tab.key === active;
          return (
            <Press key={tab.key} onPress={() => onChange(tab.key)} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: on }}
              style={{ height: tokens.size.tab + 1, paddingBottom: 1, justifyContent: "center" }}>
              <Text size={14.5} weight={on ? 600 : 500} color={on ? "ink" : "muted"} numberOfLines={1}>{tab.label}</Text>
              {on ? <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, borderRadius: 2, backgroundColor: colors.ink }} /> : null}
            </Press>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function StatusDates({ status, dates }: { status: { tone: StatusTone; shape: StatusShape; word: string }; dates?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Status tone={status.tone} shape={status.shape}>{status.word}</Status>
      {dates ? <Num size={12.5} weight={500} color="muted">{dates}</Num> : null}
    </View>
  );
}

export function TitleRow({ title, renameLabel, onRename }: { title: string; renameLabel?: string; onRename?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
      <Text size={24} weight={600} tracking={-0.035} leading={1.2} accessibilityRole="header" style={{ flexShrink: 1 }}>{title}</Text>
      {onRename && renameLabel ? (
        <Press onPress={onRename} accessibilityRole="button" accessibilityLabel={renameLabel} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Icon name="pen" tone="slate" size={20} />
        </Press>
      ) : null}
    </View>
  );
}

export function ClientRow({ avatar, name, address, action, onAction }: { avatar: ReactNode; name: string; address?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
      {avatar}
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 1 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
        {address ? <Text size={12.5} color="muted" numberOfLines={1}>{address}</Text> : null}
      </View>
      {action && onAction ? <Button kind="secondary" size="sm" label={action} onPress={onAction} /> : null}
    </View>
  );
}

/** Figures two across (.kp: padding 14 16, a 12.5 muted label, Num 19/600, an 11.5 sub-line), hairlines between; `line` adds one above. */
export function FigureCells({ cells, line }: { cells: Cell[]; line?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", borderTopWidth: line ? 1 : 0, borderTopColor: colors.line }}>
      {cells.map((c, i) => (
        <View key={i} style={{ width: "50%", gap: 3, paddingVertical: 14, paddingHorizontal: 16, borderLeftWidth: i % 2 ? 1 : 0, borderLeftColor: colors.line, borderTopWidth: i > 1 ? 1 : 0, borderTopColor: colors.line }}>
          <Text size={12.5} color="muted">{c.label}</Text>
          <Num size={19} weight={600} tracking={-0.03} color={c.valueTone ?? "ink"}>{c.value}</Num>
          <Text size={11.5} color="muted" leading={1.35}>{c.sub}</Text>
        </View>
      ))}
    </View>
  );
}

export type Cell = { label: string; value: string; valueTone?: ColorName; sub: ReactNode };

export function ProgressCard({ left, pct, segments, cells }: { left: ReactNode; pct: string; segments: { state: "done" | "current" | "todo"; fill: number }[]; cells: Cell[] }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text size={13.5} color="muted" style={{ flexShrink: 1 }}>{left}</Text>
          <Num size={24} weight={600} tracking={-0.03}>{pct}</Num>
        </View>
        <View style={{ flexDirection: "row", gap: 4, marginTop: 12 }} accessibilityRole="progressbar">
          {segments.map((sg, i) => (
            <View key={i} style={{ flex: 1, height: 5, borderRadius: 5, backgroundColor: colors.sunk, overflow: "hidden" }}>
              {sg.fill > 0 ? <View style={{ width: `${Math.round(sg.fill * 100)}%`, height: "100%", backgroundColor: colors.inv }} /> : null}
            </View>
          ))}
        </View>
      </View>
      <FigureCells cells={cells} line />
    </Card>
  );
}

export function QuickTiles({ items }: { items: { key: string; icon: IconName; tone: Tone; label: string; onPress: () => void; busy?: boolean }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {items.map((it) => (
        <Press key={it.key} onPress={it.onPress} accessibilityRole="button" accessibilityLabel={it.label}
          style={{ flex: 1, height: 78, alignItems: "center", justifyContent: "center", gap: 6, borderRadius: tokens.radius.banner, backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.ring}`, opacity: it.busy ? 0.6 : 1 }}>
          <Icon name={it.icon} tone={it.tone} size={26} />
          <Text size={12.5} weight={500} numberOfLines={1}>{it.label}</Text>
        </Press>
      ))}
    </View>
  );
}

export function FieldReport({ initials, tint, who, when, kind, text, children }: { initials: string; tint: AvatarTint; who: string; when: string; kind: { tone: StatusTone; shape: StatusShape; word: string }; text: string; children?: ReactNode }) {
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Avatar initials={initials} tint={tint} size={26} />
        <Text size={13.5} weight={500} numberOfLines={1} style={{ flexShrink: 1 }}>{who}</Text>
        <Text size={11.5} color="faint">{when}</Text>
        <View style={{ flexGrow: 1 }} />
        <Status tone={kind.tone} shape={kind.shape}>{kind.word}</Status>
      </View>
      <Text size={14.5} color="t2" leading={1.45} style={{ marginTop: 8 }}>{text}</Text>
      {children ? <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>{children}</View> : null}
    </View>
  );
}

export function BudgetBars({ rows, mark, markLabel }: { rows: { name: string; spent: string; planned: string; ratio: number; tone: "ok" | "warn" | "bad" }[]; mark: number; markLabel: string }) {
  const { colors } = useTheme();
  return (
    <Card padded>
      {rows.map((r) => (
        <View key={r.name} style={{ paddingVertical: 7 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <Text size={13.5} style={{ flexShrink: 1 }}>{r.name}</Text>
            <Text size={12.5} color="muted"><Text size={12.5} weight={600}>{r.spent}</Text>{` / ${r.planned}`}</Text>
          </View>
          <View style={{ marginTop: 8 }}>
            <Progress value={r.ratio} fill={r.tone === "bad" ? "bad" : r.tone === "warn" ? "warn-dot" : "inv"} height={6} label={r.name} />
            <View style={{ position: "absolute", top: -3, left: `${Math.round(Math.max(0, Math.min(1, mark)) * 100)}%`, width: 2, height: 12, borderRadius: 2, backgroundColor: colors.acc }} />
          </View>
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
        <View style={{ width: 2, height: 10, borderRadius: 2, backgroundColor: colors.acc }} />
        <Text size={11.5} color="muted">{markLabel}</Text>
      </View>
    </Card>
  );
}

export { Hairline };

// ── Schedule tab ─────────────────────────────────────────────────────────────
// Timeline (.tl): a 22 rail with a dot (done: `ok-dot` with a check; current: `card` with a 2 `acc` ring and an 8 dot; upcoming: a 2
// `line2` ring) and a 2 wide line (`ok-dot` after a done one), then the title 14.5/500 (`t2` while upcoming), "dates · tasks" 12.5 muted
// and the status pill; the current milestone opens its tasks in a `soft` well (radius 14, padding 4 12).
// TaskBox (.cb): 20, radius 6, a 1.6 `line2` ring; done: `ok-dot` with a check, the text struck through in `muted`.
// CrewGrid (.wk): four weeks side by side, five 18 tall cells each (radius 4, gap 2): this job `inv`, other jobs `faint` at 45 %, a clash `bad`.
export function TimelineItem({ state, last, title, meta, status, children }: { state: "done" | "current" | "upcoming"; last: boolean; title: string; meta: string; status: { tone: StatusTone; shape: StatusShape; word: string }; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16 }}>
      <View style={{ alignItems: "center", width: 22 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: state === "done" ? colors["ok-dot"] : colors.card,
          boxShadow: state === "current" ? `inset 0 0 0 2px ${colors.acc}` : state === "upcoming" ? `inset 0 0 0 2px ${colors.line2}` : undefined }}>
          {state === "done" ? <Glyph name="check" size={12} color="card" weight={3} /> : state === "current" ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.acc }} /> : null}
        </View>
        <View style={{ flexGrow: 1, width: 2, marginVertical: 4, backgroundColor: last ? "transparent" : state === "done" ? colors["ok-dot"] : colors.line2 }} />
      </View>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, paddingBottom: 18 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <View style={{ flexShrink: 1, gap: 2 }}>
            <Text size={14.5} weight={500} color={state === "upcoming" ? "t2" : "ink"}>{title}</Text>
            <Text size={12.5} color="muted">{meta}</Text>
          </View>
          <Status tone={status.tone} shape={status.shape}>{status.word}</Status>
        </View>
        {children}
      </View>
    </View>
  );
}

export function TaskList({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ marginTop: 8, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.soft }}>{children}</View>;
}

export function TaskRow({ title, site, done, onToggle, plus }: { title: string; site?: string; done?: boolean; onToggle?: () => void; plus?: boolean }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onToggle} accessibilityRole={plus ? "button" : "checkbox"} accessibilityState={plus ? undefined : { checked: !!done }} accessibilityLabel={title}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
      <View style={{ width: 20, height: 20, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: done ? colors["ok-dot"] : "transparent", boxShadow: done || plus ? undefined : `inset 0 0 0 1.6px ${colors.line2}` }}>
        {done ? <Glyph name="check" size={12} color="card" weight={3} /> : plus ? <Glyph name="plus" size={14} color="muted" weight={2.2} /> : null}
      </View>
      <View style={{ flexGrow: 1, flexShrink: 1 }}>
        <Text size={13.5} color={plus ? "muted" : done ? "muted" : "ink"} style={done ? { textDecorationLine: "line-through" } : undefined}>{title}</Text>
        {site ? <Text size={11.5} color="acc-t">{site}</Text> : null}
      </View>
    </Press>
  );
}

export function CrewGrid({ weekLabels, rows, legend }: { weekLabels: string[]; rows: { key: string; initials: string; tint: AvatarTint; weeks: ("j" | "o" | "x" | "")[][] }[]; legend: { thisJob: string; other: string; clash: string } }) {
  const { colors } = useTheme();
  const cell = (c: string): { backgroundColor: string; opacity?: number } => (c === "j" ? { backgroundColor: colors.inv } : c === "o" ? { backgroundColor: colors.faint, opacity: 0.45 } : c === "x" ? { backgroundColor: colors.bad } : { backgroundColor: colors.sunk });
  const weeks = (w: string[][]) => <View style={{ flexDirection: "row", flexGrow: 1, gap: 6 }}>{w.map((days, i) => <View key={i} style={{ flex: 1, flexDirection: "row", gap: 2 }}>{days.map((c, k) => <View key={k} style={[{ flex: 1, height: 18, borderRadius: 4 }, cell(c)]} />)}</View>)}</View>;
  return (
    <Card padded>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ width: 28 }} />
        <View style={{ flexDirection: "row", flexGrow: 1, gap: 6 }}>{weekLabels.map((l, i) => <View key={i} style={{ flex: 1 }}><Num size={11.5} weight={500} color="faint">{l}</Num></View>)}</View>
      </View>
      {rows.map((r) => (
        <View key={r.key} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
          <Avatar initials={r.initials} tint={r.tint} size={28} />
          {weeks(r.weeks)}
        </View>
      ))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 14 }}>
        {([[legend.thisJob, colors.inv, 1], [legend.other, colors.faint, 0.45], [legend.clash, colors.bad, 1]] as const).map(([label, color, op]) => (
          <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, opacity: op }} />
            <Text size={11.5} color="muted">{label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
