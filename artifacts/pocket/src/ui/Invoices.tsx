// Pieces of the Invoices list and the Invoice screen (Invoices.dc.html, Invoice.dc.html).
// Outstanding: the label 12.5 muted over the figure Num 30/600 (−0.04em) with the cents 19 in `faint`.
// AgingBar: segments 10 tall (radius 5, gap 3, at least 10 wide), wide as the amount they hold; AgingLegend: two columns, an
//   8 dot (radius 3), the label 12.5 muted and the amount Num 12.5/600 on the right; a bucket at 0 fades to 50 %.
// FootStats: the card's last strip, full width: two cells (padding 13 16) divided by `line`, each a 11.5 label, Num 19/600, a 11.5 line.
// StatusLine: a 6 dot and the status line (12.5 muted); the word is always there, the dot only repeats the colour.
// BalanceCard: Balance 12.5 muted over Num 32/600, the status pill beside it, a 4 paid bar, then Total / Paid / Due in three cells.
// ClaimBanner: the customer's "I sent it" (acc banner): the line, who and when, then Confirm received and Not received.
// QuickGrid: four 84 tall cards (a 26 icon over a 12.5/500 word). InvoiceLines: lines (padding 13 16) and a `soft` totals foot.
// LinkCard: the client's link row with a small button. Timeline: the activity card (a dot and a line down the left).
// AmountField: the payment sheet's 58 tall amount (24/600) with the "Full balance" chip. DangerMenuRow: a menu row in `bad`.
import type { ReactNode } from "react";
import { TextInput, View } from "react-native";
import { tokens } from "@/theme/tokens";
import { Card } from "./Card";
import { Field, inputText, noOutline, usePlaceholder } from "./Field";
import { Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { RowChevron } from "./Row";
import { Progress } from "./Numbers";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

/** A hex colour at `k` of its brightness (the board's `filter: brightness(.78)` on the older aging buckets). */
function shade(color: string, k: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1]!, 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

export function Outstanding({ label, whole, cents, right }: { label: string; whole: string; cents: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
      <View style={{ gap: 4, flexShrink: 1, minWidth: 0 }}>
        <Text size={12.5} color="muted">{label}</Text>
        <Num size={30} weight={600} tracking={-0.04} leading={1} accessibilityLabel={`${whole}${cents}`}>{whole}<Num size={19} weight={600} color="faint" tracking={-0.01}>{cents}</Num></Num>
      </View>
      {right ? <View style={{ marginBottom: 2 }}>{right}</View> : null}
    </View>
  );
}

export type AgingTone = "ok" | "warn" | "bad";
export type AgingSegment = { key: string; amount: number; tone: AgingTone; dim?: number };

function agingColor(tone: AgingTone, dim: number | undefined, colors: ReturnType<typeof useTheme>["colors"]): string {
  const base = tone === "ok" ? colors["ok-dot"] : tone === "warn" ? colors["warn-dot"] : colors.bad;
  return dim ? shade(base, dim) : base;
}

export function AgingBar({ segments, label }: { segments: AgingSegment[]; label: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ flexDirection: "row", gap: 3, height: 10, marginTop: 16 }}>
      {segments.filter((s) => s.amount > 0).map((s) => (
        <View key={s.key} style={{ flexGrow: s.amount, flexShrink: 1, flexBasis: 0, minWidth: 10, height: 10, borderRadius: 5, backgroundColor: agingColor(s.tone, s.dim, colors) }} />
      ))}
    </View>
  );
}

