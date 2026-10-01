// Layout pieces of the /sandbox board (Components.dc.html): its header, section titles
// (.cp-sec 21/600), group labels (.cp-gl 12.5 muted) and captions (.cp-cap 11.5 faint),
// plus the temporary Light / Night / Auto and EN / FR switches (owner, 2026-09-30:
// sandbox only, default Auto; Appearance moves to Settings in phase 128).
import type { ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Text";
import { useTheme, type Appearance } from "./theme";

export function BoardHeader({ title, intro }: { title: string; intro: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 28, paddingHorizontal: 20 }}>
      <Text size={30} weight={600} tracking={-0.045} leading={1.1}>{title}</Text>
      <Text size={14.5} color="muted" leading={1.45} style={{ marginTop: 8 }}>{intro}</Text>
    </View>
  );
}

export function BoardSection({ title }: { title: string }) {
  return <Text size={21} weight={600} tracking={-0.035} style={{ marginTop: 44, marginHorizontal: 20 }}>{title}</Text>;
}

export function BoardGroup({ label }: { label: string }) {
  return <Text size={12.5} color="muted" style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 8 }}>{label}</Text>;
}

export function BoardPad({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ paddingHorizontal: 16 }, style]}>{children}</View>;
}

export function BoardCaption({ children }: { children: ReactNode }) {
  return <Text size={11.5} color="faint" style={{ paddingLeft: 4 }}>{children}</Text>;
}

/**
 * The board's .cp-row: min 60, padding 12×16, gap 12; a 15/500 title over a 12.5 muted line, the
 * control on the right. `lead` puts a 44 control on the left (padding-left 6); `stacked` puts the
 * control under the text (gap 10, padding-bottom 16).
 */
export function BoardRow({ title, sub, children, leading, lead, stacked }: { title: string; sub?: string; children?: ReactNode; leading?: ReactNode; lead?: boolean; stacked?: boolean }) {
  return (
    <View style={{
      flexDirection: stacked ? "column" : "row", alignItems: stacked ? "stretch" : "center", gap: stacked ? 10 : 12,
      paddingVertical: 12, paddingHorizontal: 16, paddingLeft: lead ? 6 : 16, paddingBottom: stacked ? 16 : 12, minHeight: 60,
    }}>
      {leading}
      <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
        <Text weight={500}>{title}</Text>
        {sub ? <Text size={12.5} color="muted" leading={1.35}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Opt({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={{ height: 34, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: on ? colors.inv : colors.sunk }}>
      <Text size={13.5} weight={500} color={on ? "on-inv" : "ink"}>{label}</Text>
    </Pressable>
  );
}

/** Sandbox-only switches: appearance and language. */
export function SandboxSwitches() {
  const { appearance, setAppearance } = useTheme();
  const { t, i18n } = useTranslation();
  const modes: Appearance[] = ["light", "dark", "auto"]; // the Settings board's order
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, paddingTop: 16 }}>
      {modes.map((m) => <Opt key={m} on={appearance === m} label={t(`sandbox.appearance.${m}`)} onPress={() => setAppearance(m)} />)}
      <View style={{ width: 10 }} />
      {(["en", "fr"] as const).map((l) => <Opt key={l} on={i18n.language === l} label={l.toUpperCase()} onPress={() => void i18n.changeLanguage(l)} />)}
    </View>
  );
}
