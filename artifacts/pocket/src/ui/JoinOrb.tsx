// JoinCode.dc.html: the 76 round orb with the cone icon (.jc-orb: `card`, a 1 ring, a soft drop shadow, a gold
// halo spreading 26 beyond it) and the clipboard glyph on the "Paste code" pill.
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Defs, G, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { board } from "@/theme/board";
import { Icon } from "./Icon";
import { Press } from "./motion";
import { cssShadow } from "./shadow";
import { Text } from "./Text";
import { useTheme } from "./theme";

const ORB = 76;
const HALO = 26;

export function JoinOrb() {
  const { colors } = useTheme();
  const size = ORB + HALO * 2;
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ width: ORB, height: ORB, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", left: -HALO, top: -HALO }} pointerEvents="none">
        <Defs>
          <RadialGradient id="jcHalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={board.joinHalo} stopOpacity={0.5} />
            <Stop offset="1" stopColor={board.joinHalo} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} rx={size / 2} fill="url(#jcHalo)" />
      </Svg>
      <View style={{ width: ORB, height: ORB, borderRadius: ORB / 2, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", boxShadow: cssShadow(`0 0 0 1px var(--ring), 0 18px 36px -18px var(--shadow)`, colors) }}>
        <Icon name="cone" tone="amber" size={40} />
      </View>
    </View>
  );
}

export function ClipboardGlyph({ size = 16 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
      <G>
        <Rect x={8} y={4} width={8} height={4} rx={1.5} />
        <Path d="M8 6H6.5A1.5 1.5 0 0 0 5 7.5v11A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 17.5 6H16" />
      </G>
    </Svg>
  );
}

/** "Paste code" (a 40 tall pill, `sunk`, a clipboard glyph and 13.5/500). */
export function PasteButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.sunk }}>
      <ClipboardGlyph />
      <Text size={13.5} weight={500}>{label}</Text>
    </Press>
  );
}

/** "Looking up the code" (.jc-spin): 14 round, a 2 `line2` ring with the top in `ink`, a turn every .8 s. */
export function LookupSpinner() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (!reduced) turn.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1, false);
  }, [reduced, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return <Animated.View importantForAccessibility="no-hide-descendants" style={[{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.line2, borderTopColor: colors.ink }, style]} />;
}
