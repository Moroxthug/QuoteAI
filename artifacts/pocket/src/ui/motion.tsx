// COMPONENTS §24 motion helpers. `Press`: every tappable scales to .96 over 200 ms with the
// `out` easing (tokens.motion.press). Reduced motion: no scaling.
import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { tokens } from "@/theme/tokens";

/** "cubic-bezier(.16,1,.3,1)" → Easing.bezier(.16, 1, .3, 1) */
export function easing(name: keyof typeof tokens.motion.easing) {
  const [a, b, c, d] = tokens.motion.easing[name].replace(/^cubic-bezier\(|\)$/g, "").split(",").map(Number) as [number, number, number, number];
  return Easing.bezier(a, b, c, d);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressProps = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Show the pressed look without a finger (the board's "Pressed" cells). */
  forcePressed?: boolean;
};

export function Press({ style, children, forcePressed, onPressIn, onPressOut, disabled, ...rest }: PressProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(forcePressed ? tokens.motion.press.scale : 1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const to = (v: number) => {
    if (reduced || forcePressed) return;
    scale.value = withTiming(v, { duration: tokens.motion.press.duration, easing: easing("out") });
  };
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => { to(tokens.motion.press.scale); onPressIn?.(e); }}
      onPressOut={(e) => { to(1); onPressOut?.(e); }}
      style={[style, anim]}
    >
      {children}
    </AnimatedPressable>
  );
}
