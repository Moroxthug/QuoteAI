// The pieces of the weather on Home (SmartHome.dc.html: .rainrow, the Site weather sheet, the This week strip; WEATHER.md): the 8 hourly rain bars that grow in one after another, the skeleton, a site's block
// with its six two-hour slots, the 7-day strip with rain drops, and the attribution line. Layout and numbers are the board's; the data comes from lib/weather.ts.
import { useEffect, type ReactNode } from "react";
import { Image, Linking, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { type Attribution as Attr } from "@/lib/weather";
import { board } from "@/theme/board";
import { Skeleton } from "./Feedback";
import { Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

const GROW = Easing.bezier(0.16, 1, 0.3, 1);

function Bar({ height, opacity, index }: { height: number; opacity: number; index: number }) {
  const reduced = useReducedMotion();
  const g = useSharedValue(reduced ? 1 : 0);
  useEffect(() => { if (!reduced) g.value = withDelay(index * 50, withTiming(1, { duration: 1000, easing: GROW })); }, [reduced, index, g]);
  const st = useAnimatedStyle(() => ({ transform: [{ scaleY: g.value }] }));
  return <Animated.View style={[{ height, width: "100%", borderRadius: 4, backgroundColor: board.rain, opacity, transformOrigin: "bottom" }, st]} />;
}

/** `.rainrow`: 48 tall, 6 apart; each column a bar (height from the chance, opacity .25 to 1, growing in 50 ms after the one before) over its hour in Manrope 10.5. */
export function RainBars({ bars, label }: { bars: { label: string; height: number; opacity: number; prob: number }[]; label: (b: { label: string; prob: number }) => string }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-end", height: 48, marginTop: 10 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {bars.map((b, i) => (
        <View key={i} accessibilityLabel={label(b)} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4, height: "100%" }}>
          <Bar height={b.height} opacity={b.opacity} index={i} />
          <Num size={10.5} color="faint">{b.label}</Num>
        </View>
      ))}
    </View>
  );
}

/** First load: a number block and 8 bar stubs. */
export function WeatherSkeleton({ a11y }: { a11y: string }) {
  return (
    <View accessibilityLabel={a11y} accessibilityRole="progressbar" style={{ marginTop: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Skeleton width={96} height={36} radius={10} />
        <Skeleton width={34} height={34} radius={17} />
      </View>
      <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-end", height: 48, marginTop: 10 }}>
        {[10, 12, 16, 22, 30, 34, 26, 18].map((h, i) => <View key={i} style={{ flex: 1 }}><Skeleton height={h} radius={4} /></View>)}
      </View>
    </View>
  );
}

/** A site in the open widget: its name and area, the temperature and the day in words, six two-hour slots (50 % or more tinted) and one practical note. */
export function SiteBlock({ name, area, temp, summary, slots, note, slotLabel, crew }: {
  name: string; area: string; temp: string; summary: string; slots: { label: string; temp: string; rain: number; wet: boolean }[]; note?: string; slotLabel: (s: { label: string; temp: string; rain: number }) => string; crew?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 22, boxShadow: `0 0 0 1px ${colors.ring}`, padding: 16, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flexShrink: 1, gap: 2 }}>
          <Text size={14.5} weight={500}>{name}</Text>
          <Text size={12.5} color="muted">{[area, crew].filter(Boolean).join(" · ")}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Num size={28} weight={600} tracking={-0.04} leading={1}>{temp}</Num>
          <Text size={12.5} color="muted">{summary}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 4, marginTop: 14 }}>
        {slots.map((s) => (
          <View key={s.label} accessible accessibilityLabel={slotLabel(s)} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 5, paddingVertical: 8, borderRadius: 12, backgroundColor: s.wet ? colors["info-soft"] : colors.ground }}>
            <Num size={11.5} color="muted">{s.label}</Num>
            <Num size={14.5} weight={600}>{s.temp}</Num>
            <Num size={11.5} weight={s.wet ? 600 : 400} color={s.wet ? "info" : "faint"}>{`${s.rain}%`}</Num>
          </View>
        ))}
      </View>
      {note ? <Text size={12.5} color="t2" style={{ marginTop: 12 }}>{note}</Text> : null}
    </View>
  );
}

/** A drop, as the 7-day strip draws it on a rain day (and the header's). */
function Drop() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill={board.rain}>
      <Path d="M12 3.5c3.3 4.2 6 7.3 6 10.7a6 6 0 0 1-12 0c0-3.4 2.7-6.5 6-10.7z" />
    </Svg>
  );
}

/** The 7-day strip: weekday, date, up to 3 visit dots, a drop when it rains; today on `acc-soft`. */
export function WeekStrip({ days, a11y }: { days: { dow: string; date: number; dots: number; rain: boolean; today: boolean; iso: string; visits: number }[]; a11y: (d: { iso: string; rain: boolean; dots: number; visits: number }) => string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 4, marginTop: 12 }}>
      {days.map((d) => (
        <View key={d.iso} accessible accessibilityLabel={a11y(d)} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 4, paddingTop: 7, paddingBottom: 8, borderRadius: 12, backgroundColor: d.today ? colors["acc-soft"] : colors.sunk }}>
          <Text size={10.5} weight={d.today ? 600 : 400} color={d.today ? "acc-soft-t" : "muted"} numberOfLines={1}>{d.dow}</Text>
          <Num size={15} weight={600}>{String(d.date)}</Num>
          <View style={{ flexDirection: "row", gap: 2, height: 5, alignItems: "center" }}>
            {Array.from({ length: d.dots }, (_, i) => <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.ink }} />)}
          </View>
          <View style={{ height: 12 }}>{d.rain ? <Drop /> : null}</View>
        </View>
      ))}
    </View>
  );
}

/** Under the last site of the open widget (and in Settings, About): who the weather is from. Apple's own mark when it sends one, a link to the legal page. */
export function WeatherAttribution({ attribution, legal, text, dark }: { attribution: Attr; legal: string; text: ReactNode; dark: boolean }) {
  const logo = dark ? attribution.logoDarkUrl : attribution.logoLightUrl;
  return (
    <View style={{ gap: 4, marginTop: 4, marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {logo ? <Image source={{ uri: logo }} resizeMode="contain" style={{ height: 14, width: 60 }} accessibilityLabel={attribution.name} /> : text}
      </View>
      <Press onPress={() => void Linking.openURL(attribution.legalUrl)} accessibilityRole="link" accessibilityLabel={legal} hitSlop={8}>
        <Text size={11.5} color="muted" style={{ textDecorationLine: "underline" }}>{legal}</Text>
      </Press>
    </View>
  );
}
