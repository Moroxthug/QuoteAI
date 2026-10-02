// COMPONENTS §13. Tabs inside a screen: 44 tall, gap 22, 14.5/500 muted; the active tab is ink
// 600 with a 2 pt underline over the hairline below. Sticky under the header (the screen puts
// it in stickyHeaderIndices), on the ground colour. Scrolls sideways when it doesn't fit.
import { ScrollView, View } from "react-native";
import { board } from "@/theme/board";
import { tokens } from "@/theme/tokens";
import { Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

export function Tabs({ tabs, active, onChange, counts }: { tabs: string[]; active: number; onChange: (i: number) => void; /** A count badge after a tab's label (the assistant's waiting proposals); empty or missing shows none. */ counts?: (string | null | undefined)[] }) {
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text size={14.5} weight={on ? 600 : 500} color={on ? "ink" : "muted"} numberOfLines={1}>{label}</Text>
                {counts?.[i] ? (
                  <View accessibilityElementsHidden style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: colors.acc, alignItems: "center", justifyContent: "center" }}>
                    <Num size={11.5} weight={600} tint={board.white}>{counts[i]!}</Num>
                  </View>
                ) : null}
              </View>
              {on ? <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, borderRadius: 2, backgroundColor: colors.ink }} /> : null}
            </Press>
          );
        })}
      </ScrollView>
    </View>
  );
}
