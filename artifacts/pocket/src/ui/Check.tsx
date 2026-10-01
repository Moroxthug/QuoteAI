// The Controls section of Components.dc.html.
// Checkbox: a 44 tap around a 22 box, radius 7, 1.5 `line2` outline; checked fills `inv` with an
// `on-inv` tick (13, 3.2). Round tick (a task done): the same, round, filled `ok-dot` with a white
// tick. Disabled 40 %.
// RadioRow: a full-width row (min 58, padding 0 16, gap 12) with a 22 ring that thickens to a
// 7 pt `acc` ring when chosen (250 ms).
import { useEffect, type ReactNode } from "react";
import { View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { board } from "@/theme/board";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Text } from "./Text";
import { useTheme } from "./theme";

export function Checkbox({ checked, onChange, label, round, disabled }: { checked: boolean; onChange?: (v: boolean) => void; label: string; round?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  const fill = round ? colors["ok-dot"] : colors.inv;
  return (
    <Press onPress={() => onChange?.(!checked)} disabled={disabled} accessibilityRole="checkbox" accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <View style={{
        width: 22, height: 22, borderRadius: round ? 11 : 7, alignItems: "center", justifyContent: "center",
        backgroundColor: checked ? fill : "transparent", borderWidth: checked ? 0 : 1.5, borderColor: colors.line2, opacity: disabled ? 0.4 : 1,
      }}>
        {checked ? <Glyph name="check" size={13} weight={3.2} color="on-inv" tint={round ? board.white : undefined} /> : null}
      </View>
    </Press>
  );
}

export function RadioDot({ on }: { on: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.value = reduced ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: 250 }); }, [on, reduced, p]);
  const off = colors.line2;
  const acc = colors.acc;
  const ring = useAnimatedStyle(() => ({
    borderWidth: 1.5 + p.value * 5.5,
    borderColor: interpolateColor(p.value, [0, 1], [off, acc]),
  }));
  return <Animated.View style={[{ width: 22, height: 22, borderRadius: 11, flexShrink: 0 }, ring]} />;
}

export function RadioRow({ selected, onPress, title, sub }: { selected: boolean; onPress: () => void; title: string; sub?: ReactNode }) {
  return (
    <Press onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 58 }}>
      <RadioDot on={selected} />
      <View style={{ flex: 1, gap: 2, paddingVertical: 8 }}>
        <Text weight={500}>{title}</Text>
        {sub ? <Text size={12.5} color="muted" leading={1.35}>{sub}</Text> : null}
      </View>
    </Press>
  );
}
