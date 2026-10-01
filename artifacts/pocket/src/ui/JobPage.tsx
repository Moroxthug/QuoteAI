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
import { Icon, type IconName, type Tone } from "./Icon";
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
      <View style={{ flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: colors.line }}>
        {cells.map((c, i) => (
          <View key={i} style={{ width: "50%", gap: 3, paddingVertical: 14, paddingHorizontal: 16, borderLeftWidth: i % 2 ? 1 : 0, borderLeftColor: colors.line, borderTopWidth: i > 1 ? 1 : 0, borderTopColor: colors.line }}>
            <Text size={12.5} color="muted">{c.label}</Text>
            <Num size={19} weight={600} tracking={-0.03} color={c.valueTone ?? "ink"}>{c.value}</Num>
            <Text size={11.5} color="muted" leading={1.35}>{c.sub}</Text>
          </View>
        ))}
      </View>
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