export function AgingLegend({ items }: { items: (AgingSegment & { label: string; value: string })[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 8, marginTop: 14 }}>
      {items.map((s) => (
        <View key={s.key} style={{ flexBasis: "45%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0, opacity: s.amount > 0 ? 1 : 0.5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: agingColor(s.tone, s.dim, colors) }} />
          <Text size={12.5} color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{s.label}</Text>
          <Num size={12.5} weight={600} style={{ marginLeft: "auto" }}>{s.value}</Num>
        </View>
      ))}
    </View>
  );
}

export type FootStat = { label: string; value: string; sub?: string; subTone?: Extract<ColorName, "muted" | "ok"> };

export function FootStats({ items }: { items: FootStat[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line }}>
      {items.map((k, i) => (
        <View key={k.label} accessible accessibilityLabel={[k.label, k.value, k.sub].filter(Boolean).join(", ")}
          style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 13, paddingHorizontal: 16, borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: colors.line }}>
          <Text size={11.5} color="muted">{k.label}</Text>
          <Num size={19} weight={600} tracking={-0.03}>{k.value}</Num>
          {k.sub ? <Text size={11.5} color={k.subTone ?? "muted"}>{k.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function StatusLine({ dot, children }: { dot: ColorName; children: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors[dot] }} />
      <Text size={12.5} color="muted" style={{ flexShrink: 1 }}>{children}</Text>
    </View>
  );
}

export function BalanceCard({ label, whole, cents, status, paidValue, bar, cells }: {
  label: string; whole: string; cents: string; status: ReactNode; paidValue: number; bar: string;
  cells: { label: string; value: string; color?: ColorName }[];
}) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14 }}>
        <View style={{ gap: 5, flexShrink: 1 }}>
          <Text size={12.5} color="muted">{label}</Text>
          <Num size={32} weight={600} tracking={-0.04} leading={1} accessibilityLabel={`${label} ${whole}${cents}`}>{whole}<Num size={19} weight={600} color="faint" tracking={-0.01}>{cents}</Num></Num>
        </View>
        <View style={{ marginBottom: 3 }}>{status}</View>
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}><Progress value={paidValue} fill="ok-dot" label={bar} /></View>
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line }}>
        {cells.map((c, i) => (
          <View key={c.label} accessible accessibilityLabel={`${c.label}, ${c.value}`}
            style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 12, paddingHorizontal: i === 0 ? 16 : 14, borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: colors.line }}>
            <Text size={11.5} color="muted">{c.label}</Text>
            <Num size={15} weight={600} color={c.color}>{c.value}</Num>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function ClaimBanner({ before, amount, by, sub, confirm, deny, onConfirm, onDeny }: {
  before: string; amount: string; by: string; sub: string; confirm: string; deny: string; onConfirm: () => void; onDeny: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="summary" style={{ gap: 12, padding: 14, borderRadius: tokens.radius.banner, backgroundColor: colors["acc-soft"] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 11 }}>
        <Icon name="send" tone="violet" size={26} />
        <View style={{ flexShrink: 1, flexGrow: 1, gap: 2 }}>
          <Text size={13.5} leading={1.4} color="acc-soft-t">{before} <Num size={13.5} weight={600} color="acc-soft-t">{amount}</Num> <Text size={13.5} weight={600} color="acc-soft-t">{by}</Text></Text>
          <Text size={12.5} color="acc-soft-t" opacity={0.8}>{sub}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Press onPress={onConfirm} accessibilityRole="button" style={{ flex: 1, height: tokens.size.buttonSm, borderRadius: tokens.radius.buttonSm, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }} hitSlop={{ top: 4, bottom: 4 }}>
          <Text size={13.5} weight={600} color="on-inv" numberOfLines={1}>{confirm}</Text>
        </Press>
        <Press onPress={onDeny} accessibilityRole="button" style={{ flex: 1, height: tokens.size.buttonSm, borderRadius: tokens.radius.buttonSm, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }} hitSlop={{ top: 4, bottom: 4 }}>
          <Text size={13.5} weight={600} numberOfLines={1}>{deny}</Text>
        </Press>
      </View>
    </View>
  );
}

export type QuickAction = { key: string; label: string; icon: IconName; tone: Tone; onPress: () => void; busy?: boolean };

export function QuickGrid({ items }: { items: QuickAction[] }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {items.map((a) => (
        <Press key={a.key} onPress={a.onPress} disabled={a.busy} accessibilityRole="button" accessibilityLabel={a.label} accessibilityState={{ busy: !!a.busy }} style={{ flex: 1, minWidth: 0 }}>
          <Card style={{ height: 84, alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 4, opacity: a.busy ? 0.6 : 1 }}>
            <Icon name={a.icon} tone={a.tone} size={26} />
            <Text size={12.5} weight={500} numberOfLines={1}>{a.label}</Text>
          </Card>
        </Press>
      ))}
    </View>
  );
}

export type InvoiceLineRow = { key: string; name: string; amount: string; detail?: string };

export function InvoiceLines({ lines, totals, totalLabel, total }: { lines: InvoiceLineRow[]; totals: { label: string; value: string }[]; totalLabel: string; total: string }) {
  const { colors } = useTheme();
  return (
    <Card>
      {lines.map((l, i) => (
        <View key={l.key} style={{ paddingVertical: 13, paddingHorizontal: 16, gap: 4, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.line }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <Text size={14.5} weight={500} style={{ flexShrink: 1 }}>{l.name}</Text>
            <Num size={14.5} weight={500} style={{ flexShrink: 0 }}>{l.amount}</Num>
          </View>
          {l.detail ? <Text size={12.5} color="muted">{l.detail}</Text> : null}
        </View>
      ))}
      <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 7, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.soft }}>
        {totals.map((r) => (
          <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <Text size={13.5} color="muted" style={{ flexShrink: 1 }}>{r.label}</Text>
            <Num size={13.5}>{r.value}</Num>
          </View>
        ))}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingTop: 7, borderTopWidth: 1, borderTopColor: colors.line }}>
          <Text size={13.5} weight={500}>{totalLabel}</Text>
          <Num size={17} weight={600}>{total}</Num>
        </View>
      </View>
    </Card>
  );
}

