// Every screen sits on the ground colour, with the ground's fade (dusk by default) fixed to the
// screen behind the content: it doesn't scroll (tokens.ground.note).
import { useMemo, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "./theme";
import { parseLinearGradient } from "./gradient";

export function Screen({ children }: { children: ReactNode }) {
  const { colors, fade, scheme } = useTheme();
  const { width, height } = useWindowDimensions();
  const g = useMemo(() => (fade ? parseLinearGradient(fade, width, height) : null), [fade, width, height]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      {g && <LinearGradient pointerEvents="none" style={StyleSheet.absoluteFill} colors={g.colors} locations={g.locations} start={g.start} end={g.end} />}
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {children}
    </View>
  );
}
