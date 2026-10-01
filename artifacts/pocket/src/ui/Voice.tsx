// The Voice section of Components.dc.html.
// MicButton (.cp-mic): 64, round, a 24 mic glyph. Idle: `sunk` / `ink`. Live: `acc` with a white
// glyph and a violet halo 8 beyond the edge that breathes (scale .8 → 1.05, opacity .35 → 1,
// 1.6 s). Busy: `inv` / `on-inv` with three 6 dots (gap 4) fading in turn (1.2 s, .2 s apart).
// LevelMeter (.cp-lv): 7 bars, 3 wide, gap 3, in a 26 box, each 4 ↔ 24 tall over 1 s, offset.
// Reduced motion: no halo pulse, still dots and bars.
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { board } from "@/theme/board";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { useTheme } from "./theme";

export type MicState = "idle" | "live" | "busy";

const INOUT = Easing.inOut(Easing.ease);

/** A 0 → 1 → 0 loop (CSS `ease-in-out infinite` keyframes at 0 / 50 / 100 %), starting `delay` ms in. */
function useLoop(period: number, delay = 0): SharedValue<number> {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { v.value = 1; return; }
    const half = period / 2;
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: half, easing: INOUT }), withTiming(0, { duration: half, easing: INOUT })), -1));
  }, [reduced, period, delay, v]);
  return v;
}

function Halo() {
  const t = useLoop(1600);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * t.value, transform: [{ scale: 0.8 + 0.25 * t.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -8, left: -8, right: -8, bottom: -8 }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 80 80">
        <Defs>
          <RadialGradient id="micHalo" cx="40" cy="40" r="40" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={board.micHalo} stopOpacity={0.35} />
            <Stop offset="1" stopColor={board.micHalo} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={40} cy={40} r={40} fill="url(#micHalo)" />
      </Svg>
    </Animated.View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  // CSS: opacity .25 at 0 / 100 %, 1 at 50 %, 1.2 s, each dot .2 s later.
  const t = useLoop(1200, delay);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * t.value }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, style]} />;
}

export function MicButton({ state, onPress, label }: { state: MicState; onPress?: () => void; label: string }) {
  const { colors } = useTheme();
  const bg = state === "live" ? colors.acc : state === "busy" ? colors.inv : colors.sunk;
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: state === "busy" }}
      style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: bg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {state === "live" ? <Halo /> : null}
      {state === "busy" ? (
        <View style={{ flexDirection: "row", gap: 4 }}>
          {[0, 200, 400].map((d) => <Dot key={d} delay={d} color={colors["on-inv"]} />)}
        </View>
      ) : (
        <Glyph name="mic" size={24} color="ink" tint={state === "live" ? board.white : undefined} />
      )}
    </Press>
  );
}

// .cp-lv i:nth-child(n) animation-delay, as a share of the 1 s cycle.
const BAR_DELAYS = [0, -0.3, -0.6, -0.15, -0.45, -0.75, -0.2];

function Bar({ offset, color }: { offset: number; color: string }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 0.5 : 0);
  useEffect(() => {
    if (reduced) { t.value = 0.5; return; }
    // Start part-way through the cycle, as a negative CSS delay does.
    const start = ((-offset % 1) + 1) % 1; // 0..1 of the cycle already done
    const up = start < 0.5;
    const first = up ? 0.5 - start : 1 - start;
    t.value = up ? start * 2 : 2 - start * 2;
    t.value = withSequence(
      withTiming(up ? 1 : 0, { duration: first * 1000, easing: INOUT }),
      withRepeat(withSequence(withTiming(up ? 0 : 1, { duration: 500, easing: INOUT }), withTiming(up ? 1 : 0, { duration: 500, easing: INOUT })), -1),
    );
  }, [reduced, offset, t]);
  const style = useAnimatedStyle(() => ({ height: 4 + 20 * t.value }));
  return <Animated.View style={[{ width: 3, borderRadius: 3, backgroundColor: color }, style]} />;
}

export function LevelMeter() {
  const { colors } = useTheme();
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 26 }}>
      {BAR_DELAYS.map((d, i) => <Bar key={i} offset={d} color={colors.acc} />)}
    </View>
  );
}
