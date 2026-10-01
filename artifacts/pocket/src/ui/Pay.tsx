// Pay.dc.html: the period stepper with its status and export button, the rows of what needs a look, the four totals, an employee's pay (head, lines, flag),
// a travel claim, a job's labour cost, and the rows of the rules tab. Sizes are the board's own.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Avatar, type AvatarTint } from "./Avatar";
import { Card, Hairline } from "./Card";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Progress } from "./Numbers";
import { Status, type StatusShape, type StatusTone } from "./Status";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

/** The period card: a 44 arrow each side of the dates (30 % when it can't go that way), the status under them, then whatever the screen puts below (the export button). */
export function PeriodCard({ label, sub, prevLabel, nextLabel, canPrev, canNext, onPrev, onNext, status, children }: {
  label: string; sub: string; prevLabel: string; nextLabel: string; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void;
  status: { tone: StatusTone; shape: StatusShape; label: string }; children?: ReactNode;
}) {
  return (
    <Card style={{ paddingTop: 8, paddingHorizontal: 8, paddingBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Press onPress={onPrev} disabled={!canPrev} accessibilityRole="button" accessibilityLabel={prevLabel} accessibilityState={{ disabled: !canPrev }}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: canPrev ? 1 : 0.3 }}>
          <Glyph name="back" size={18} />
        </Press>
        <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
          <Num size={17} weight={600} tracking={-0.02} align="center">{label}</Num>
          <Text size={12.5} color="muted" align="center">{sub}</Text>
        </View>
        <Press onPress={onNext} disabled={!canNext} accessibilityRole="button" accessibilityLabel={nextLabel} accessibilityState={{ disabled: !canNext }}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: canNext ? 1 : 0.3 }}>
          <Glyph name="chevron" size={18} />
        </Press>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 6 }}><Status tone={status.tone} shape={status.shape}>{status.label}</Status></View>
      {children ? <View style={{ marginTop: 14, marginHorizontal: 8 }}>{children}</View> : null}
    </Card>
  );
}

