// COMPONENTS §16. 51×31, radius 999, padding 2. The knob is 27 white with a small shadow and
// travels 20 pt with the spring easing over 400 ms; the track fades acc ↔ track-off over 300 ms.
// Always paired with a text label: the label is the switch's accessible name.
import { useEffect } from "react";
import Animated, { interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { board } from "@/theme/board";
import { tokens } from "@/theme/tokens";
import { easing, Press } from "./motion";
import { useTheme } from "./theme";

export function Switch({ value, onChange, label, disabled }: { value: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const on = useSharedValue(value ? 1 : 0);
  const knob = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    const v = value ? 1 : 0;
    if (reduced) { on.value = v; knob.value = v; return; }
    on.value = withTiming(v, { duration: 300 });
    knob.value = withTiming(v, { duration: tokens.motion.switchKnob.duration, easing: easing("spring") });
  }, [value, reduced, on, knob]);
  const off = colors["track-off"];
  const acc = colors.acc;
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(on.value, [0, 1], [off, acc]) }));
  const move = useAnimatedStyle(() => ({ transform: [{ translateX: knob.value * 20 }] }));
  return (
    <Press
      onPress={() => onChange?.(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      hitSlop={{ top: 7, bottom: 7 }}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View style={[{ width: 51, height: 31, borderRadius: 999, padding: 2, flexDirection: "row" }, track]}>
        <Animated.View style={[{ width: 27, height: 27, borderRadius: 14, backgroundColor: board.white, boxShadow: board.knobShadow }, move]} />
      </Animated.View>
    </Press>
  );
}
