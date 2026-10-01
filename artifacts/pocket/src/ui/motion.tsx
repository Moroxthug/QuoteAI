// COMPONENTS §24 motion helpers. `Press`: every tappable scales to .96 over 200 ms with the
// `out` easing (tokens.motion.press). Reduced motion: no scaling.
import { useEffect, type ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
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

const RISE = easing("out");

/**
 * COMPONENTS §24 "Rise": a section enters from 10 below, opacity 0 → 1, over 800 ms with the
 * `out` easing. Stagger sections 40 to 80 ms apart with `delay`. Reduced motion: no movement.
 */
export function Rise({ delay = 0, children, style }: { delay?: number; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { t.value = 1; return; }
    t.value = withDelay(delay, withTiming(1, { duration: tokens.motion.rise.duration, easing: RISE }));
  }, [reduced, delay, t]);
  const anim = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * tokens.motion.rise.from.translateY }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
