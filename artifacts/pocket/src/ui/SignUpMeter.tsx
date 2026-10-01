// SignUp.dc.html .su-meter: four 4-tall bars (96 wide, gap 4) that fill bad / warn / ok with the
// password's strength, then the word (600, in the same tone) and the note, 12.5 muted.
import { View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "./theme";

export function SignUpMeter({ level, word, note }: { level: 0 | 1 | 2 | 3 | 4; word: string; note: string }) {
  const { colors } = useTheme();
  const fill = level === 1 ? colors.bad : level === 2 ? colors["warn-dot"] : colors["ok-dot"];
  const tone = level === 1 ? "bad" : level === 2 ? "warn" : level >= 3 ? "ok" : "muted";
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, paddingHorizontal: 4, minHeight: 32 }}>
      <View importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", gap: 4, width: 96 }}>
        {[1, 2, 3, 4].map((n) => (
          <View key={n} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: n <= level ? fill : colors.line2 }} />
        ))}
      </View>
      <Text size={12.5} leading={1.35} color="muted" style={{ flex: 1 }}>
        {word ? <Text size={12.5} leading={1.35} weight={600} color={tone}>{`${word} `}</Text> : null}
        {note}
      </Text>
    </View>
  );
}

/** .su-terms: 12.5 muted, centred, 1.5 leading, padding 0 12; the two names are underlined links. */
export function SignUpTerms({ lead, terms, and, privacy, onTerms, onPrivacy }: { lead: string; terms: string; and: string; privacy: string; onTerms: () => void; onPrivacy: () => void }) {
  return (
    <Text size={12.5} color="muted" align="center" leading={1.5} style={{ paddingHorizontal: 12 }}>
      {`${lead} `}
      <Text size={12.5} color="t2" accessibilityRole="link" onPress={onTerms} style={{ textDecorationLine: "underline" }}>{terms}</Text>
      {` ${and} `}
      <Text size={12.5} color="t2" accessibilityRole="link" onPress={onPrivacy} style={{ textDecorationLine: "underline" }}>{privacy}</Text>
      .
    </Text>
  );
}
