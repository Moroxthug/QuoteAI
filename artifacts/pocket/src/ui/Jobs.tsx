// The Jobs tab's own pieces (Jobs.dc.html).
// JobHead (.jcard head): the name 15/600 with the value Num 14.5/600 on the right, "client · what's next" 12.5 muted, the
// progress bar with its percent (12.5 t2), then the crew's avatars (28, overlapping by 3, a 2 ring of the card) with the note
// and the status pill on the right. Padding 15 16 14 (the chevron sits to the right, as in every card row).
// SetupCard (.jsetup): an `acc-soft` card, radius 22, padding 14 16: a 30 icon, the name and what it is, the value and
// "Review ›". ReceiptsRow (.lrow): a card, radius 18, padding 10 14 10 12, a 28 receipt icon and a chevron.
// JobStats (.jx-stats): three tiles, `soft`, radius 14, padding 10 12, label 11.5 muted over the figure Num 15/600.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Avatar, type AvatarTint } from "./Avatar";
import { Card } from "./Card";
import { Glyph, Icon } from "./Icon";
import { Progress } from "./Numbers";
import { Press } from "./motion";
import { Status, type StatusShape, type StatusTone } from "./Status";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

export function CrewStack({ people, note }: { people: { initials: string; tint: AvatarTint }[]; note?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1, minWidth: 0 }}>
      {people.map((p, i) => (
        <View key={i} style={{ marginLeft: i === 0 ? 0 : -3, borderRadius: 14, backgroundColor: colors.card, boxShadow: `0 0 0 2px ${colors.card}` }}>
          <Avatar initials={p.initials} tint={p.tint} size={28} />
        </View>
      ))}
      {note ? <Text size={12.5} color="muted" numberOfLines={1} style={{ marginLeft: people.length ? 8 : 0, flexShrink: 1 }}>{note}</Text> : null}
    </View>
  );
}

export function JobHead({ name, value, sub, progress, pct, fill = "inv", crew, crewNote, status }: {
  name: string; value: string; sub: string; progress?: number; pct?: string; fill?: ColorName;
  crew: { initials: string; tint: AvatarTint }[]; crewNote?: string; status: { tone: StatusTone; shape: StatusShape; word: string };
}) {
  return (
    <View style={{ paddingTop: 15, paddingBottom: 14, paddingLeft: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <Text size={15} weight={600} tracking={-0.015} numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
        <Num size={14.5} weight={600}>{value}</Num>
      </View>
      <Text size={12.5} color="muted" numberOfLines={1} style={{ marginTop: 3 }}>{sub}</Text>
      {progress != null ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 }}>
          <View style={{ flexGrow: 1 }}><Progress value={progress} fill={fill} label={name} /></View>
          <Num size={12.5} weight={500} color="t2" style={{ minWidth: 32, textAlign: "right" }}>{pct}</Num>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 11 }}>
        <CrewStack people={crew} note={crewNote} />
        <Status tone={status.tone} shape={status.shape}>{status.word}</Status>
      </View>
    </View>
  );
}

export function SetupCard({ name, meta, value, action, onPress }: { name: string; meta: string; value: string; action: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}. ${meta}. ${value}. ${action}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors["acc-soft"] }}>
      <Icon name="list" tone="violet" size={30} />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={600} numberOfLines={1}>{name}</Text>
        <Text size={12.5} color="acc-soft-t" numberOfLines={1}>{meta}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <Num size={14.5} weight={600}>{value}</Num>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Text size={12.5} weight={600} color="acc-soft-t">{action}</Text>
          <Glyph name="chevron" size={13} color="acc-soft-t" weight={2.2} />
        </View>
      </View>
    </Press>
  );
}

export function ReceiptsRow({ title, sub, onPress }: { title: string; sub: ReactNode; onPress: () => void }) {
  return (
    <Card style={{ borderRadius: 18 }}>
      <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 12, paddingRight: 14 }}>
        <Icon name="receipt" tone="amber" size={28} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
        </View>
        <Glyph name="chevron" size={15} color="faint" weight={2} />
      </Press>
    </Card>
  );
}

export function JobStats({ items }: { items: { label: string; value: string }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
      {items.map((s) => (
        <View key={s.label} style={{ flex: 1, minWidth: 0, gap: 2, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.soft }}>
          <Text size={11.5} color="muted" numberOfLines={1}>{s.label}</Text>
          <Num size={15} weight={600} tracking={-0.02}>{s.value}</Num>
        </View>
      ))}
    </View>
  );
}
