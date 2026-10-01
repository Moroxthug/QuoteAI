// Verify.dc.html pieces under the boxes: the 44-tall message line (.vf-msg, 13.5) and the
// resend / different-email links (14.5, 44 tall).
import type { ReactNode } from "react";
import { View } from "react-native";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Text } from "./Text";
import type { ColorName } from "./theme";

export function VerifyMessage({ children }: { children?: ReactNode }) {
  return <View style={{ minHeight: 44, alignItems: "center", justifyContent: "center", paddingTop: 14 }}>{children}</View>;
}

export function VerifyOk({ label }: { label: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Glyph name="check" size={16} color="ok" />
      <Text size={13.5} weight={600} color="ok">{label}</Text>
    </View>
  );
}

export function VerifyWait({ label }: { label: string }) {
  return <Text size={14.5} color="muted" style={{ paddingVertical: 12 }}>{label}</Text>;
}

export function VerifyLink({ label, onPress, strong, color = "muted", role = "button" }: { label: string; onPress: () => void; strong?: boolean; color?: ColorName; role?: "button" | "link" }) {
  return (
    <Press onPress={onPress} accessibilityRole={role} accessibilityLabel={label} style={{ minHeight: 44, paddingHorizontal: 4, justifyContent: "center" }}>
      <Text size={14.5} weight={strong ? 600 : 400} color={color}>{label}</Text>
    </Press>
  );
}
