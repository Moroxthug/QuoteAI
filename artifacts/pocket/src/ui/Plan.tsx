// SetPlan.dc.html: the plan card (name, its state, two figures), a meter for each thing the plan counts, the list of what it includes (a lock and the tier's tag where it
// doesn't), and the card that sends the person to quoteai.ca. Plans are never bought or changed in the app.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Button } from "./Button";
import { Card, Hairline } from "./Card";
import { Icon } from "./Icon";
import { Progress } from "./Numbers";
import { Tag } from "./Status";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

/** "Your plan" and its name, the state on the right, two figures under a hairline (Renews, Logins). */
export function PlanCard({ label, name, state, figures }: { label: string; name: string; state: ReactNode; figures: { label: string; value: string; tone?: Extract<ColorName, "bad"> }[] }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 3 }}>
          <Text size={12.5} color="muted">{label}</Text>
          <Text size={24} weight={600} tracking={-0.035} leading={1.1} accessibilityRole="header">{name}</Text>
        </View>
        {state}
      </View>
      <Hairline inset={0} />
      <View style={{ flexDirection: "row" }}>
        {figures.map((f, i) => (
          <View key={f.label} style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 12, paddingHorizontal: 16, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.line }}>
            <Text size={11.5} color="muted">{f.label}</Text>
            <Num size={15} weight={600} color={f.tone ?? "ink"}>{f.value}</Num>
          </View>
        ))}
      </View>
    </Card>
  );
}

export type MeterLevel = "ok" | "near" | "full";
const FILL: Record<MeterLevel, ColorName> = { ok: "inv", near: "warn-dot", full: "bad" };
const TEXT: Record<MeterLevel, ColorName> = { ok: "ink", near: "warn", full: "bad" };

/** One meter: the label, "{used} of {total}" with the used figure in 600 (amber near the end, red when full), the bar and a line under it. */
export function PlanMeter({ label, used, total, of, value, level, sub }: { label: string; used: string; total: string; of: string; value: number; level: MeterLevel; sub: string }) {
  return (
    <View accessible accessibilityLabel={`${label}, ${used} ${of} ${total}, ${sub}`} style={{ gap: 8, paddingVertical: 14, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text size={14.5} weight={500} style={{ flexShrink: 1 }}>{label}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}><Num size={15} weight={600} color={TEXT[level]}>{used}</Num>{` ${of} `}<Num size={12.5} color="muted">{total}</Num></Text>
      </View>
      <Progress value={value} fill={FILL[level]} height={4} />
      <Text size={11.5} color={level === "ok" ? "muted" : TEXT[level]}>{sub}</Text>
    </View>
  );
}

export function PlanMeters({ children }: { children: ReactNode[] }) {
  return <Card>{children.map((c, i) => <View key={i}>{i ? <Hairline /> : null}{c}</View>)}</Card>;
}

/** What the plan includes: a check and the line, or a lock, the line in muted and the tier's tag. */
export function IncludedList({ rows }: { rows: { id: string; text: string; locked: boolean; tag?: string }[] }) {
  return (
    <Card style={{ paddingVertical: 6, paddingHorizontal: 16 }}>
      {rows.map((r, i) => (
        <View key={r.id}>
          {i ? <Hairline inset={0} /> : null}
          <View accessible accessibilityLabel={r.locked && r.tag ? `${r.text}, ${r.tag}` : r.text} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}>
            <Icon name={r.locked ? "lock" : "check"} tone={r.locked ? "slate" : "sage"} size={22} />
            <Text size={14.5} color={r.locked ? "muted" : "ink"} style={{ flexGrow: 1, flexShrink: 1 }}>{r.text}</Text>
            {r.locked && r.tag ? <Tag>{r.tag}</Tag> : null}
          </View>
        </View>
      ))}
    </Card>
  );
}

/** "Plans and billing are managed on quoteai.ca" with the button. */
export function WebCard({ title, sub, button, onOpen }: { title: string; sub: string; button: string; onOpen: () => void }) {
  return (
    <Card style={{ paddingTop: 18, paddingBottom: 16, paddingHorizontal: 16, alignItems: "center", gap: 6 }}>
      <Text size={16} weight={600} align="center" style={{ marginTop: 4 }}>{title}</Text>
      <Text size={13.5} color="muted" align="center" leading={1.4}>{sub}</Text>
      <View style={{ alignSelf: "stretch", marginTop: 10 }}><Button kind="primary" size="md" block label={button} onPress={onOpen} /></View>
    </Card>
  );
}
