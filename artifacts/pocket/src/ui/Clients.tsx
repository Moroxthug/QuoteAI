// Pieces of the Clients tab and the Client screen (Clients.dc.html, Client.dc.html).
// ContactButtons (.cx-con): three equal 34 buttons (`sunk`, radius 11, 13.5/600) with a 14 stroke icon, inside an open client card.
// ContactTiles (Client): four 70 tall tiles (`soft`, radius 16, a `line` ring): a 26 gradient icon over a 12.5/500 label.
// DetailRows: key / value rows inside one card (padding 13 16, hairlines): the key 13.5 muted, the value 14.5 right-aligned.
// FormSheet: a sheet that holds a stack of fields and one primary button (Add client, Edit details).
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Card, Hairline } from "./Card";
import { Glyph, Icon, type GlyphName, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

export type ContactAction = { key: string; glyph: GlyphName; label: string; onPress: () => void; done?: boolean };

export function ContactButtons({ actions }: { actions: ContactAction[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
      {actions.map((a) => (
        <Press key={a.key} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label}
          style={{ flex: 1, minWidth: 0, minHeight: 44, borderRadius: 11, backgroundColor: a.done ? colors["ok-soft"] : colors.sunk, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8 }}>
          <Glyph name={a.glyph} size={14} color={a.done ? "ok" : "ink"} />
          <Text size={13.5} weight={600} color={a.done ? "ok" : "ink"} numberOfLines={1}>{a.label}</Text>
        </Press>
      ))}
    </View>
  );
}

export type ContactTile = { key: string; icon: IconName; tone: Tone; label: string; aria: string; onPress: () => void; disabled?: boolean };

export function ContactTiles({ tiles }: { tiles: ContactTile[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
      {tiles.map((t) => (
        <Press key={t.key} onPress={t.onPress} disabled={t.disabled} accessibilityRole="button" accessibilityLabel={t.aria}
          style={{ flex: 1, minWidth: 0, height: 70, borderRadius: 16, backgroundColor: colors.soft, boxShadow: `0 0 0 1px ${colors.line}`, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 4, opacity: t.disabled ? 0.4 : 1 }}>
          <Icon name={t.icon} tone={t.tone} size={26} />
          <Text size={12.5} weight={500} numberOfLines={1}>{t.label}</Text>
        </Press>
      ))}
    </View>
  );
}

export function DetailRows({ rows }: { rows: { k: string; v: string; mono?: boolean }[] }) {
  return (
    <Card>
      {rows.map((r, i) => (
        <View key={r.k}>
          {i > 0 ? <Hairline inset={0} /> : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 16, paddingVertical: 13, paddingHorizontal: 16 }}>
            <Text size={13.5} color="muted" style={{ flexShrink: 0 }}>{r.k}</Text>
            {r.mono ? <Num size={14.5} weight={400} align="right" style={{ flexShrink: 1 }}>{r.v}</Num> : <Text size={14.5} leading={1.35} align="right" style={{ flexShrink: 1 }}>{r.v}</Text>}
          </View>
        </View>
      ))}
    </Card>
  );
}

/** Four boxes in two rows inside one card (Client's stats: 2 x 2, hairlines between). */
export function StatGrid({ items }: { items: { label: string; value: string; sub: string; tone?: "muted" | "ok" | "bad" }[] }) {
  const { colors } = useTheme();
  return (
    <Card style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {items.map((s, i) => (
        <View key={s.label} style={{ width: "50%", gap: 3, paddingVertical: 14, paddingHorizontal: 16, borderRightWidth: i % 2 === 0 ? 1 : 0, borderBottomWidth: i < 2 ? 1 : 0, borderColor: colors.line }}>
          <Text size={12.5} color="muted">{s.label}</Text>
          <Num size={19} weight={600} tracking={-0.03}>{s.value}</Num>
          <Text size={11.5} color={s.tone ?? "muted"}>{s.sub}</Text>
        </View>
      ))}
    </Card>
  );
}

/** The fields of a form sheet, scrolling if the keyboard leaves little room, then the one button. */
export function FormBody({ children, button }: { children: ReactNode; button: ReactNode }) {
  return (
    <View>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 6, gap: 12 }}>{children}</ScrollView>
      <View style={{ padding: 16 }}>{button}</View>
    </View>
  );
}

/** The client card's top: a 58 avatar beside the name (24/600), the address, the status and "client since". */
export function ClientHero({ avatar, name, address, status, since, children }: { avatar: ReactNode; name: string; address?: string; status: ReactNode; since: string; children?: ReactNode }) {
  return (
    <Card padded style={{ paddingTop: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {avatar}
        <View style={{ flexShrink: 1, gap: 4 }}>
          <Text size={24} weight={600} tracking={-0.035} leading={1.15} accessibilityRole="header">{name}</Text>
          {address ? <Text size={13.5} color="muted" leading={1.35}>{address}</Text> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2, alignItems: "center" }}>{status}<Text size={12.5} color="faint">{since}</Text></View>
        </View>
      </View>
      {children}
    </Card>
  );
}

/** A chat bubble: yours on the right (`inv`), theirs on the left (`card` with the ring); the time under it (11.5 faint). */
export function Bubble({ text, time, mine }: { text: string; time: string; mine: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 4, alignItems: mine ? "flex-end" : "flex-start" }}>
      <View style={[{ maxWidth: "78%", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 }, mine ? { backgroundColor: colors.inv, borderBottomRightRadius: 6 } : { backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.ring}`, borderBottomLeftRadius: 6 }]}>
        <Text size={14.5} leading={1.4} color={mine ? "on-inv" : "ink"}>{text}</Text>
      </View>
      <Text size={11.5} color="faint" style={{ paddingHorizontal: 6 }}>{time}</Text>
    </View>
  );
}

/** The portal card: a 30 icon, the title and a muted line; a `sunk` link pill with its status; two buttons; a faint note. */
export function PortalCard({ icon, title, sub, link, status, children, note }: { icon: ReactNode; title: string; sub: string; link: string | null; status: ReactNode; children: ReactNode; note: string }) {
  const { colors } = useTheme();
  return (
    <Card padded>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {icon}
        <View style={{ flexShrink: 1, gap: 2 }}>
          <Text size={15} weight={600}>{title}</Text>
          <Text size={12.5} color="muted">{sub}</Text>
        </View>
      </View>
      {link ? (
        <View style={{ marginTop: 14, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 13, backgroundColor: colors.sunk, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <Text size={13.5} numberOfLines={1} style={{ flexShrink: 1 }}>{link.replace(/^https?:\/\//, "")}</Text>
          {status}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>{children}</View>
      <Text size={12.5} color="faint" style={{ marginTop: 12, marginHorizontal: 2 }}>{note}</Text>
    </Card>
  );
}

/** A job in the Jobs tab: icon, name and dates, a status; the phase and percent over a progress bar; two facts. */
export function JobCard({ icon, name, dates, status, phaseLabel, percent, children }: { icon: ReactNode; name: string; dates: string; status: ReactNode; phaseLabel: string; percent: ReactNode; children: ReactNode }) {
  return (
    <Card padded>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {icon}
        <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
          <Text size={15} weight={600} numberOfLines={1}>{name}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}>{dates}</Text>
        </View>
        {status}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 16 }}>
        <Text size={13.5} color="muted">{phaseLabel}</Text>{percent}
      </View>
      {children}
    </Card>
  );
}

/** The round 44 `inv` send button next to a message field. */
export function SendButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}>
      <Glyph name="arrowUp" size={18} color="on-inv" weight={2.2} />
    </Press>
  );
}
