// COMPONENTS §12. A 36 track in `sunk`, radius 11, padding 2, equal columns. The thumb is `card`,
// radius 9, shadow.thumb, and slides over 450 ms (`out`). Labels 13.5/500 muted; the chosen one
// ink 600.
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { tokens } from "@/theme/tokens";
import { easing } from "./motion";
import { shadow } from "./shadow";
import { Text } from "./Text";
import { useTheme } from "./theme";

export function Segmented({ options, value, onChange, label }: { options: string[]; value: number; onChange: (i: number) => void; label: string }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const col = width > 0 ? (width - 4) / options.length : 0;
  const x = useSharedValue(value);
  useEffect(() => {
    x.value = reduced ? value : withTiming(value, { duration: 450, easing: easing("out") });
  }, [value, reduced, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * col }] }));
  const inner = tokens.size.segment - 4;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: "row", height: tokens.size.segment, padding: 2, borderRadius: tokens.radius.segment, backgroundColor: colors.sunk }}>
      {col > 0 ? (
        <Animated.View pointerEvents="none"
          style={[{ position: "absolute", top: 2, left: 2, width: col, height: inner, borderRadius: tokens.radius.segmentThumb, backgroundColor: colors.card, boxShadow: shadow("thumb", colors) }, thumb]} />
      ) : null}
      {options.map((o, i) => {
        const on = i === value;
        return (
          // 32 drawn inside the 36 track; the track's padding and a 4 pt slop make the 44 tap.
          <Pressable key={o} onPress={() => onChange(i)} accessibilityRole="radio" accessibilityLabel={o} accessibilityState={{ checked: on }} hitSlop={{ top: 6, bottom: 6 }}
            style={{ flex: 1, height: inner, alignItems: "center", justifyContent: "center" }}>
            <Text size={13.5} weight={on ? 600 : 500} color={on ? "ink" : "muted"} numberOfLines={1}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
