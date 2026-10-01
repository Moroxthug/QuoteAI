// Schedule.dc.html's own pieces.
// WeekStrip (.wkst): a card (radius 18, padding 4) of seven 60 tall days; the chosen day is an `inv` pill (radius 14) that slides across (.5 s, `out`);
// the weekday 11.5/500 at 75 %, the date Num 17/600, weekends in `faint`, a 5 `bad` dot at the bottom of a day with a clash.
// Lane (.lane): a card, padding 14 16 8: avatar 34 (or a 10×34 colour bar for a job), the title 14.5/600 and a muted line, the hours Num 14.5/600; a track (8 tall,
// radius 8, `sunk`, 12 above and 6 below) from 7:00 to 18:00 with the blocks drawn on it (the clash part in `bad`); then the blocks, "Free" gaps, "Nothing booked".
// BlockHead (.brow): min 52, a 4 wide colour bar, the title 14.5/500 and "time · what" 12.5 muted, a Clash pill; the chevron is added by the card.
// FreeRow (.free): min 48, radius 12, a 1 `line2` ring, "Free 12:00 – 16:00" and a small Book button.
// PickRow (.pick): a 48 tall field-like button (radius 13, `card`, a 1 `line2` ring) with a leading mark, the value 15 and a muted right-hand word.
// TimeStepper (.tstep): 48 tall, radius 13, a ring, a 40 button on each side and the time Num 15/500 between.
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { Avatar, type AvatarTint } from "./Avatar";
import { Button } from "./Button";
import { Card } from "./Card";
import { Glyph } from "./Icon";
import { easing, Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme, type ColorName } from "./theme";

const OUT = easing("out");

export function WeekStrip({ days, current, onPick, label }: { days: { weekday: string; n: string; weekend: boolean; clash: boolean }[]; current: number; onPick: (i: number) => void; label: string }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const cell = Math.max(0, (w - 8) / 7);
  const x = useSharedValue(current);
  useEffect(() => { x.value = withTiming(current, { duration: reduced ? 0 : 500, easing: OUT }); }, [current, reduced, x]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * cell }] }));
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", padding: 4, borderRadius: 18, backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.ring}` }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 4, left: 4, height: 60, width: cell, borderRadius: 14, backgroundColor: colors.inv }, slide]} />
      {days.map((d, i) => {
        const on = i === current;
        const fg: ColorName = on ? "on-inv" : d.weekend ? "faint" : "ink";
        return (
          <Press key={i} onPress={() => onPick(i)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${d.weekday} ${d.n}`} style={{ flex: 1, height: 60, alignItems: "center", justifyContent: "center", gap: 3 }}>
            <Text size={11.5} weight={500} color={fg} opacity={0.75}>{d.weekday}</Text>
            <Num size={17} weight={600} tracking={-0.02} color={fg}>{d.n}</Num>
            {d.clash && !on ? <View style={{ position: "absolute", bottom: 6, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.bad }} /> : null}
          </Press>
        );
      })}
    </View>
  );
}

export function Track({ segs }: { segs: { from: number; to: number; color: ColorName }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 8, borderRadius: 8, backgroundColor: colors.sunk, marginTop: 12, marginBottom: 6, overflow: "hidden" }}>
      {segs.map((s, i) => <View key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${s.from}%`, width: `${Math.max(0, s.to - s.from)}%`, borderRadius: 8, backgroundColor: colors[s.color], opacity: s.color === "bad" ? 1 : 0.85 }} />)}
    </View>
  );
}

export function LaneCard({ person, job, title, sub, hours, segs, children }: {
  person?: { initials: string; tint: AvatarTint }; job?: { color: ColorName }; title: string; sub?: string; hours?: string; segs: { from: number; to: number; color: ColorName }[]; children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 8, overflow: "visible" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {person ? <Avatar initials={person.initials} tint={person.tint} size={34} /> : null}
        {job ? <View style={{ width: 10, height: 34, borderRadius: 5, backgroundColor: colors[job.color] }} /> : null}
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 1 }}>
          <Text size={14.5} weight={600} numberOfLines={1}>{title}</Text>
          {sub ? <Text size={12.5} color="muted" numberOfLines={1}>{sub}</Text> : null}
        </View>
        {hours ? <Num size={14.5} weight={600}>{hours}</Num> : null}
      </View>
      <Track segs={segs} />
      {children}
    </Card>
  );
}

export function BlockHead({ color, title, time, sub, clash }: { color: ColorName; title: string; time: string; sub?: string; clash?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 6 }}>
      <View style={{ width: 4, alignSelf: "stretch", borderRadius: 4, marginVertical: 4, backgroundColor: colors[color] }} />
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{title}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{sub ? `${time} · ${sub}` : time}</Text>
      </View>
      {clash}
    </View>
  );
}

export function FreeRow({ label, time, action, onPress }: { label: string; time: string; action: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingRight: 4, paddingLeft: 12, marginVertical: 6, borderRadius: 12, boxShadow: `inset 0 0 0 1px ${colors.line2}` }}>
      <Text size={13.5} color="muted" style={{ flexGrow: 1 }}>{label}<Num size={13.5} weight={400} color="t2">{` ${time}`}</Num></Text>
      <Button kind="secondary" size="sm" label={action} onPress={onPress} />
    </View>
  );
}

export function PickRow({ lead, value, hint, onPress, label }: { lead?: ReactNode; value: string; hint?: string; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ${value}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingLeft: 14, paddingRight: 12, borderRadius: 13, backgroundColor: colors.card, boxShadow: `0 0 0 1px ${colors.line2}` }}>
      {lead}
      <Text size={15} numberOfLines={1} style={{ flexGrow: 1, flexShrink: 1 }}>{value}</Text>
      {hint ? <Text size={12.5} color="muted" numberOfLines={1}>{hint}</Text> : null}
    </Press>
  );
}

export function TimeStepper({ label, value, decLabel, incLabel, onDec, onInc }: { label: string; value: string; decLabel: string; incLabel: string; onDec: () => void; onInc: () => void }) {
  const { colors } = useTheme();
  const btn = (glyph: "minus" | "plus", l: string, on: () => void) => (
    <Press onPress={on} accessibilityRole="button" accessibilityLabel={l} style={{ width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" }}><Glyph name={glyph} size={14} weight={2.2} /></Press>
  );
  return (
    <View accessibilityLabel={`${label} ${value}`} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 48, borderRadius: 13, paddingHorizontal: 4, boxShadow: `0 0 0 1px ${colors.line2}` }}>
      {btn("minus", decLabel, onDec)}
      <Num size={15} weight={500}>{value}</Num>
      {btn("plus", incLabel, onInc)}
    </View>
  );
}
