// Integration.dc.html (QuickBooks Online): the app's heading, a matching row (what it is, the QuickBooks account it goes to or "Not matched"), a line of the sync log (with Retry on a
// failure), the numbered steps and the two lists of what quoteAI can and cannot do.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Button } from "./Button";
import { Card, Hairline } from "./Card";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

export function AppHead({ icon, name, sub }: { icon: ReactNode; name: string; sub: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      {icon}
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 3 }}>
        <Text size={24} weight={600} tracking={-0.035} leading={1.15} accessibilityRole="header">{name}</Text>
        <Text size={13.5} color="muted">{sub}</Text>
      </View>
    </View>
  );
}

/** A matching row: the label and what it is, and on the right the account with a check, or the "Not matched" pill (given as `right`). */
export function MatchLine({ first, title, sub, right, onPress, label }: { first?: boolean; title: string; sub: string; right: ReactNode; onPress?: () => void; label: string }) {
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
      </View>
      {right}
    </View>
  );
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      {onPress ? <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{body}</Press> : body}
    </View>
  );
}

/** The account a row goes to, with a small check, on one line. */
export function MappedTo({ name }: { name: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, maxWidth: "55%" }}>
      <Text size={13.5} color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
      <Glyph name="check" size={14} color="ok" weight={2.6} />
    </View>
  );
}

/** One line of the sync log: its glyph (given), what it was, how it went, the status and the time; a failure has a Retry button under it. */
export function SyncLine({ first, icon, title, sub, subTone, status, time, action }: { first?: boolean; icon: ReactNode; title: string; sub: string; subTone?: "bad"; status: ReactNode; time: string; action?: { label: string; onPress: () => void; busy?: boolean } }) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 13, paddingHorizontal: 16 }}>
        {icon}
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
          {sub ? <Text size={12.5} color={subTone ?? "muted"} leading={1.35} numberOfLines={3}>{sub}</Text> : null}
          {action ? <View style={{ flexDirection: "row", marginTop: 8 }}><Button size="sm" label={action.label} onPress={action.onPress} disabled={action.busy} /></View> : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          {status}
          <Num size={11.5} color="faint">{time}</Num>
        </View>
      </View>
    </View>
  );
}

/** The three steps, each a 28 circle with its number, a title and a line. */
export function StepsCard({ steps }: { steps: { title: string; sub: string }[] }) {
  const { colors } = useTheme();
  return (
    <Card style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
      {steps.map((s, i) => (
        <View key={s.title} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center" }}><Num size={13.5} weight={600}>{String(i + 1)}</Num></View>
          <View style={{ flexShrink: 1, gap: 2, paddingTop: 3 }}>
            <Text size={14.5} weight={500}>{s.title}</Text>
            <Text size={12.5} color="muted" leading={1.35}>{s.sub}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

/** Lines with a check (what quoteAI can do) or a cross (what it can't), then an optional note. */
export function CheckCard({ yes, no, note }: { yes: string[]; no?: string[]; note?: string }) {
  const { colors } = useTheme();
  const row = (text: string, ok: boolean) => (
    <View key={text} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 7 }}>
      <View style={{ paddingTop: 2 }}><Glyph name={ok ? "check" : "close"} size={14} color={ok ? "ok" : "bad"} weight={2.6} /></View>
      <Text size={14.5} leading={1.4} style={{ flexShrink: 1 }}>{text}</Text>
    </View>
  );
  return (
    <Card style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
      {yes.map((t) => row(t, true))}
      {no?.length ? <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 6 }} /> : null}
      {(no ?? []).map((t) => row(t, false))}
      {note ? <Text size={12.5} color="muted" leading={1.4} style={{ paddingTop: 8 }}>{note}</Text> : null}
    </Card>
  );
}

/** A line of muted text inside a card (nothing synced yet). */
export function CardNote({ children }: { children: string }) {
  return <Text size={13.5} color="muted" style={{ padding: 16 }}>{children}</Text>;
}

/** A centred muted line under a button. */
export function ButtonNote({ children }: { children: string }) {
  return <Text size={12.5} color="muted" leading={1.45} align="center" style={{ marginHorizontal: 4, marginTop: 10 }}>{children}</Text>;
}
