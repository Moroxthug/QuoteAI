// Suppliers and Supplier: the empty state with two buttons, a sheet body that scrolls when it is taller than the phone, and the supplier form.
import type { ReactNode } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { board } from "@/theme/board";
import { tokens } from "@/theme/tokens";
import { Button } from "./Button";
import { Card, Hairline } from "./Card";
import { Chip, ChipWrap } from "./Chip";
import { TextField } from "./Field";
import { Icon, type IconName, type Tone } from "./Icon";
import { KeyCell, Spark, TwoCols } from "./Materials";
import { Press } from "./motion";
import { SheetTitle } from "./Sheet";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";
import { KNOWN_CATEGORIES, type SupplierForm } from "@/lib/suppliers";

/** `.empty` with two buttons (the boards' "Add a supplier" and "Find them in my receipts"): the icon, a 16/600 title, a 13.5 muted line, a primary and a secondary 44 tall button. */
export function EmptyTwo({ icon, tone, title, body, primary, onPrimary, secondary, onSecondary }: {
  icon: IconName; tone: Tone; title: string; body: string; primary?: string; onPrimary?: () => void; secondary?: string; onSecondary?: () => void;
}) {
  return (
    <View style={{ alignItems: "center", gap: 8, paddingTop: 44, paddingBottom: 36, paddingHorizontal: 28 }}>
      <Icon name={icon} tone={tone} size={44} />
      <Text size={16} weight={600} align="center" accessibilityRole="header" style={{ marginTop: 6 }}>{title}</Text>
      <Text size={13.5} color="muted" leading={1.45} align="center" style={{ maxWidth: 260 }}>{body}</Text>
      {primary ? <View style={{ marginTop: 10, alignSelf: "stretch", alignItems: "center" }}><Button label={primary} size="md" onPress={onPrimary} /></View> : null}
      {secondary ? <View style={{ marginTop: 2, alignSelf: "stretch", alignItems: "center" }}><Button label={secondary} kind="secondary" size="md" onPress={onSecondary} /></View> : null}
    </View>
  );
}

/** A sheet's body that scrolls when it is taller than most of the phone (a long form); the sheet itself grows to its content. */
export function SheetScroll({ children }: { children: ReactNode }) {
  const { height } = useWindowDimensions();
  return <ScrollView style={{ maxHeight: Math.round(height * 0.72) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

type T = (key: string) => string;

/** The form that adds a supplier or edits one: how you pay, what they sell, the rep, the account and the notes. */
export function SupplierFormSheet({ t, title, form, onChange, canSave, saving, onSave, saveLabel, categoryLabels }: {
  t: T; title: string; form: SupplierForm; onChange: (f: SupplierForm) => void; canSave: boolean; saving: boolean; onSave: () => void; saveLabel: string; categoryLabels: Record<string, string>;
}) {
  const set = <K extends keyof SupplierForm>(k: K, v: SupplierForm[K]) => onChange({ ...form, [k]: v });
  const field = (k: Exclude<keyof SupplierForm, "kind">, label: string, o: { ph?: string; numeric?: boolean; keyboard?: "phone-pad" | "email-address" | "decimal-pad"; multiline?: boolean } = {}) => (
    <TextField label={label} value={form[k]} onChangeText={(v) => set(k, v)} placeholder={o.ph} numeric={o.numeric} keyboardType={o.keyboard} multiline={o.multiline} maxHeight={o.multiline ? 160 : undefined}
      autoCapitalize={o.keyboard === "email-address" ? "none" : undefined} autoCorrect={false} />
  );
  return (
    <>
      <SheetTitle>{title}</SheetTitle>
      <SheetScroll>
        <View style={{ paddingBottom: 20, gap: 14 }}>
          <View style={{ paddingHorizontal: 16 }}>{field("name", t("name"))}</View>
          <View style={{ gap: 8 }}>
            <View style={{ paddingHorizontal: 20 }}><Text size={12.5} color="muted">{t("kind")}</Text></View>
            <ChipWrap>
              <Chip label={t("kindAccount")} selected={form.kind === "account"} onPress={() => set("kind", "account")} />
              <Chip label={t("kindCounter")} selected={form.kind === "counter"} onPress={() => set("kind", "counter")} />
            </ChipWrap>
          </View>
          <View style={{ gap: 8 }}>
            <View style={{ paddingHorizontal: 20 }}><Text size={12.5} color="muted">{t("category")}</Text></View>
            <ChipWrap>
              {KNOWN_CATEGORIES.map((k) => <Chip key={k} label={categoryLabels[k] ?? k} selected={form.category.trim().toLowerCase() === k} onPress={() => set("category", form.category.trim().toLowerCase() === k ? "" : k)} />)}
            </ChipWrap>
            <View style={{ paddingHorizontal: 16 }}>{field("category", t("categoryOther"), { ph: t("categoryPh") })}</View>
          </View>
          <View style={{ paddingHorizontal: 16 }}><TwoCols>{[field("repName", t("repName")), field("repRole", t("repRole"))]}</TwoCols></View>
          <View style={{ paddingHorizontal: 16 }}>{field("phone", t("phone"), { keyboard: "phone-pad", numeric: true })}</View>
          <View style={{ paddingHorizontal: 16 }}>{field("email", t("email"), { keyboard: "email-address" })}</View>
          <View style={{ paddingHorizontal: 16 }}>{field("accountNo", t("accountNo"), { numeric: true })}</View>
          <View style={{ paddingHorizontal: 16 }}><TwoCols>{[field("terms", t("terms"), { ph: t("termsPh") }), field("proDiscount", t("discount"), { keyboard: "decimal-pad", numeric: true })]}</TwoCols></View>
          <View style={{ paddingHorizontal: 16 }}>{field("address", t("address"))}</View>
          <View style={{ paddingHorizontal: 16 }}>{field("delivers", t("delivers"), { ph: t("deliversPh") })}</View>
          <View style={{ paddingHorizontal: 16 }}>{field("hours", t("hours"))}</View>
          <View style={{ paddingHorizontal: 16 }}>{field("notes", t("notes"), { multiline: true })}</View>
        </View>
      </SheetScroll>
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 }}>
        <Button size="lg" block label={saveLabel} disabled={!canSave} busy={saving ? t("saving") : false} onPress={onSave} />
      </View>
    </>
  );
}


// ── Supplier ──────────────────────────────────────────────────────────────────

/** The account card (`Account and terms`): a figure with its caption (the cents smaller, faint), then the three cells under a hairline. */
export function AccountCard({ caption, whole, cents, cells }: { caption: string; whole: string; cents: string; cells: { label: string; value: string }[] }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14, gap: 5 }}>
        <Text size={12.5} color="muted">{caption}</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Num size={32} weight={600} tracking={-0.04} leading={1}>{whole}</Num>
          {cents ? <Num size={19} weight={600} color="faint" tracking={-0.01}>{cents}</Num> : null}
        </View>
      </View>
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line }}>
        {cells.map((c, i) => <KeyCell key={i} label={c.label} value={c.value} first={i === 0} />)}
      </View>
    </Card>
  );
}

