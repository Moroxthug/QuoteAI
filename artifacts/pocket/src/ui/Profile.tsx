// Profile.dc.html: the head (a round avatar with a camera button, the name, the job and company, the role tag), the six figures of "My numbers" in one card with the
// three months under it, and the signature card. Sizes are the board's own (.pf-*).
import type { ReactNode } from "react";
import { Image, View } from "react-native";
import { Button } from "./Button";
import { Card, Hairline } from "./Card";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { SignatureView } from "./SignaturePad";
import { Tag } from "./Status";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

/** The avatar (88, initials on `inv`, or the photo), its camera button, the name, the job · company line and the role tag. */
export function ProfileHead({ initials, photo, name, line, tag, photoLabel, onPhoto }: { initials: string; photo?: string | null; name: string; line: string; tag: string; photoLabel: string; onPhoto: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingTop: 14, paddingHorizontal: 20 }}>
      <View>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {photo ? <Image source={{ uri: photo }} style={{ width: 88, height: 88 }} accessibilityIgnoresInvertColors /> : <Text size={30} weight={600} tracking={-0.03} color="on-inv" allowFontScaling={false}>{initials}</Text>}
        </View>
        <Press onPress={onPhoto} accessibilityRole="button" accessibilityLabel={photoLabel} hitSlop={6}
          style={{ position: "absolute", right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 1px ${colors.ring}, 0 4px 12px -4px ${colors.shadow}` }}>
          <Glyph name="camera" size={16} />
        </Press>
      </View>
      <Text size={24} weight={600} tracking={-0.035} align="center" accessibilityRole="header" style={{ marginTop: 18 }}>{name}</Text>
      <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text size={13.5} color="muted">{line}</Text>
        <Tag accent>{tag}</Tag>
      </View>
    </View>
  );
}

export type Kpi = { label: string; value: string; sub: string; subTone: Extract<ColorName, "muted" | "ok" | "bad" | "warn"> };

/** The six figures in one card: three across, two rows, a hairline between them. */
export function NumbersGrid({ items }: { items: Kpi[] }) {
  const { colors } = useTheme();
  const row = (list: Kpi[], second: boolean) => (
    <View style={{ flexDirection: "row", borderTopWidth: second ? 1 : 0, borderTopColor: colors.line }}>
      {list.map((k, i) => (
        <View key={k.label} accessible accessibilityLabel={`${k.label}, ${k.value}, ${k.sub}`} style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 14, paddingHorizontal: 14, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.line }}>
          <Text size={11.5} color="muted">{k.label}</Text>
          <Num size={19} weight={600} tracking={-0.03} numberOfLines={1} adjustsFontSizeToFit>{k.value}</Num>
          <Text size={11.5} color={k.subTone} numberOfLines={1}>{k.sub}</Text>
        </View>
      ))}
    </View>
  );
  return <Card>{row(items.slice(0, 3), false)}{row(items.slice(3, 6), true)}</Card>;
}

/** The last three months: month, sent, won, invoiced. */
export function MonthsTable({ head, rows }: { head: string[]; rows: { month: string; sent: string; won: string; invoiced: string }[] }) {
  const cell = (n: number) => ({ flex: n, minWidth: 0 });
  const line = (cells: ReactNode[], key: string) => (
    <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, paddingHorizontal: 16 }}>
      {cells.map((c, i) => <View key={i} style={[cell(i === 0 ? 2.2 : i === 3 ? 2.2 : 1), { alignItems: i === 0 ? "flex-start" : "flex-end" }]}>{c}</View>)}
    </View>
  );
  return (
    <Card style={{ marginTop: 10 }}>
      {line(head.map((h) => <Text key={h} size={11.5} color="muted">{h}</Text>), "head")}
      <Hairline inset={0} />
      {rows.map((r) => line([<Text key="m" size={14.5} weight={500}>{r.month}</Text>, <Num key="s" size={14.5} weight={500}>{r.sent}</Num>, <Num key="w" size={14.5} weight={500}>{r.won}</Num>, <Num key="i" size={14.5} weight={600}>{r.invoiced}</Num>], r.month))}
    </Card>
  );
}

/** The signature card: what was drawn on its baseline and what it is for. */
export function SignatureCard({ d, alt, caption, empty }: { d: string; alt: string; caption: string; empty?: string }) {
  return (
    <Card padded style={{ padding: 12 }}>
      <View style={{ alignItems: "center" }}><SignatureView d={d} label={alt} width={300} /></View>
      <Text size={12.5} color="muted" style={{ paddingTop: 10, paddingHorizontal: 4 }}>{d || !empty ? caption : empty}</Text>
    </Card>
  );
}

/** A link row with a chevron under the signature (Notifications, Sign-in and security). */
export function ProfileButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Button kind="destructive" label={label} onPress={onPress} block />;
}
