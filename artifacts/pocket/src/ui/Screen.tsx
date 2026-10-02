// Every screen sits on the ground colour, with the ground's fade (dusk by default) fixed to the
// screen behind the content: it doesn't scroll (tokens.ground.note).
// `floating` holds what floats over the content (the tab bar, the floating action bar). The
// content sits in a blur target so the glass can blur what scrolls under it on Android.
import { createContext, useContext, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { BlurTargetView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "./theme";
import { parseLinearGradient } from "./gradient";

const BlurTargetCtx = createContext<RefObject<View | null> | null>(null);

/** The screen's content, for a floating glass surface to blur (Android). */
export function useBlurTarget() {
  return useContext(BlurTargetCtx);
}

export function Screen({ children, floating }: { children: ReactNode; floating?: ReactNode }) {
  const { colors, fade, scheme } = useTheme();
  const { width, height } = useWindowDimensions();
  const g = useMemo(() => (fade ? parseLinearGradient(fade, width, height) : null), [fade, width, height]);
  const target = useRef<View>(null);
  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <BlurTargetView ref={target} style={{ flex: 1, backgroundColor: colors.ground }}>
        {g && <LinearGradient pointerEvents="none" style={StyleSheet.absoluteFill} colors={g.colors} locations={g.locations} start={g.start} end={g.end} />}
        {children}
      </BlurTargetView>
      <BlurTargetCtx.Provider value={target}>{floating}</BlurTargetCtx.Provider>
    </View>
  );
}
