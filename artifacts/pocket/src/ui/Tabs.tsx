// COMPONENTS §13. Tabs inside a screen: 44 tall, gap 22, 14.5/500 muted; the active tab is ink
// 600 with a 2 pt underline over the hairline below. Sticky under the header (the screen puts
// it in stickyHeaderIndices), on the ground colour. Scrolls sideways when it doesn't fit.
import { ScrollView, View } from "react-native";
import { tokens } from "@/theme/tokens";
import { Press } from "./motion";
import { Text } from "./Text";
import { useTheme } from "./theme";

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: number; onChange: (i: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.ground }}>
      {/* The hairline sits under the strip so the active underline (its lower 1 pt on the hairline) covers it. */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, backgroundColor: colors.line }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist"
        contentContainerStyle={{ gap: tokens.space.tabGap, paddingHorizontal: 20 }}>
        {tabs.map((label, i) => {
          const on = i === active;
          return (
            <Press key={label} onPress={() => onChange(i)} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={{ height: tokens.size.tab + 1, paddingBottom: 1, justifyContent: "center" }}>
              <Text size={14.5} weight={on ? 600 : 500} color={on ? "ink" : "muted"} numberOfLines={1}>{label}</Text>
              {on ? <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, borderRadius: 2, backgroundColor: colors.ink }} /> : null}
            </Press>
          );
        })}
      </ScrollView>
    </View>
  );
}
