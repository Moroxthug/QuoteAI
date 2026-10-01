// COMPONENTS §4. Background card, radius 22, a 1 px ring outline (no drop shadow at rest).
// Lists of rows sit inside one card with hairline dividers; padding is the caller's (16 for
// content, 0 for row lists).
import type { ReactNode } from "react";
import { View, type ViewProps, type ViewStyle } from "react-native";
import { tokens } from "@/theme/tokens";
import { shadow } from "./shadow";
import { useTheme } from "./theme";

export function Card({ children, padded, style, ...rest }: Omit<ViewProps, "style"> & { children?: ReactNode; padded?: boolean; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View {...rest} style={[{ backgroundColor: colors.card, borderRadius: tokens.radius.card, boxShadow: shadow("ring", colors), overflow: "hidden", padding: padded ? tokens.space.cardPadding : 0 }, style]}>
      {children}
    </View>
  );
}

/** A 1 px hairline in `line`, inset from the left (16 in plain rows, more after a leading control). */
export function Hairline({ inset = 16 }: { inset?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: 1, marginLeft: inset, backgroundColor: colors.line }} />;
}
