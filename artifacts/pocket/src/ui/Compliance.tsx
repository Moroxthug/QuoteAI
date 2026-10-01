// Compliance.dc.html: the three numbers, the return card, the 90-day strip, a deadline row that opens in place, and the "how you file" rows.
// Sizes are the board's own (.cp-kpi, .cp-three, .cp-strip, .cp-mk, .cp-item, .cp-acts).
import { Children, type ReactNode } from "react";
import { View } from "react-native";
import { Card } from "./Card";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Status, type StatusShape, type StatusTone } from "./Status";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

/** The three numbers: label, figure (red when it needs you) and a line under it, with hairlines between. */
export function KpiThree({ items }: { items: { label: string; value: string; sub: string; tone?: ColorName }[] }) {
  const { colors } = useTheme();
  return (
    <Card style={{ flexDirection: "row", paddingVertical: 14, paddingHorizontal: 4 }}>
      {items.map((k, i) => (
        <View key={i} accessible accessibilityLabel={`${k.label}, ${k.value}, ${k.sub}`} style={{ flex: 1, minWidth: 0, gap: 3, paddingHorizontal: 12, borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: colors.line }}>
          <Text size={11.5} color="muted">{k.label}</Text>
          <Num size={19} weight={600} tracking={-0.03} color={k.tone ?? "ink"}>{k.value}</Num>
          <Text size={11.5} color="muted" numberOfLines={1}>{k.sub}</Text>
        </View>
      ))}
    </Card>
  );
}

type St = { tone: StatusTone; shape: StatusShape; label: string };

/** The return card: icon, title, period and status; the net figure; collected / credits / days left; then the buttons. */
export function ReturnCard({ icon, tone, title, sub, status, caption, whole, cents, three, children }: {
  icon: IconName; tone: Tone; title: string; sub: string; status: St; caption: string; whole: string; cents: string; three: { label: string; value: string }[]; children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name={icon} tone={tone} size={30} />
          <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
            <Text size={17} weight={600} tracking={-0.02}>{title}</Text>
            <Text size={12.5} color="muted">{sub}</Text>
          </View>
          <Status tone={status.tone} shape={status.shape}>{status.label}</Status>
        </View>
        <View style={{ gap: 4, marginTop: 4 }}>
          <Text size={12.5} color="muted">{caption}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Num size={32} weight={600} tracking={-0.04}>{whole}</Num>
            {cents ? <Num size={19} weight={600} color="faint" tracking={-0.01}>{cents}</Num> : null}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line }}>
        {three.map((c, i) => (
          <View key={i} style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: colors.line }}>
            <Text size={11.5} color="muted" numberOfLines={1}>{c.label}</Text>
            <Num size={15} weight={600}>{c.value}</Num>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.line }}>
        {Children.toArray(children).map((c, i) => <View key={i} style={{ flex: 1, minWidth: 0 }}>{c}</View>)}
      </View>
    </Card>
  );
}

const LOOK_DOT: Record<string, ColorName> = { overdue: "bad", due: "warn-dot", later: "warn-dot", filed: "ok-dot" };

/** The 90-day strip (122 tall): a track with the month starts, today at the left, and a 44 marker for each deadline above or below it. */
export function Strip({ label, ticks, marks, selected, onPick }: {
  label: string;
  ticks: { key: string; pct: number; label: string }[];
  marks: { id: string; pct: number; lane: "up" | "dn"; look: string; date: string; aria: string }[];
  selected: string | null;
  onPick: (id: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="summary" accessibilityLabel={label} style={{ height: 122, marginTop: 4 }}>
      <View style={{ position: "absolute", left: 0, right: 0, top: 48, height: 4, borderRadius: 4, backgroundColor: colors.sunk }} />
      {ticks.map((t) => <View key={t.key} style={{ position: "absolute", top: 44, left: `${t.pct}%`, marginLeft: -0.75, width: 1.5, height: 12, borderRadius: 2, backgroundColor: colors.line2 }} />)}
      <View style={{ position: "absolute", left: 0, top: 40, width: 3, height: 20, borderRadius: 3, backgroundColor: colors.inv }} />
      {ticks.map((t) => <Text key={`m${t.key}`} size={11.5} color="faint" style={{ position: "absolute", top: 104, left: `${t.pct}%` }}>{t.label}</Text>)}
      {marks.map((m) => {
        const on = m.id === selected;
        const up = m.lane === "up";
        return (
          <Press key={m.id} onPress={() => onPick(m.id)} accessibilityRole="button" accessibilityLabel={m.aria} accessibilityState={{ selected: on }}
            style={{ position: "absolute", left: `${m.pct}%`, marginLeft: -22, top: up ? 8 : 48, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <View style={{ position: "absolute", left: 21.25, top: up ? 29 : 4, width: 1.5, height: 11, backgroundColor: colors.line2 }} />
            <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: colors[LOOK_DOT[m.look] ?? "warn-dot"], boxShadow: `0 0 0 2.5px ${colors.card}`, transform: [{ scale: on ? 1.3 : 1 }] }} />
            <View style={{ position: "absolute", left: -20, width: 84, alignItems: "center", pointerEvents: "none", ...(up ? { bottom: 32 } : { top: 32 }) }}>
              <Text size={11.5} weight={on ? 600 : 400} color={on ? "ink" : "muted"} numberOfLines={1}>{m.date}</Text>
            </View>
          </Press>
        );
      })}
    </View>
  );
}

/** The deadline the strip has selected: title and when, with its status. */
export function StripSelected({ title, when, status }: { title: string; when: string; status: St }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 1 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
        <Text size={12.5} color="muted">{when}</Text>
      </View>
      <Status tone={status.tone} shape={status.shape}>{status.label}</Status>
    </View>
  );
}

/** A deadline row: icon 26, title and line, status over the amount. Selecting it shades the row and shows its buttons below. */
export function DeadlineItem({ icon, tone, title, sub, status, amount, selected, expanded, onPress, first, children }: {
  icon: IconName; tone: Tone; title: string; sub: string; status: St; amount?: string; selected: boolean; expanded: boolean; onPress: () => void; first?: boolean; children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 13, paddingHorizontal: 16, backgroundColor: selected ? colors.soft : undefined, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}>
      <Press onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${title}, ${status.label}${amount ? `, ${amount}` : ""}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 44 }}>
        <Icon name={icon} tone={tone} size={26} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 3 }}>
          <Text size={14.5} weight={500}>{title}</Text>
          <Text size={12.5} color="muted" leading={1.4}>{sub}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <Status tone={status.tone} shape={status.shape}>{status.label}</Status>
          {amount ? <Num size={12.5} weight={600}>{amount}</Num> : null}
        </View>
      </Press>
      {expanded && children ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>{children}</View> : null}
    </View>
  );
}


/** A "how you file" row: a 24 icon, the label, its value and a chevron. */
export function SetupRow({ icon, tone, label, value, onPress }: { icon: IconName; tone: Tone; label: string; value: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingVertical: 12, paddingHorizontal: 16 }}>
      <Icon name={icon} tone={tone} size={24} />
      <Text size={14.5} weight={500} style={{ flexGrow: 1, flexShrink: 1 }}>{label}</Text>
      <Text size={13.5} color="muted" numberOfLines={1}>{value}</Text>
      <Glyph name="chevron" size={15} color="faint" />
    </Press>
  );
}

