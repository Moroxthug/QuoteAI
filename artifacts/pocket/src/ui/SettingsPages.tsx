// The blocks that are particular to one Settings board: the logo card and the brand swatches with their document preview (SetCompany), the tax summary
// (SetTaxes), the follow-up steps with their message (SetQuotes), the next-invoice card and the reminder timeline (SetInvoices). Sizes are the boards' own.
import type { ReactNode } from "react";
import { TextInput, View } from "react-native";
import { board } from "@/theme/board";
import { AuthImage } from "./AuthImage";
import { Button } from "./Button";
import { Card } from "./Card";
import { inputText, noOutline, usePlaceholder } from "./Field";
import { Press } from "./motion";
import { Status, Tag, type StatusShape, type StatusTone } from "./Status";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

/** `.set-h1` and `.set-lede`: the page's title (28/600) and the line under it. */
export function SetTitle({ title, lede }: { title: string; lede?: string }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
      <Text size={28} weight={600} tracking={-0.04} leading={1.12} accessibilityRole="header">{title}</Text>
      {lede ? <Text size={13.5} color="muted" leading={1.4} style={{ marginTop: 6 }}>{lede}</Text> : null}
    </View>
  );
}

/** SetCompany's first card: the logo (or its initials on the brand colour), the name and what a logo should be, and Change. */
export function LogoCard({ initials, colour, name, hint, change, onChange, disabled, logoUri }: { initials: string; colour: string; name: string; hint: string; change: string; onChange: () => void; disabled?: boolean; logoUri?: string }) {
  return (
    <Card padded>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colour, flexShrink: 0, overflow: "hidden" }}>
          {logoUri ? <AuthImage uri={logoUri} style={{ width: 64, height: 64 }} fallback={<Text size={21} weight={600} tracking={-0.03} tint={board.white}>{initials}</Text>} /> : <Text size={21} weight={600} tracking={-0.03} tint={board.white}>{initials}</Text>}
        </View>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={16} weight={600} numberOfLines={1}>{name}</Text>
          <Text size={12.5} color="muted">{hint}</Text>
        </View>
        <Button size="sm" kind="secondary" label={change} onPress={onChange} disabled={disabled} />
      </View>
    </Card>
  );
}

/** The chosen colour as a hex, small and muted, on the right of the Brand colour row. */
export function BrandHex({ colour }: { colour: string }) {
  return <Num size={12.5} weight={400} color="muted">{colour}</Num>;
}

/** The brand colour swatches (34 round, the chosen one ringed and 4 % larger). */
export function Swatches({ colours, value, onChange, label, names, disabled }: { colours: { key: string; hex: string }[]; value: string; onChange: (key: string) => void; label: string; names: Record<string, string>; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 16 }}>
      {colours.map((c) => {
        const on = c.key === value;
        return (
          <Press key={c.key} onPress={() => onChange(c.key)} disabled={disabled} accessibilityRole="radio" accessibilityLabel={names[c.key] ?? c.key} accessibilityState={{ checked: on, disabled: !!disabled }} hitSlop={5}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.hex, transform: [{ scale: on ? 1.04 : 1 }], boxShadow: on ? `0 0 0 2px ${colors.card}, 0 0 0 4px ${c.hex}` : `0 0 0 1px ${colors.line2}`, opacity: disabled ? 0.55 : 1 }} />
        );
      })}
    </View>
  );
}

