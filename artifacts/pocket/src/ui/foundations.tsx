// /sandbox/foundations (phase 123.2): the type scale, the digit rule, every icon in every tone,
// and the light grounds. Not a board of its own; it checks the foundations the boards use.
import { Pressable, View } from "react-native";
import { tokens, type GroundName } from "@/theme/tokens";
import icons from "@/theme/icons.json";
import tones from "@/theme/tones.json";
import { Icon, type IconName, type Tone } from "./Icon";
import { Num, Text } from "./Text";
import { colorsFor, useTheme } from "./theme";
import type { Weight } from "./fonts";

export function TypeScale({ sample }: { sample: string }) {
  const weights: Weight[] = [400, 500, 600];
  return (
    <View style={{ paddingHorizontal: 20, gap: 10 }}>
      {tokens.type.scale.map((s) => (
        <View key={s} style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
          <Num size={11.5} weight={500} color="muted" style={{ width: 32 }}>{s}</Num>
          <View style={{ flex: 1, gap: 2 }}>
            {weights.map((w) => (
              <Text key={w} size={s} weight={w} numberOfLines={1}>{sample}</Text>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function IconSheet() {
  const names = Object.keys(icons.glyphs) as IconName[];
  const toneNames = Object.keys(tones) as Tone[];
  return (
    <View style={{ paddingHorizontal: 16, gap: 14 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {names.map((n) => (
          <View key={n} style={{ width: 52, alignItems: "center", gap: 4 }}>
            <Icon name={n} size={28} />
            <Text size={10.5} color="muted" numberOfLines={1}>{n}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {toneNames.map((t) => (
          <View key={t} style={{ width: 52, alignItems: "center", gap: 4 }}>
            <Icon name="house" tone={t} size={30} />
            <Text size={10.5} color="muted" numberOfLines={1}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function GroundPicker() {
  const { ground, setGround, colors } = useTheme();
  const names = Object.keys(tokens.ground.options) as GroundName[];
  return (
    <View style={{ paddingHorizontal: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {names.map((g) => {
        const c = colorsFor("light", g);
        const on = g === ground;
        return (
          <Pressable key={g} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={g} onPress={() => setGround(g)}
            style={{ width: 80, height: 64, borderRadius: 18, backgroundColor: c.ground, justifyContent: "flex-end", padding: 8, borderWidth: on ? 2 : 1, borderColor: on ? colors.ink : colors.line2 }}>
            <Text size={11.5} weight={on ? 600 : 500} style={{ color: c.ink }}>{g}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
