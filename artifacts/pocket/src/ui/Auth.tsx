// What the "Getting in" screens share (the boards repeat it): the EN / FR switch in the header,
// the "or" divider, and the scrolling screen body with its 16 / 20 side padding.
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import i18n, { type Lang } from "@/i18n";
import { setRequestLanguage } from "@/lib/session";
import { IconButton } from "./Header";
import { Glyph, Icon, type GlyphName, type IconName, type Tone } from "./Icon";
import { Press } from "./motion";
import { Segmented } from "./Segmented";
import { Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

/** The board's header pill: English / Français, 92 wide. Switches the app's language at once. */
export function LangSwitch({ width = 92 }: { width?: number }) {
  const { t } = useTranslation();
  const index = i18n.language === "fr" ? 1 : 0;
  const pick = (i: number) => {
    const next: Lang = i === 1 ? "fr" : "en";
    setRequestLanguage(next);
    void i18n.changeLanguage(next);
  };
  return (
    <View style={{ width }}>
      <Segmented options={["EN", "FR"]} value={index} onChange={pick} label={t("auth.language")} />
    </View>
  );
}

/** "──── or ────" (.or): 12.5 `faint`, 1 px `line2` rules. */
export function OrDivider({ label }: { label: string }) {
  const { colors } = useTheme();
  const rule = <View style={{ flex: 1, height: 1, backgroundColor: colors.line2 }} />;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {rule}
      <Text size={12.5} color="faint">{label}</Text>
      {rule}
    </View>
  );
}

/** The scrolling body under a header; keeps fields visible above the keyboard. */
export function AuthBody({ children, bottom = 32 }: { children: ReactNode; bottom?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: bottom + insets.bottom }}>
      {children}
    </ScrollView>
  );
}

/** The board's small round link pill under a form ("On a crew? Join your team"): 36 tall, `sunk`, an icon and 13.5/500. */
export function PillLink({ icon, tone = "amber", label, onPress }: { icon: IconName; tone?: Tone; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="link" accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.sunk }}>
      <Icon name={icon} tone={tone} size={20} />
      <Text size={13.5} weight={500}>{label}</Text>
    </Press>
  );
}

/** The sign-in screens' header (.hdr with the language pill instead of a title): back left, EN / FR right. */
export function AuthHeader({ onBack, backLabel, langWidth = 92 }: { onBack?: () => void; backLabel: string; langWidth?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 52 + insets.top, paddingTop: 8 + insets.top, paddingLeft: 8, paddingRight: 12 }}>
      {onBack ? <IconButton glyph="back" label={backLabel} onPress={onBack} /> : <View style={{ width: 44 }} />}
      <LangSwitch width={langWidth} />
    </View>
  );
}

/** An inline text link (Forgot password?, Create an account): the label's own size and weight, a 44 tap area. */
export function TextLink({ label, onPress, color = "acc-t", size = 13.5, weight = 500 }: { label: string; onPress: () => void; color?: ColorName; size?: 13.5 | 14.5 | 15; weight?: 400 | 500 | 600 }) {
  return (
    <Press onPress={onPress} accessibilityRole="link" accessibilityLabel={label} hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}>
      <Text size={size} weight={weight} color={color}>{label}</Text>
    </Press>
  );
}

/** The 40 round icon button at the end of a form row (show / hide the password). */
export function FieldButton({ glyph, label, onPress, selected }: { glyph: GlyphName; label: string; onPress: () => void; selected?: boolean }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!selected }}
      hitSlop={{ top: 2, bottom: 2 }} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
      <Glyph name={glyph} size={20} color="muted" />
    </Press>
  );
}
