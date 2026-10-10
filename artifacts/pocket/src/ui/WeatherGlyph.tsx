// The weather glyph as SmartHome.dc.html draws it (.wx-cloud, .wx-drop): a cloud that drifts a little (4.5 s) and, when it rains, three drops that fall and fade, 1.4 s each, 0.45 s apart. Other conditions
// use the sun and the plain cloud the app already has. Reduced motion: still.
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { glyphOf, type Condition } from "@/lib/weather";
import { board } from "@/theme/board";
import { Glyph } from "./Icon";
import { useTheme } from "./theme";

const CLOUD = "M7 16a4.5 4.5 0 1 1 1-8.9A6 6 0 0 1 19 8.5 3.8 3.8 0 0 1 17.5 16z";
const DROPS = ["M9 18.6l-.8 1.5", "M13 18.6l-.8 1.5", "M17 18.6l-.8 1.5"];

function Drop({ d, delay, size, color, width, reduced }: { d: string; delay: number; size: number; color: string; width: number; reduced: boolean }) {
  const p = useSharedValue(reduced ? 0.6 : 0);
  useEffect(() => {
    if (reduced) return;
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1400, easing: Easing.bezier(0.4, 0, 0.6, 1) }), -1));
  }, [reduced, delay, p]);
  const st = useAnimatedStyle(() => ({ opacity: p.value < 0.2 ? p.value / 0.2 : 1 - (p.value - 0.2) / 0.8, transform: [{ translateX: -0.9 * p.value * (size / 24) }, { translateY: (-1.5 + 3.9 * p.value) * (size / 24) }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, width: size, height: size }, st]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round"><Path d={d} /></Svg>
    </Animated.View>
  );
}

/** `size` 14 in the header (muted line colour), 34 on the widget (the rain blue). */
export function WeatherGlyph({ condition, size, tint, weight = 1.8, rainy }: { condition: Condition; size: number; tint?: string; weight?: number; /** The day has rain or snow in it (now or later): draw the drops whatever the sky is now. */ rainy?: boolean }) {
  const { colors } = useTheme();
  const reduced = !!useReducedMotion();
  const g = glyphOf(condition);
  const wet = g.wet || !!rainy;
  const glyph = wet && g.glyph !== "cloudRain" ? "cloudRain" : g.glyph;
  const color = tint ?? colors.muted;
  const float = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    float.value = withRepeat(withSequence(withTiming(1, { duration: 2250, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 2250, easing: Easing.inOut(Easing.ease) })), -1);
  }, [reduced, float]);
  const drift = useAnimatedStyle(() => ({ transform: [{ translateX: 0.5 * float.value * (size / 24) }, { translateY: -0.6 * float.value * (size / 24) }] }));
  if (glyph === "sun") return <Glyph name="sun" size={size} tint={tint} color="muted" weight={weight} />;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ position: "absolute", top: 0, left: 0, width: size, height: size }, drift]}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round"><Path d={CLOUD} /></Svg>
      </Animated.View>
      {wet ? DROPS.map((d, i) => <Drop key={d} d={d} delay={i * 450} size={size} color={color} width={weight} reduced={reduced} />) : null}
    </View>
  );
}

/** The rain blue of the widget's glyph and bars. */
export const RAIN_BLUE = board.rain;
