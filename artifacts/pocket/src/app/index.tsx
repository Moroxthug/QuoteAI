// "/" decides where a person starts (lib/useGate.ts); it draws nothing itself.
import { Redirect } from "expo-router";
import { View } from "react-native";
import { useGate } from "@/lib/useGate";
import { useTheme } from "@/ui/theme";

export default function Index() {
  const gate = useGate();
  const { colors } = useTheme();
  if (!gate) return <View style={{ flex: 1, backgroundColor: colors.ground }} />;
  return <Redirect href={gate} />;
}
