// COMPONENTS §10 and the Buttons section of Components.dc.html.
// Sizes: sm 36 / r11 / 13.5 (44 hit area) · md 44 / r13 / 14.5 · default 50 / r15 / 15 · lg 54 / r17 / 16, all 600.
// Kinds: primary (inv / on-inv, inverts at night), secondary (sunk / ink), destructive
// (bad-soft / bad), accent (acc / white, rare), link (no fill, acc-t; underlined when pressed).
// States: disabled 40 %; loading shows a spinner and the busy label; press scales to .96.
import { useEffect, type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { tokens } from "@/theme/tokens";
import { Press } from "./motion";
import { Text, type Size } from "./Text";
import { useTheme, type ColorName } from "./theme";

export type ButtonKind = "primary" | "secondary" | "destructive" | "accent" | "link";
export type ButtonSize = "sm" | "md" | "default" | "lg";

const SIZES: Record<ButtonSize, { height: number; radius: number; font: Size; pad: number }> = {
  sm: { height: tokens.size.buttonSm, radius: tokens.radius.buttonSm, font: 13.5, pad: 13 },
  md: { height: tokens.size.buttonMd, radius: tokens.radius.buttonMd, font: 14.5, pad: 16 },
  default: { height: tokens.size.button, radius: tokens.radius.button, font: 15, pad: 18 },
  lg: { height: tokens.size.buttonLg, radius: tokens.radius.buttonLg, font: 16, pad: 18 },
};

// Accent text is white in both themes (the board's .btn-a); light on-inv is that white.
const WHITE = tokens.color.light["on-inv"];

function kindColors(kind: ButtonKind, c: Record<ColorName, string>): { bg: string; fg: string } {
  switch (kind) {
    case "primary": return { bg: c.inv, fg: c["on-inv"] };
    case "secondary": return { bg: c.sunk, fg: c.ink };
    case "destructive": return { bg: c["bad-soft"], fg: c.bad };
    case "accent": return { bg: c.acc, fg: WHITE };
    case "link": return { bg: "transparent", fg: c["acc-t"] };
  }
}

/** The board's .cp-spin: 16 round, 2 px ring in the text colour with the top open, .8 s a turn. */
export function Spinner({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (!reduced) turn.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1, false);
  }, [reduced, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return <Animated.View style={[{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: color, borderTopColor: "transparent", opacity: 0.8 }, style]} />;
}

export type ButtonProps = {
  label: string;
  kind?: ButtonKind;
  size?: ButtonSize;
  onPress?: () => void;
  disabled?: boolean;
  /** Shows the spinner and this label instead ("Sending"). */
  busy?: string | false;
  icon?: ReactNode;
  /** Stretch to the row (the board's full-width buttons). */
  block?: boolean;
  grow?: boolean;
  /** The board's "Pressed" cells. */
  forcePressed?: boolean;
  /** Extra outer style (shadow on the floating bar); never sizes or colours. */
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function Button({ label, kind = "primary", size = "default", onPress, disabled, busy, icon, block, grow, forcePressed, style, accessibilityLabel }: ButtonProps) {
  const { colors } = useTheme();
  const s = SIZES[size];
  const { bg, fg } = kindColors(kind, colors);
  return (
    <Press
      onPress={onPress}
      disabled={disabled || !!busy}
      forcePressed={forcePressed}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (busy || label)}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      // sm draws 36 but takes a 44 tap (the board's ::after inset -4px -2px).
      hitSlop={size === "sm" ? { top: 4, bottom: 4, left: 2, right: 2 } : undefined}
      style={[
        {
          height: s.height,
          borderRadius: s.radius,
          paddingHorizontal: s.pad,
          backgroundColor: bg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: icon ? 6 : 8,
          alignSelf: block ? "stretch" : "flex-start",
          flexGrow: grow ? 1 : undefined,
          opacity: disabled ? 0.4 : forcePressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {busy ? <Spinner color={fg} /> : icon ? <View>{icon}</View> : null}
      <Text size={s.font} weight={600} numberOfLines={1}
        style={{ color: fg, ...(kind === "link" && forcePressed ? { textDecorationLine: "underline" } : null) }}>
        {busy || label}
      </Text>
    </Press>
  );
}
