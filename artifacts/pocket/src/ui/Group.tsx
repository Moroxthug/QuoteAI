// Group.dc.html: the company switcher, the two-by-two figures, the invoiced-by-month bars, the company rows, the shared rows and the crew rows.
// Sizes are the board's own (.gp-sw, .gp-kpi, .gp-mb, .gp-stack, .gp-feat). KpiGrid2 is also the six figures of Analytics (.an-kpis).
import type { ReactNode } from "react";
import { View } from "react-native";
import { Avatar, type AvatarTint } from "./Avatar";
import { Button } from "./Button";
import { Card, Hairline } from "./Card";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Status, type StatusShape, type StatusTone } from "./Status";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

/** The switcher: "Showing" over the company's name, a chevron that turns; opened it lists the choices under a hairline. */
export function ScopeSwitch({ icon, tone, label, name, open, onToggle, children }: { icon: IconName; tone: Tone; label: string; name: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <Card>
      <Press onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${label}, ${name}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 14, minHeight: 44 }}>
        <View style={{ width: 28, height: 28, flexShrink: 0 }}><Icon name={icon} tone={tone} size={28} /></View>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={12.5} color="muted">{label}</Text>
          <Text size={16} weight={600} numberOfLines={1}>{name}</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}><Glyph name="chevronDown" size={18} color="muted" /></View>
      </Press>
      {open ? <View accessibilityRole="list"><Hairline inset={0} />{children}</View> : null}
    </Card>
  );
}

/** One choice in the switcher: its icon, name over a line, and a tick when it is the one showing. */
export function ScopeOption({ icon, tone, name, sub, on, onPress }: { icon: IconName; tone: Tone; name: string; sub: string; on: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${name}, ${sub}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
      <View style={{ width: 28, height: 28, flexShrink: 0 }}><Icon name={icon} tone={tone} size={28} /></View>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
      </View>
      {on ? <Glyph name="check" size={18} color="acc-t" weight={2.4} /> : null}
    </Press>
  );
}

export type KpiCell = { label: string; value: string; sub: string; subTone?: ColorName };

/** Figures two to a row inside one card, hairlines between: label, a 19/600 figure and a line under it. */
export function KpiGrid2({ items, labelSize = 12.5, pad = 14 }: { items: KpiCell[]; labelSize?: 11.5 | 12.5; pad?: number }) {
  const { colors } = useTheme();
  const rows: KpiCell[][] = [];
  items.forEach((k, i) => (i % 2 ? rows[rows.length - 1]!.push(k) : rows.push([k])));
  return (
    <Card>
      {rows.map((r, ri) => (
        <View key={ri} style={{ flexDirection: "row", borderTopWidth: ri > 0 ? 1 : 0, borderTopColor: colors.line }}>
          {r.map((k, ci) => (
            <View key={ci} accessible accessibilityLabel={`${k.label}, ${k.value}, ${k.sub}`}
              style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: pad, paddingHorizontal: 16, borderLeftWidth: ci > 0 ? 1 : 0, borderLeftColor: colors.line }}>
              <Text size={labelSize} color="muted">{k.label}</Text>
              <Num size={19} weight={600} tracking={-0.03}>{k.value}</Num>
              <Text size={11.5} color={k.subTone ?? "muted"}>{k.sub}</Text>
            </View>
          ))}
          {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </Card>
  );
}

/** The key under "Invoiced by month": a small square and the company's short name. */
export function BarKey({ items }: { items: { name: string; color: ColorName }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {items.map((k, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colors[k.color] }} />
          <Text size={12.5} color="muted">{k.name}</Text>
        </View>
      ))}
    </View>
  );
}

/** `.gp-mb`: the month, a stacked bar (each company a part of the track) and the month's total. */
export function StackRow({ month, parts, total, label }: { month: string; parts: { width: number; color: ColorName }[]; total: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text size={12.5} color="muted" style={{ width: 34 }}>{month}</Text>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flex: 1, flexDirection: "row", gap: 2, height: 10, borderRadius: 6, overflow: "hidden", backgroundColor: colors.sunk }}>
        {parts.map((p, i) => <View key={i} style={{ width: `${Math.max(0, Math.min(100, p.width))}%`, backgroundColor: colors[p.color], borderRadius: 6 }} />)}
      </View>
      <View style={{ minWidth: 64, alignItems: "flex-end" }}><Num size={13.5} weight={600}>{total}</Num></View>
    </View>
  );
}

