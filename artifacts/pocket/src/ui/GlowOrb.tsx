// TwoStep.dc.html .ts-orb and ForgotPassword.dc.html .fp-orb: the Verify orb (76 round card, ring,
// soft shadow, 40 icon) with the halo colour of its screen.
import { View } from "react-native";
import { board } from "@/theme/board";
import { Icon, type IconName, type Tone } from "./Icon";
import { useTheme } from "./theme";

const GLOW = { blue: board.orbGlow, violet: board.twoStepGlow, green: board.resetOkGlow } as const;

export function GlowOrb({ icon, tone, glow }: { icon: IconName; tone: Tone; glow: keyof typeof GLOW }) {
  const { colors } = useTheme();
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
      boxShadow: `0 0 0 1px ${colors.ring}, 0 18px 36px -18px ${colors.shadow}, 0 0 28px 10px ${GLOW[glow]}` }}>
      <Icon name={icon} tone={tone} size={40} />
    </View>
  );
}
