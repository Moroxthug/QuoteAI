// ForgotPassword.dc.html .fp-rule / .fp-tick: a card (16 / 18 padding, gap 12) of rules, each a
// 20 round tick (ring `line2`; green `ok-dot` with a white check once met) and a 13.5 line that
// goes from `muted` to `ink`. Screen readers hear "done" / "not yet" after the text.
import { View } from "react-native";
import { board } from "@/theme/board";
import { Card } from "./Card";
import { Glyph } from "./Icon";
import { Text } from "./Text";
import { useTheme } from "./theme";

export type RuleItem = { on: boolean; label: string; state: string };

export function PasswordRules({ rules }: { rules: RuleItem[] }) {
  const { colors } = useTheme();
  return (
    <Card style={{ paddingVertical: 16, paddingHorizontal: 18, gap: 12 }}>
      {rules.map((r) => (
        <View key={r.label} accessible accessibilityLabel={`${r.label}, ${r.state}`} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View importantForAccessibility="no-hide-descendants"
            style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: r.on ? colors["ok-dot"] : "transparent", boxShadow: r.on ? undefined : `inset 0 0 0 1.5px ${colors.line2}` }}>
            {r.on ? <Glyph name="check" size={11} weight={3.2} tint={board.white} /> : null}
          </View>
          <Text size={13.5} color={r.on ? "ink" : "muted"}>{r.label}</Text>
        </View>
      ))}
    </Card>
  );
}