/** A company in the list: an icon, name over a line, the month's invoicing and its margin; it switches the view to that company. */
export function CompanyRow({ icon, tone, name, sub, figure, note, onPress, first }: { icon: IconName; tone: Tone; name: string; sub: string; figure?: string; note?: string; onPress?: () => void; first?: boolean }) {
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 16, minHeight: 44 }}>
      <View style={{ width: 28, height: 28, flexShrink: 0 }}><Icon name={icon} tone={tone} size={28} /></View>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
      </View>
      {figure || note ? (
        <View style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          {figure ? <Num size={14.5} weight={600}>{figure}</Num> : null}
          {note ? <Text size={12.5} color="muted">{note}</Text> : null}
        </View>
      ) : null}
    </View>
  );
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      {onPress ? <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={[name, sub, figure, note].filter(Boolean).join(", ")}>{body}</Press> : <View accessible accessibilityLabel={[name, sub, figure, note].filter(Boolean).join(", ")}>{body}</View>}
    </View>
  );
}

/** "Add a company": a plus in a 30 square, a 600 label in violet over a line. */
export function AddRow({ label, sub, onPress }: { label: string; sub: string; onPress: () => void }) {
  return (
    <View>
      <Hairline inset={0} />
      <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ${sub}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 16, minHeight: 44 }}>
        <View style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}><Glyph name="plus" size={18} color="acc-t" weight={2.2} /></View>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={600} color="acc-t">{label}</Text>
          <Text size={12.5} color="muted">{sub}</Text>
        </View>
      </Press>
    </View>
  );
}

/** A row of the Shared card: a 26 icon, title over a line, and a switch or a chevron. */
export function SharedRow({ icon, tone, title, sub, trailing, onPress, first }: { icon: IconName; tone: Tone; title: string; sub: string; trailing?: ReactNode; onPress?: () => void; first?: boolean }) {
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
      <View style={{ width: 26, height: 26, flexShrink: 0 }}><Icon name={icon} tone={tone} size={26} /></View>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500}>{title}</Text>
        <Text size={12.5} color="muted">{sub}</Text>
      </View>
      {trailing ?? (onPress ? <Glyph name="chevron" size={15} color="faint" /> : null)}
    </View>
  );
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      {onPress ? <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${sub}`}>{body}</Press> : body}
    </View>
  );
}

/** A person on more than one crew: the initials, name over the hours at each company, the hours together and whether they are over the limit. */
export function CrewRow({ initials, tint, name, sub, hours, status, tone, shape, first }: { initials: string; tint: AvatarTint; name: string; sub: string; hours: string; status?: string; tone?: StatusTone; shape?: StatusShape; first?: boolean }) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <View accessible accessibilityLabel={[name, sub, hours, status].filter(Boolean).join(", ")} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
        <Avatar initials={initials} tint={tint} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <Num size={14.5} weight={600}>{hours}</Num>
          {status && tone ? <Status tone={tone} shape={shape}>{status}</Status> : null}
        </View>
      </View>
    </View>
  );
}

/** "Dev Patel and D. Patel look like the same person" with a Link button, on the soft ground under the crew rows. */
export function DuplicateRow({ a, b, text, linkLabel, onLink, busy }: { a: string; b: string; text: (a: string, b: string) => string; linkLabel: string; onLink: () => void; busy?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.soft, flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 14, paddingHorizontal: 16 }}>
      <View style={{ width: 28, height: 28, flexShrink: 0 }}><Icon name="link" tone="azure" size={28} /></View>
      <Text size={13.5} leading={1.4} style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>{text(a, b)}</Text>
      <Button size="sm" kind="secondary" label={linkLabel} busy={busy ? linkLabel : false} onPress={onLink} />
    </View>
  );
}

/** The green line once two records are linked. */
export function LinkedLine({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.line, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16 }}>
      <Icon name="check" tone="sage" size={22} />
      <Text size={13.5} color="ok" style={{ flexShrink: 1 }}>{text}</Text>
    </View>
  );
}

/** The locked card's list of what the group gives: a 26 icon and a 14.5 line, 9 apart. */
export function FeatureRow({ icon, tone, label }: { icon: IconName; tone: Tone; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, minHeight: 44 }}>
      <View style={{ width: 26, height: 26, flexShrink: 0 }}><Icon name={icon} tone={tone} size={26} /></View>
      <Text size={14.5} style={{ flexShrink: 1 }}>{label}</Text>
    </View>
  );
}

/** The locked card's head: the icon, a 21/600 title and a 13.5 muted line under it, centred. */
export function LockedHero({ title, body, tag }: { title: string; body: string; tag: ReactNode }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Icon name="tier4" tone="violet" size={44} />
      <Text size={21} weight={600} tracking={-0.03} align="center" accessibilityRole="header" style={{ marginTop: 14 }}>{title}</Text>
      <Text size={13.5} color="muted" leading={1.45} align="center" style={{ marginTop: 6, maxWidth: 280 }}>{body}</Text>
      <View style={{ marginTop: 14 }}>{tag}</View>
    </View>
  );
}

/** A line of 13.5 muted words in a sheet, inset to line up with the sheet's title. */
export function SheetNote({ children }: { children: string }) {
  return <Text size={13.5} color="muted" leading={1.45} style={{ paddingHorizontal: 4 }}>{children}</Text>;
}
