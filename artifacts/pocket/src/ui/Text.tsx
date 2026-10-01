// COMPONENTS §1. `Text`: Geist 400/500/600 at a size from type.scale, default 15/400 ink,
// letter-spacing −0.01em; every digit run inside it renders in Manrope at the same weight.
// `Num`: a standalone figure, all Manrope with tabular figures.
import { Children, type ReactNode } from "react";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { tokens } from "@/theme/tokens";
import { useTheme, type ColorName } from "./theme";
import { geist, manrope, type Weight } from "./fonts";
import { splitDigits } from "./digits";

export type Size = (typeof tokens.type.scale)[number] | 34 | 44;

export type TextProps = Omit<RNTextProps, "style"> & {
  size?: Size;
  weight?: Weight;
  color?: ColorName;
  /** A board value outside the theme (a white that stays white at night: board.white); wins over `color`. */
  tint?: string;
  /** Letter-spacing in em, as the design gives it. */
  tracking?: number;
  /** Line height as a multiple of the size. */
  leading?: number;
  align?: TextStyle["textAlign"];
  opacity?: number;
  /** Layout only (margins, flex); never colours or sizes. */
  style?: TextStyle;
  children?: ReactNode;
};

function base({ size = 15, weight = 400, tracking = -0.01, leading, align, opacity }: TextProps, color: string): TextStyle {
  return {
    fontSize: size,
    color,
    letterSpacing: tracking * size,
    lineHeight: leading ? Math.round(leading * size) : undefined,
    textAlign: align,
    opacity,
    fontWeight: undefined,
    includeFontPadding: false,
  };
}

export function Text(props: TextProps) {
  const { colors } = useTheme();
  const { size, weight = 400, color = "ink", tint, tracking, leading, align, opacity, style, children, ...rest } = props;
  const words = geist(weight);
  const digits = manrope(weight);
  const parts = Children.toArray(children).map((child, i) => {
    if (typeof child !== "string" && typeof child !== "number") return child;
    return splitDigits(String(child)).map((run, j) =>
      run.digits ? (
        <RNText key={`${i}-${j}`} style={{ fontFamily: digits }}>
          {run.text}
        </RNText>
      ) : (
        run.text
      ),
    );
  });
  return (
    <RNText {...rest} style={[base(props, tint ?? colors[color]), { fontFamily: words }, style]}>
      {parts}
    </RNText>
  );
}

export function Num(props: TextProps) {
  const { colors } = useTheme();
  const { size, weight = 600, color = "ink", tint, tracking = 0, leading, align, opacity, style, children, ...rest } = props;
  return (
    <RNText {...rest} style={[base({ ...props, tracking }, tint ?? colors[color]), { fontFamily: manrope(weight), fontVariant: ["tabular-nums"] }, style]}>
      {children}
    </RNText>
  );
}