/** The miniature quote under the swatches: a bar and a mark in the colour, the company, "Quote" and a number, two lines, the tax line and the button. */
export function QuotePreview({ colour, initials, name, site, word, number, taxLine, accept }: { colour: string; initials: string; name: string; site: string; word: string; number: string; taxLine: string; accept: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderRadius: 14, overflow: "hidden", backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.line2}`, marginBottom: 16 }}>
      <View style={{ height: 4, backgroundColor: colour }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colour }}><Text size={11.5} weight={600} tint={board.white}>{initials}</Text></View>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 1 }}>
          <Text size={13.5} weight={600} numberOfLines={1}>{name}</Text>
          <Text size={11.5} color="muted" numberOfLines={1}>{site}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 1 }}>
          <Text size={12.5} weight={600} tint={colour}>{word}</Text>
          <Num size={11.5} weight={500} color="muted">{number}</Num>
        </View>
      </View>
      <View style={{ gap: 6, paddingHorizontal: 14, paddingBottom: 14 }}>
        <View style={{ height: 6, width: "72%", borderRadius: 3, backgroundColor: colors.sunk }} />
        <View style={{ height: 6, width: "54%", borderRadius: 3, backgroundColor: colors.sunk }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <Text size={11.5} color="muted">{taxLine}</Text>
          <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colour }}><Text size={11.5} weight={600} tint={board.white}>{accept}</Text></View>
        </View>
      </View>
    </View>
  );
}

/** SetTaxes' first card: the province, its total rate with the tax's name, and the federal and provincial parts under it. */
export function TaxCard({ province, rate, tag, parts }: { province: string; rate: string; tag: string; parts: { label: string; value: string }[] }) {
  const { colors } = useTheme();
  return (
    <Card padded>
      <Text size={12.5} color="muted">{province}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 4 }}>
        <Num size={32} weight={600} tracking={-0.04} leading={1}>{rate}</Num>
        <Tag accent>{tag}</Tag>
      </View>
      {parts.length ? (
        <View style={{ flexDirection: "row", marginTop: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
          {parts.map((p, i) => (
            <View key={p.label} style={{ flex: 1, gap: 2, paddingTop: 12, paddingLeft: i ? 14 : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.line }}>
              <Text size={11.5} color="muted">{p.label}</Text>
              <Num size={15} weight={600}>{p.value}</Num>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** SetInvoices' first card: the next invoice number, and the default terms in a tag. */
export function NextInvoiceCard({ label, number, tag, tagNote }: { label: string; number: string; tag: string; tagNote: string }) {
  return (
    <Card padded>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 3 }}>
          <Text size={12.5} color="muted">{label}</Text>
          <Num size={24} weight={600} tracking={-0.02}>{number}</Num>
        </View>
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          <Tag>{tag}</Tag>
          <Text size={11.5} color="muted">{tagNote}</Text>
        </View>
      </View>
    </Card>
  );
}

/** SetInvoices' reminder timeline: three marks (3 days before, the due date, 7 days after) filled when that reminder is on. */
export function ReminderTimeline({ marks }: { marks: { label: string; on: boolean }[] }) {
  const { colors } = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 6 }}>
      <View style={{ height: 14, justifyContent: "center" }}>
        <View style={{ position: "absolute", left: 7, right: 7, height: 2, borderRadius: 1, backgroundColor: colors.line2 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {marks.map((m) => (
            <View key={m.label} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: m.on ? colors.acc : colors.card, boxShadow: m.on ? undefined : `inset 0 0 0 2px ${colors.line2}` }} />
          ))}
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        {marks.map((m) => <Text key={m.label} size={11.5} color={m.on ? "ink" : "faint"}>{m.label}</Text>)}
      </View>
    </View>
  );
}

/** SetQuotes' follow-up steps: three tabs ("Day 2" over its name, with a dot green when it sends) and the message under them in a speech-bubble field. */
export function FollowupSteps({ steps, active, onPick, label }: { steps: { day: string; name: string; on: boolean }[]; active: number; onPick: (i: number) => void; label: string }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: "row", gap: 8 }}>
      {steps.map((s, i) => {
        const sel = i === active;
        return (
          <Press key={s.day} onPress={() => onPick(i)} accessibilityRole="tab" accessibilityState={{ selected: sel }}
            style={{ flex: 1, minWidth: 0, borderRadius: 16, paddingTop: 10, paddingHorizontal: 10, paddingBottom: 11, gap: 3, backgroundColor: sel ? colors.card : colors.sunk, boxShadow: sel ? `0 0 0 2px ${colors.ink}` : undefined }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Num size={17} weight={600} tracking={-0.02}>{s.day}</Num>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.on ? colors["ok-dot"] : colors.line2 }} />
            </View>
            <Text size={12.5} color="muted" numberOfLines={1}>{s.name}</Text>
          </Press>
        );
      })}
    </View>
  );
}

/** The message of a follow-up: when it goes and by what, then the text in a `sunk` bubble (radius 18 18 18 6), and a line with the test button. */
export function MessageBubble({ when, via, label, value, onChange, hint, test, onTest, disabled }: {
  when: string; via: string; label: string; value: string; onChange: (v: string) => void; hint: string; test: string; onTest: () => void; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const placeholder = usePlaceholder();
  return (
    <View style={{ marginTop: 14, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text size={12.5} color="muted" style={{ flexShrink: 1 }}>{when}</Text>
        <Tag>{via}</Tag>
      </View>
      <TextInput value={value} onChangeText={onChange} multiline editable={!disabled} accessibilityLabel={label} placeholderTextColor={placeholder} textAlignVertical="top"
        style={[inputText(colors, {}), { minHeight: 4 * 21 + 24, lineHeight: 21, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.sunk, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18, borderBottomLeftRadius: 6 }, noOutline]} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 14 }}>
        <Text size={12.5} color="faint" style={{ flexShrink: 1 }}>{hint}</Text>
        <Button size="sm" kind="secondary" label={test} onPress={onTest} disabled={disabled} />
      </View>
    </View>
  );
}

/** SetQuotes' "Terms and exclusions": a long text in a card, and what it is under it. */
export function TermsField({ label, value, onChange, onBlur, disabled }: { label: string; value: string; onChange: (v: string) => void; onBlur: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const placeholder = usePlaceholder();
  return (
    <View style={{ padding: 16 }}>
      <TextInput value={value} onChangeText={onChange} onBlur={onBlur} multiline editable={!disabled} accessibilityLabel={label} placeholderTextColor={placeholder} textAlignVertical="top"
        style={[inputText(colors, {}), { minHeight: 8 * 21, lineHeight: 21, padding: 0 }, noOutline]} />
    </View>
  );
}

/** A status pill in a row's control slot. */
export function RowStatus({ tone, shape, children }: { tone: StatusTone; shape?: StatusShape; children: string }) {
  return <View style={{ alignSelf: "center", flexShrink: 0 }}><Status tone={tone} shape={shape}>{children}</Status></View>;
}

export function InlineBanner({ children }: { children: ReactNode }) {
  return <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>{children}</View>;
}
