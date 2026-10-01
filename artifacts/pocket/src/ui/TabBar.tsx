// COMPONENTS §8, as Quotes.dc.html draws it. One row 16 from the sides and 26 from the bottom
// (above the phone's own bar): the glass bar takes the width, a 10 gap, then the orb.
// Glass bar: `glass` over a 20 blur, `float` shadow and the `ring`, 62 tall, radius 31,
// padding 5, four equal tabs. A tab: radius 26, a 25 icon over a 10.5 label, gap 4. Active: a
// `sunk` pill, label 600 `ink`. Inactive: the icon in greyscale at 50 %, label 500 `muted`.
// AssistantOrb: 62, `card`, a violet shadow and the ring; the swirl logo turns once every 18 s
// and a violet halo (10 beyond the edge) breathes every 3.2 s. Reduced motion: both still.
// Content scrolls under the bar: leave 120 at the bottom (TAB_BAR_SPACE). Put it in Screen's
// `floating` so the glass blurs the content on Android.
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop, SvgXml } from "react-native-svg";
import { board } from "@/theme/board";
import { svgs } from "@/theme/svgs";
import { tokens } from "@/theme/tokens";
import { Press } from "./motion";
import { useBlurTarget } from "./Screen";
import { cssShadow, shadow } from "./shadow";
import { Text } from "./Text";
import { useTheme } from "./theme";

export type TabKey = "home" | "quotes" | "jobs" | "clients";
const TAB_SVG: Record<TabKey, string> = { home: svgs.tabHome, quotes: svgs.tabQuotes, jobs: svgs.tabJobs, clients: svgs.tabClients };

/** Bottom space a tab screen leaves so content can scroll clear of the bar. */
export const TAB_BAR_SPACE = 120;

/** The bar's distance from the bottom: 26 on the board, kept clear of the phone's own bar. */
export function useFloatBottom() {
  const insets = useSafeAreaInsets();
  return Math.max(tokens.space.fabBarInset.bottom, insets.bottom + 10);
}

/** CSS grayscale(1) on each gradient stop (the inactive tab icon), and ids made unique per use. */
function tabXml(xml: string, on: boolean, suffix: string): string {
  let s = xml.replace(/id="([^"]+)"/g, `id="$1${suffix}"`).replace(/url\(#([^)]+)\)/g, `url(#$1${suffix})`);
  if (!on) {
    s = s.replace(/stop-color="#([0-9a-fA-F]{6})"/g, (_m, hex: string) => {
      const n = parseInt(hex, 16);
      const y = Math.round(0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255));
      const g = y.toString(16).padStart(2, "0");
      return `stop-color="#${g}${g}${g}"`;
    });
  }
  return s;
}

function Tab({ k, label, active, onPress }: { k: TabKey; label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const xml = useMemo(() => tabXml(TAB_SVG[k], active, active ? "On" : "Off"), [k, active]);
  return (
    <Press onPress={onPress} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }}
      style={{ flex: 1, minWidth: 0, borderRadius: 26, backgroundColor: active ? colors.sunk : "transparent", alignItems: "center", justifyContent: "center", gap: 4 }}>
      <View style={{ opacity: active ? 1 : 0.5 }}><SvgXml xml={xml} width={25} height={25} /></View>
      <Text size={10.5} weight={active ? 600 : 500} color={active ? "ink" : "muted"} numberOfLines={1} allowFontScaling={false}>{label}</Text>
    </Press>
  );
}

const LINEAR = Easing.linear;
const INOUT = Easing.inOut(Easing.ease);

export function AssistantOrb({ label, onPress }: { label: string; onPress?: () => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (reduced) { spin.value = 0; breathe.value = 0.5; return; }
    spin.value = withRepeat(withTiming(1, { duration: 18000, easing: LINEAR }), -1);
    breathe.value = withRepeat(withSequence(withTiming(1, { duration: 1600, easing: INOUT }), withTiming(0, { duration: 1600, easing: INOUT })), -1);
  }, [reduced, spin, breathe]);
  const swirl = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * breathe.value, transform: [{ scale: 0.8 + 0.25 * breathe.value }] }));
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colors.card, boxShadow: cssShadow(board.orbShadow, colors), flexShrink: 0 }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -10, left: -10, right: -10, bottom: -10 }, halo]}>
        <Svg width="100%" height="100%" viewBox="0 0 82 82">
          <Defs>
            <RadialGradient id="orbHalo" cx="41" cy="41" r="41" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={board.micHalo} stopOpacity={0.35} />
              <Stop offset="0.62" stopColor={board.micHalo} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={41} cy={41} r={41} fill="url(#orbHalo)" />
        </Svg>
      </Animated.View>
      <Animated.View style={swirl}><SvgXml xml={svgs.orb} width={62} height={62} /></Animated.View>
    </Press>
  );
}

export function TabBar({ active, onTab, labels, orbLabel, onOrb, label }: {
  active: TabKey; onTab: (k: TabKey) => void; labels: Record<TabKey, string>;
  orbLabel: string; onOrb?: () => void; /** The bar's name for screen readers ("Main"). */ label: string;
}) {
  const { colors, scheme } = useTheme();
  const bottom = useFloatBottom();
  const target = useBlurTarget();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} pointerEvents="box-none"
      style={{ position: "absolute", left: tokens.space.fabBarInset.side, right: tokens.space.fabBarInset.side, bottom, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ flex: 1, height: 62, borderRadius: 31, boxShadow: `${shadow("float", colors)}, ${shadow("ring", colors)}` }}>
        <BlurView intensity={40} tint={scheme === "dark" ? "dark" : "light"} blurTarget={target ?? undefined} blurMethod={target ? "dimezisBlurViewSdk31Plus" : "none"}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 31, overflow: "hidden" }} />
        <View style={{ flex: 1, flexDirection: "row", borderRadius: 31, padding: 5, backgroundColor: colors.glass }}>
          {(["home", "quotes", "jobs", "clients"] as const).map((k) => <Tab key={k} k={k} label={labels[k]} active={active === k} onPress={() => onTab(k)} />)}
        </View>
      </View>
      <AssistantOrb label={orbLabel} onPress={onOrb} />
    </View>
  );
}