export function LinkCard({ title, sub, button, onPress }: { title: string; sub: string; button: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 12 }}>
      <Icon name="link" tone="azure" size={26} />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
      </View>
      <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={button} hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
        style={{ height: tokens.size.buttonSm, borderRadius: tokens.radius.buttonSm, paddingHorizontal: 13, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center" }}>
        <Text size={13.5} weight={600}>{button}</Text>
      </Press>
    </Card>
  );
}

export type TimelineEvent = { key: string; text: string; when: string; sub?: string };

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const { colors } = useTheme();
  return (
    <Card padded style={{ paddingBottom: 4 }}>
      {events.map((e, i) => (
        <View key={e.key} style={{ paddingBottom: 16, paddingLeft: 24 }}>
          <View style={{ position: "absolute", left: 3, top: 5, width: 9, height: 9, borderRadius: 5, backgroundColor: i === 0 ? colors.acc : colors.card, borderWidth: i === 0 ? 0 : 1.5, borderColor: colors.line2 }} />
          {i < events.length - 1 ? <View style={{ position: "absolute", left: 7, top: 18, bottom: 2, width: 1, backgroundColor: colors.line2 }} /> : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <Text size={13.5} weight={500} leading={1.35} style={{ flexShrink: 1 }}>{e.text}</Text>
            <Num size={11.5} color="faint" style={{ flexShrink: 0 }}>{e.when}</Num>
          </View>
          {e.sub ? <Text size={12.5} color="muted" style={{ marginTop: 2 }}>{e.sub}</Text> : null}
        </View>
      ))}
    </Card>
  );
}

/** The payment sheet's amount: a `$`, the figure at 24/600 and a "Full balance" chip; the ring turns warn when it is above the balance. */
export function AmountField({ label, value, onChangeText, chip, onChip, over, prefix, error }: { label: string; value: string; onChangeText: (v: string) => void; chip: string; onChip: () => void; over?: boolean; prefix?: string; error?: string }) {
  const { colors } = useTheme();
  const placeholder = usePlaceholder();
  return (
    <Field label={label} error={error}>
      <View style={{ flexDirection: "row", alignItems: "center", height: 58, borderRadius: 15, backgroundColor: colors.card, paddingHorizontal: 14, boxShadow: over ? `0 0 0 1.5px ${colors["warn-dot"]}` : `0 0 0 1px ${colors.line2}` }}>
        {prefix ? <Num size={24} weight={600} color="faint">{prefix}</Num> : null}
        <TextInput value={value} onChangeText={onChangeText} inputMode="decimal" keyboardType="decimal-pad" accessibilityLabel={label} placeholder="0.00" placeholderTextColor={placeholder}
          style={[inputText(colors, { numeric: true, weight: 600 }), { flexGrow: 1, flexShrink: 1, minWidth: 0, height: 56, paddingLeft: 4, paddingVertical: 0, fontSize: 24, letterSpacing: -0.72 }, noOutline]} />
        <Press onPress={onChip} accessibilityRole="button" hitSlop={{ top: 7, bottom: 7 }} style={{ height: 30, paddingHorizontal: 13, borderRadius: 15, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center" }}>
          <Text size={12.5} weight={500}>{chip}</Text>
        </Press>
      </View>
    </Field>
  );
}

/** A menu row (as MenuRow) whose title is in `bad`: the destructive one at the end of a menu. */
export function DangerMenuRow({ icon, title, sub, onPress }: { icon?: ReactNode; title: string; sub?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 60 }}>
      {icon}
      <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
        <Text weight={500} color="bad">{title}</Text>
        {sub ? <Text size={12.5} color="muted" leading={1.35}>{sub}</Text> : null}
      </View>
      <RowChevron />
    </Press>
  );
}

/** The Invoices list's bottom padding (48 on the board). */
export const LIST_BOTTOM = 48;

/** The payment sheet's "Email a receipt" row: a `soft` box with a ring, the title over a line, and the switch. */
export function ToggleRow({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 15, backgroundColor: colors.soft, boxShadow: `0 0 0 1px ${colors.line}` }}>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 1 }}>
        <Text size={14.5} weight={500}>{title}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text>
      </View>
      {children}
    </View>
  );
}

/** The Invoice screen's title: 24/600 (−0.035em, 1.2) and the job line, 13.5 muted, under the status line. */
export function InvoiceTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text size={24} weight={600} tracking={-0.035} leading={1.2} accessibilityRole="header">{title}</Text>
      {sub ? <Text size={13.5} color="muted" style={{ marginTop: 4 }}>{sub}</Text> : null}
    </View>
  );
}

/** The line under a sheet's title (12.5 muted), pulled up under it. */
export function SheetSub({ children }: { children: string }) {
  return <Text size={12.5} color="muted" style={{ marginTop: -8 }}>{children}</Text>;
}

/** A field whose control is a row of chips (the payment method): the 12.5 label over chips that wrap, gap 6. */
export function ChoiceField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 6 }}>
      <Text size={12.5} color="muted" style={{ paddingLeft: 2 }} importantForAccessibility="no">{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{children}</View>
    </View>
  );
}