/** A row with a 26 gradient icon, a title and a line under it, and a status tag; pressable when it goes somewhere. */
export function NoteRow({ icon, tone, title, sub, tag, onPress }: { icon: IconName; tone: Tone; title: string; sub: string; tag: { tone: StatusTone; shape?: StatusShape; label: string }; onPress?: () => void }) {
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingVertical: 12, paddingHorizontal: 16 }}>
      <Icon name={icon} tone={tone} size={26} />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500}>{title}</Text>
        <Text size={12.5} color="muted">{sub}</Text>
      </View>
      <Status tone={tag.tone} shape={tag.shape}>{tag.label}</Status>
    </View>
  );
  return onPress ? <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${tag.label}`}>{body}</Press> : body;
}

export type Quad = { label: string; value: string; sub: string };
/** The four totals in one card, two by two with hairlines between. */
export function TotalsCard({ items }: { items: Quad[] }) {
  const { colors } = useTheme();
  const rows = [items.slice(0, 2), items.slice(2, 4)];
  return (
    <Card>
      {rows.map((row, r) => (
        <View key={r}>
          {r > 0 ? <Hairline inset={0} /> : null}
          <View style={{ flexDirection: "row" }}>
            {row.map((k, c) => (
              <View key={k.label} accessible accessibilityLabel={`${k.label}, ${k.value}, ${k.sub}`} style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 14, paddingHorizontal: 16, borderLeftWidth: c > 0 ? 1 : 0, borderLeftColor: colors.line }}>
                <Text size={12.5} color="muted">{k.label}</Text>
                <Num size={19} weight={600} tracking={-0.03}>{k.value}</Num>
                <Text size={11.5} color="muted">{k.sub}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </Card>
  );
}

/** The labour tab's two figures in one card, side by side (the board's .kpis). */
export function KpiPair({ items }: { items: Quad[] }) {
  const { colors } = useTheme();
  return (
    <Card style={{ flexDirection: "row" }}>
      {items.map((k, i) => (
        <View key={k.label} accessible accessibilityLabel={`${k.label}, ${k.value}, ${k.sub}`} style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 14, paddingHorizontal: 16, borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: colors.line }}>
          <Text size={12.5} color="muted">{k.label}</Text>
          <Num size={19} weight={600} tracking={-0.03}>{k.value}</Num>
          <Text size={11.5} color="muted">{k.sub}</Text>
        </View>
      ))}
    </Card>
  );
}

export type EmployeeLine = { key: string; label: string; qty: string; amount: string };
export function EmployeeCard({ initials, tint, name, role, gross, hours, lines, flag }: {
  initials: string; tint: AvatarTint; name: string; role: string; gross: string; hours: string; lines: EmployeeLine[]; flag?: string;
}) {
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Avatar initials={initials} tint={tint} size={38} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={15} weight={600} numberOfLines={1}>{name}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}>{role}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Num size={17} weight={600} tracking={-0.02}>{gross}</Num>
          <Text size={11.5} color="muted">{hours}</Text>
        </View>
      </View>
      <View style={{ marginHorizontal: 16 }}><Hairline inset={0} /></View>
      <View style={{ marginHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 7 }}>
        {lines.map((l) => (
          <View key={l.key} style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
            <Text size={13.5} color="t2">{l.label}</Text>
            <Text size={11.5} color="faint" numberOfLines={1} style={{ flexGrow: 1, flexShrink: 1 }}>{l.qty}</Text>
            <Num size={13.5} weight={500}>{l.amount}</Num>
          </View>
        ))}
      </View>
      {flag ? <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}><Status tone="warn">{flag}</Status></View> : null}
    </Card>
  );
}

/** A claim: who and what, the detail, Approve and Reject while it waits, the amount and its status on the right. */
export function ClaimRow({ initials, tint, title, sub, amount, status, actions }: {
  initials: string; tint: AvatarTint; title: string; sub: string; amount: string; status: { tone: StatusTone; shape?: StatusShape; label: string }; actions?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 44, paddingVertical: 14, paddingHorizontal: 16 }}>
      <Avatar initials={initials} tint={tint} size={38} />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500}>{title}</Text>
        <Text size={12.5} color="muted">{sub}</Text>
        {actions ? <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>{actions}</View> : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <Num size={14.5} weight={600}>{amount}</Num>
        <Status tone={status.tone} shape={status.shape}>{status.label}</Status>
      </View>
    </View>
  );
}

export function JobCard({ icon, tone, name, client, cost, share, cells }: { icon: IconName; tone: Tone; name: string; client: string; cost: string; share: number; cells: { label: string; value: string }[] }) {
  return (
    <Card style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <Icon name={icon} tone={tone} size={28} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={15} weight={600}>{name}</Text>
          <Text size={12.5} color="muted">{client}</Text>
        </View>
        <Num size={17} weight={600} tracking={-0.02}>{cost}</Num>
      </View>
      <View style={{ marginTop: 12 }}><Progress value={share} fill="inv" label={`${name}, ${cost}`} /></View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12, rowGap: 10 }}>
        {cells.map((c) => (
          <View key={c.label} style={{ width: "33.33%", paddingRight: 8, gap: 1 }}>
            <Text size={11.5} color="muted">{c.label}</Text>
            <Num size={13.5} weight={600}>{c.value}</Num>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** A rules row that opens a sheet: a 26 icon, a title and line, the value, a chevron. */
export function ValueRow({ icon, tone, title, sub, value, tag, onPress }: { icon: IconName; tone: Tone; title: string; sub: string; value?: string; tag?: { tone: StatusTone; label: string }; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={[title, value, sub].filter(Boolean).join(", ")}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingVertical: 12, paddingHorizontal: 16 }}>
        <Icon name={icon} tone={tone} size={26} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500}>{title}</Text>
          <Text size={12.5} color="muted">{sub}</Text>
        </View>
        {value ? <Num size={14.5} weight={500} color="t2" style={{ flexShrink: 0 }}>{value}</Num> : null}
        {tag ? <Status tone={tag.tone}>{tag.label}</Status> : null}
        <Glyph name="chevron" size={15} color="faint" />
      </View>
    </Press>
  );
}

/** The overtime facts: a label and a value on one line (min 24 tall inside the row's padding). */
export function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44, paddingVertical: 12, paddingHorizontal: 16 }}>
      <Text size={14.5} weight={500} style={{ flexShrink: 1 }}>{label}</Text>
      <Num size={14.5} weight={500} style={{ flexShrink: 1 }} align="right">{value}</Num>
    </View>
  );
}

/** A row of the export sheet (the board's dropdown): a 24 icon, the name and what it is, and "Last used". */
export function PickRowTarget({ icon, tone, title, sub, tag, onPress }: { icon: IconName; tone: Tone; title: string; sub: string; tag?: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="menuitem" accessibilityLabel={[title, sub, tag].filter(Boolean).join(", ")}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingVertical: 12, paddingHorizontal: 16 }}>
        <Icon name={icon} tone={tone} size={24} />
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500}>{title}</Text>
          <Text size={12.5} color="muted">{sub}</Text>
        </View>
        {tag ? <Status tone="mute">{tag}</Status> : null}
      </View>
    </Press>
  );
}
