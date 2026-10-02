// Every screen sits on the ground colour, with the ground's fade (dusk by default) fixed to the
// screen behind the content: it doesn't scroll (tokens.ground.note).
// `floating` holds what floats over the content (the tab bar, the floating action bar). The
// content sits in a blur target so the glass can blur what scrolls under it on Android.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
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

/** Space a floating tab bar takes at the foot of the screen: a bar that shows itself registers it, and ScrollPage leaves it clear. */
const TabInsetCtx = createContext<{ inset: number; set: (n: number) => void }>({ inset: 0, set: () => {} });
export const useTabInset = (): number => useContext(TabInsetCtx).inset;
export function useRegisterTabInset(n: number): void {
  const { set } = useContext(TabInsetCtx);
  useEffect(() => { set(n); return () => set(0); }, [n, set]);
}

export function Screen({ children, floating }: { children: ReactNode; floating?: ReactNode }) {
  const [inset, setInset] = useState(0);
  const tab = useMemo(() => ({ inset, set: setInset }), [inset]);
  const { colors, fade, scheme } = useTheme();
  const { width, height } = useWindowDimensions();
  const g = useMemo(() => (fade ? parseLinearGradient(fade, width, height) : null), [fade, width, height]);
  const target = useRef<View>(null);
  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <BlurTargetView ref={target} style={{ flex: 1, backgroundColor: colors.ground }}>
        {g && <LinearGradient pointerEvents="none" style={StyleSheet.absoluteFill} colors={g.colors} locations={g.locations} start={g.start} end={g.end} />}
        <TabInsetCtx.Provider value={tab}>{children}</TabInsetCtx.Provider>
      </BlurTargetView>
      <TabInsetCtx.Provider value={tab}><BlurTargetCtx.Provider value={target}>{floating}</BlurTargetCtx.Provider></TabInsetCtx.Provider>
    </View>
  );
}