/** A price-history row: the item and "from → to", the sparkline, and the change over when it changed. */
export function PriceHistoryRow({ name, from, to, spark, sparkColor, delta, when, first }: {
  name: string; from: string; to: string; spark: number[]; sparkColor: ColorName; delta: string; when: string; first?: boolean;
}) {
  return (
    <View>
      {first ? null : <Hairline inset={0} />}
      <View accessible accessibilityLabel={`${name}, ${from} → ${to}, ${delta}, ${when}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 16, minHeight: 44 }}>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
          <Text size={12.5} color="muted" numberOfLines={1}><Num size={12.5} color="muted">{from}</Num> → <Num size={12.5} color="ink">{to}</Num></Text>
        </View>
        <Spark points={spark} color={sparkColor} />
        <View style={{ alignItems: "flex-end", gap: 4, minWidth: 58, flexShrink: 0 }}>
          <Num size={13.5} weight={600} color={sparkColor}>{delta}</Num>
          <Text size={11.5} color="muted">{when}</Text>
        </View>
      </View>
    </View>
  );
}

/** The warn banner with its two buttons: the icon and the message, then "Update to $19.95" and "See quotes". */
export function NudgeBanner({ lead, body, primary, onPrimary, secondary, onSecondary, busy }: {
  lead: string; body: string; primary: string; onPrimary: () => void; secondary?: string; onSecondary?: () => void; busy?: string | false;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ borderRadius: tokens.radius.banner, backgroundColor: board.warnSoft, paddingVertical: 12, paddingHorizontal: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 11 }}>
        <Icon name="warn" tone="amber" size={24} />
        <Text size={13.5} leading={1.4} color="warn" style={{ flexShrink: 1, flexGrow: 1 }}>
          <Text size={13.5} leading={1.4} weight={600} color="warn">{lead}</Text>
          {` ${body}`}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button size="sm" label={primary} busy={busy} onPress={onPrimary} />
        {secondary ? (
          <Press onPress={onSecondary} accessibilityRole="link" accessibilityLabel={secondary} hitSlop={{ top: 4, bottom: 4 }}
            style={{ height: tokens.size.buttonSm, paddingHorizontal: 12, borderRadius: tokens.radius.buttonSm, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}>
            <Text size={13.5} weight={600}>{secondary}</Text>
          </Press>
        ) : null}
      </View>
    </View>
  );
}
