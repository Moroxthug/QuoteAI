// COMPONENTS §9, the floating action bar of detail screens: in the tab bar's place (16 from the sides, 26 from
// the bottom), a 56 round glass "more" button and one 56 pill primary button. One primary action per screen.
// Put it in Screen's `floating`; leave ACTION_BAR_SPACE at the bottom of the content.
import { View } from "react-native";
import { BlurView } from "expo-blur";
import { tokens } from "@/theme/tokens";
import { Button } from "./Button";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { useBlurTarget } from "./Screen";
import { shadow } from "./shadow";
import { useFloatBottom } from "./TabBar";
import { useTheme } from "./theme";

export const ACTION_BAR_SPACE = 120;

export function ActionBar({ label, onPress, moreLabel, onMore, icon, disabled }: { label: string; onPress: () => void; moreLabel: string; onMore?: () => void; icon?: React.ReactNode; disabled?: boolean }) {
  const { colors, scheme } = useTheme();
  const bottom = useFloatBottom();
  const target = useBlurTarget();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: tokens.space.fabBarInset.side, right: tokens.space.fabBarInset.side, bottom, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, boxShadow: `${shadow("float", colors)}, ${shadow("ring", colors)}` }}>
        <BlurView intensity={40} tint={scheme === "dark" ? "dark" : "light"} blurTarget={target ?? undefined} blurMethod={target ? "dimezisBlurViewSdk31Plus" : "none"}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28, overflow: "hidden" }} />
        <Press onPress={onMore} accessibilityRole="button" accessibilityLabel={moreLabel} style={{ flex: 1, borderRadius: 28, backgroundColor: colors.glass, alignItems: "center", justifyContent: "center" }}>
          <Glyph name="more" size={20} />
        </Press>
      </View>
      <Button size="lg" label={label} grow icon={icon} disabled={disabled} onPress={onPress} style={{ boxShadow: shadow("float", colors) }} />
    </View>
  );
}
