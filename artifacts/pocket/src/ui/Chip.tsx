// COMPONENTS §11 and the Chips section of Components.dc.html.
// Chip: 34 tall, radius 999, padding 0 12, gap 6, 13.5/500 on `sunk`; selected `inv` / `on-inv`.
// Optional count in Manrope 11.5/600 at 65 %, optional leading glyph. Disabled 40 %.
// ChipStrip: the horizontal scroll strip (gap 6, 16 side padding), the only sideways scroll
// besides tabs and Home widget rows.
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { tokens } from "@/theme/tokens";
import { Glyph, type GlyphName } from "./Icon";
import { Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

export type ChipProps = {
  label: string;
  selected?: boolean;
  count?: number | string;
  /** Leading stroke glyph: `check` (13, 3) or `plus` (14, 2.4) on the board. */
  glyph?: GlyphName;
  disabled?: boolean;
  onPress?: () => void;
};

const GLYPH: Partial<Record<GlyphName, { size: number; weight: number }>> = {
  check: { size: 13, weight: 3 },
  plus: { size: 14, weight: 2.4 },
};

export function Chip({ label, selected, count, glyph, disabled, onPress }: ChipProps) {
  const { colors } = useTheme();
  const fg = selected ? "on-inv" : "ink";
  const g = glyph ? GLYPH[glyph] ?? { size: 14, weight: 2.4 } : null;
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={count != null ? `${label}, ${count}` : label}
      // 34 drawn, 44 to the finger.
      hitSlop={{ top: 5, bottom: 5 }}
      style={{
        height: tokens.size.chip,
        paddingHorizontal: 12,
        borderRadius: tokens.radius.chip,
        backgroundColor: selected ? colors.inv : colors.sunk,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {glyph && g ? <Glyph name={glyph} size={g.size} weight={g.weight} color={fg} /> : null}
      <Text size={13.5} weight={500} color={fg} numberOfLines={1}>{label}</Text>
      {count != null ? <Num size={11.5} weight={600} color={fg} opacity={0.65}>{count}</Num> : null}
    </Press>
  );
}

export function ChipStrip({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={label}
      contentContainerStyle={{ gap: tokens.space.chipGap, paddingHorizontal: tokens.space.gutter }}>
      {children}
    </ScrollView>
  );
}

/** Chips that wrap instead of scrolling (the board's "Chip states" row). */
export function ChipWrap({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: tokens.space.gutter }}>{children}</View>;
}
