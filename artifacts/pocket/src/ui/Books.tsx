// Books.dc.html: the month card (name, open and done, the ticks, the close button), the checklist rows and the bank-line rows.
// Sizes are the board's own (.lrow with a 32 round badge, .btn-sm 36 tall, the 56 inset under a bank line's date).
import type { ReactNode } from "react";
import { View } from "react-native";
import { board } from "@/theme/board";
import { tokens } from "@/theme/tokens";
import { Button } from "./Button";
import { Card } from "./Card";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Status, type StatusShape, type StatusTone } from "./Status";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

/** A small button as the board's .btn-sm: 36 tall (44 to the finger), radius 11, 13.5/600. */
export function MiniButton({ label, variant = "secondary", onPress, disabled, accessibilityLabel }: { label: string; variant?: "accent" | "secondary" | "ghost" | "muted"; onPress?: () => void; disabled?: boolean; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const bg = variant === "accent" ? colors["acc-soft"] : variant === "secondary" || variant === "muted" ? colors.sunk : "transparent";
  const fg = variant === "accent" ? "acc-soft-t" : variant === "ghost" || variant === "muted" ? "muted" : "ink";
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} hitSlop={{ top: 4, bottom: 4 }}
      style={{ height: tokens.size.buttonSm, minWidth: 44, paddingHorizontal: variant === "ghost" ? 8 : 12, borderRadius: tokens.radius.buttonSm, backgroundColor: bg, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}>
      <Text size={13.5} weight={600} color={fg} numberOfLines={1}>{label}</Text>
    </Press>
  );
}

export function MonthCard({ title, line, status, ticks, button, note }: {
  title: string; line: ReactNode; status: { tone: StatusTone; shape: StatusShape; label: string };
  /** One 6-tall bar per checklist item: green when done, `sunk` when open. */
  ticks: boolean[];
  button: ReactNode; note: string;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <Text size={24} weight={600} tracking={-0.035} leading={1.1}>{title}</Text>
          {line}
        </View>
        <Status tone={status.tone} shape={status.shape}>{status.label}</Status>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", gap: 4, marginTop: 16 }}>
        {ticks.map((done, i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: done ? colors["ok-dot"] : colors.sunk }} />)}
      </View>
      <View style={{ marginTop: 16 }}>{button}</View>
      <Text size={12.5} color="muted" align="center" style={{ marginTop: 10 }}>{note}</Text>
    </Card>
  );
}

/** The close button once the month is closed: `ok-soft` with the green word, full width. */
export function ClosedButton({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label}
      style={{ height: tokens.size.button, borderRadius: tokens.radius.button, backgroundColor: colors["ok-soft"], alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }}>
      <Text size={15} weight={600} color="ok" numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** The full-width close button: inverted fill, 40 % while items are open. */
export function CloseButton({ label, disabled, busy, onPress }: { label: string; disabled: boolean; busy?: string | false; onPress: () => void }) {
  return <Button block label={label} disabled={disabled} busy={busy} onPress={onPress} />;
}

export type CheckLook = "open" | "done" | "na";

export function ChecklistRow({ look, count, title, sub, naText, undoText, naLabel, openLabel, onNa, onUndo, onOpen }: {
  look: CheckLook; count: number; title: string; sub: string; naText: string; undoText: string; naLabel: string; openLabel: string;
  onNa: () => void; onUndo: () => void; onOpen: () => void;
}) {
  const { colors } = useTheme();
  const open = look === "open";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingVertical: 13, paddingHorizontal: 16 }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={{ width: 32, height: 32, borderRadius: 16, flexShrink: 0, alignItems: "center", justifyContent: "center", backgroundColor: open ? board.warnSoft : colors["ok-soft"] }}>
        {open ? <Num size={13.5} weight={600} color="warn">{String(count)}</Num> : <Glyph name="check" size={15} weight={2.6} color="ok" />}
      </View>
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} accessibilityLabel={open ? `${title}, ${count}` : title}>{title}</Text>
        <Text size={12.5} color="muted">{sub}</Text>
      </View>
      {open ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <MiniButton label={naText} variant="muted" onPress={onNa} accessibilityLabel={naLabel} />
          <Press onPress={onOpen} accessibilityRole="button" accessibilityLabel={openLabel} style={{ width: 36, height: 36, marginRight: -8, alignItems: "center", justifyContent: "center" }} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
            <Glyph name="chevron" size={15} color="faint" />
          </Press>
        </View>
      ) : look === "na" ? <MiniButton label={undoText} variant="ghost" onPress={onUndo} /> : null}
    </View>
  );
}

export function BankLine({ date, desc, amount, positive, icon, tone, hint, hintMuted, children }: {
  date: string; desc: string; amount: string; positive: boolean; icon: IconName; tone: Tone; hint: string; hintMuted: boolean; children?: ReactNode;
}) {
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
        <View style={{ width: 44, flexShrink: 0 }}><Text size={11.5} color="faint" numberOfLines={1}>{date}</Text></View>
        <Text size={14.5} weight={500} numberOfLines={1} style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>{desc}</Text>
        <Num size={14.5} weight={600} color={positive ? "ok" : "ink"}>{amount}</Num>
      </View>
      <View style={{ marginTop: 8, marginLeft: 56, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name={icon} tone={tone} size={20} />
          <Text size={12.5} color={hintMuted ? "muted" : "t2"} style={{ flexShrink: 1 }}>{hint}</Text>
        </View>
        {children}
      </View>
    </View>
  );
}

export function LineActions({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>{children}</View>;
}
