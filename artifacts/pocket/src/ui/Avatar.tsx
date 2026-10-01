// COMPONENTS §19 (.av): 38, round, initials 12.5/600. Five tints: tn1 green, tn2 violet,
// tn3 amber, tn4 blue, tn5 neutral (`av` / `ink`).
import { View } from "react-native";
import { board } from "@/theme/board";
import { Text } from "./Text";
import { useTheme, type ColorName, type Colors } from "./theme";

export type AvatarTint = 1 | 2 | 3 | 4 | 5;

export function avatarTint(tint: AvatarTint, colors: Colors): { bg: string; fg: ColorName } {
  switch (tint) {
    case 1: return { bg: colors["ok-soft"], fg: "ok" };
    case 2: return { bg: colors["acc-soft"], fg: "acc-soft-t" };
    case 3: return { bg: board.warnSoft, fg: "warn" };
    case 4: return { bg: colors["info-soft"], fg: "info" };
    case 5: return { bg: colors.av, fg: "ink" };
  }
}

export function Avatar({ initials, tint = 5, size = 38, label }: { initials: string; tint?: AvatarTint; size?: number; /** Who it is, when the name isn't next to it. */ label?: string }) {
  const { colors } = useTheme();
  const t = avatarTint(tint, colors);
  return (
    <View accessible={!!label} accessibilityLabel={label} importantForAccessibility={label ? "yes" : "no-hide-descendants"}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Text size={12.5} weight={600} color={t.fg} allowFontScaling={false}>{initials}</Text>
    </View>
  );
}
