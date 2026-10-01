// Verify.dc.html .vf-orb: a 76 round card with the ring and a soft shadow, a 40 icon, and a pale
// blue halo around it.
import { View } from "react-native";
import { board } from "@/theme/board";
import { Icon, type IconName, type Tone } from "./Icon";
import { useTheme } from "./theme";

export function VerifyOrb({ icon, tone }: { icon: IconName; tone: Tone }) {
  const { colors } = useTheme();
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
      boxShadow: `0 0 0 1px ${colors.ring}, 0 18px 36px -18px ${colors.shadow}, 0 0 28px 10px ${board.orbGlow}` }}>
      <Icon name={icon} tone={tone} size={40} />
    </View>
  );
}
