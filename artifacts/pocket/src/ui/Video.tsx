// VideoPlayer.dc.html: the dark stage (whatever the theme), the frame with the illustrated scene and the captions, the overlays (paused, loading, offline), the chaptered scrub bar,
// the transport (captions, back 10, play, forward 10, speed) and a chapter row. Colours are the board's own (board.player).
import { useEffect } from "react";
import type { ReactNode } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { board } from "@/theme/board";
import { Card } from "./Card";
import { Glyph } from "./Icon";
import { Tag } from "./Status";
import { Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

const P = board.player;
export const Stage = ({ children }: { children: ReactNode }) => <View style={{ backgroundColor: P.stage, paddingBottom: 14 }}>{children}</View>;

/** The close button and the title over the stage. */
export function StageHeader({ title, close, onClose }: { title: string; close: string; onClose: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", height: 52, paddingTop: 8, paddingHorizontal: 8 }}>
      <Press onPress={onClose} accessibilityRole="button" accessibilityLabel={close} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}><Glyph name="close" size={20} tint={P.fg} /></Press>
      <Text size={15} weight={600} tracking={-0.02} align="center" numberOfLines={1} tint={P.fg} style={{ flex: 1 }}>{title}</Text>
      <View style={{ width: 44 }} />
    </View>
  );
}

export const PlayIcon = ({ size = 24, color = P.cardInk }: { size?: number; color?: string }) => <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M8 5.5v13l11-6.5z" fill={color} /></Svg>;
export const PauseIcon = ({ size = 24, color = P.cardInk }: { size?: number; color?: string }) => <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" fill={color} /></Svg>;
const Skip = ({ forward }: { forward: boolean }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" style={forward ? { transform: [{ scaleX: -1 }] } : undefined}>
    <Path d="M12 5a7 7 0 1 1-6.6 4.7" fill="none" stroke={P.fg} strokeWidth={1.9} strokeLinecap="round" />
    <Path d="M12 2.2L8.4 5L12 7.8z" fill={P.fg} />
  </Svg>
);

function Bar({ i, h }: { i: number; h: number }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    s.value = withDelay(i * 70, withRepeat(withSequence(withTiming(0.45, { duration: 500 }), withTiming(1, { duration: 500 })), -1));
  }, [i, reduced, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: s.value }] }));
  return <Animated.View style={[{ width: 4, height: h, borderRadius: 3, backgroundColor: P.wave }, style]} />;
}

const WAVE = [10, 18, 26, 14, 22, 8, 20, 26, 12, 18, 24, 10, 16, 22, 8, 14];

/** The frame: the voice card (a name and a waveform), the line card (what is being made) and, over them, the caption and an overlay. */
export function Frame({ label, a, b, c, d, amount, playing, caption, overlay }: { label: string; a: string; b: string; c: string; d: string; amount: string; playing: boolean; caption?: string; overlay?: ReactNode }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={{ height: 236, marginTop: 4, overflow: "hidden", backgroundColor: P.frame }}>
      <View style={{ position: "absolute", left: 22, top: 18, width: 170, borderRadius: 18, backgroundColor: P.card, paddingVertical: 12, paddingHorizontal: 14 }}>
        <Text size={12.5} weight={600} tint={P.cardInk}>{a}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 26, marginTop: 8 }}>{WAVE.map((h, i) => (playing ? <Bar key={i} i={i} h={h} /> : <View key={i} style={{ width: 4, height: h, borderRadius: 3, backgroundColor: P.wave }} />))}</View>
      </View>
      <View style={{ position: "absolute", right: 20, top: 64, width: 196, borderRadius: 18, backgroundColor: P.card, paddingVertical: 12, paddingHorizontal: 14 }}>
        <Text size={11.5} tint={P.cardMuted}>{b}</Text>
        <Text size={13.5} weight={600} tint={P.cardInk} numberOfLines={1} style={{ marginTop: 2 }}>{c}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 4 }}>
          <Text size={11.5} weight={600} tint={P.cardOk}>{d}</Text>
          <Num size={15} weight={600} tint={P.cardInk}>{amount}</Num>
        </View>
      </View>
      {caption ? <View style={{ position: "absolute", left: 20, right: 20, bottom: 14, alignItems: "center" }}><Text size={15} leading={1.7} align="center" tint={board.white} style={{ backgroundColor: P.caption, paddingHorizontal: 8, borderRadius: 6 }}>{caption}</Text></View> : null}
      {overlay}
    </View>
  );
}

export function Overlay({ children, solid }: { children: ReactNode; solid?: boolean }) {
  return <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: solid ? P.frame : P.scrim, padding: 20 }}>{children}</View>;
}
export function BigPlay({ label, onPress }: { label: string; onPress: () => void }) {
  return <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: P.card, alignItems: "center", justifyContent: "center" }}><PlayIcon size={28} /></Press>;
}
export const OverlayText = ({ children, dim }: { children: string; dim?: boolean }) => <Text size={dim ? 13.5 : 15} weight={dim ? 400 : 600} align="center" tint={dim ? P.dim : P.fg}>{children}</Text>;

/** The scrub bar: a segment for each chapter, filled as it plays, with the knob; a tap on a segment goes to its chapter. */
export function Scrub({ fills, labels, onGo, knob, now, max, text, label }: { fills: number[]; labels: string[]; onGo: (i: number) => void; knob: number; now: number; max: number; text: string; label: string }) {
  return (
    <View accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max, now, text }} style={{ flexDirection: "row", gap: 3, height: 20, alignItems: "center", marginTop: 14, marginHorizontal: 20 }}>
      {fills.map((f, i) => (
        <Press key={i} onPress={() => onGo(i)} accessibilityRole="button" accessibilityLabel={labels[i]} hitSlop={{ top: 12, bottom: 12 }} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: P.track, overflow: "hidden" }}>
          <View style={{ width: `${f * 100}%`, height: "100%", backgroundColor: board.white, borderRadius: 2 }} />
        </Press>
      ))}
      <View pointerEvents="none" style={{ position: "absolute", top: 2, left: knob - 8, width: 16, height: 16, borderRadius: 8, backgroundColor: board.white }} />
    </View>
  );
}

/** "0:34 · Check the lines · 1:12". */
export function Times({ pos, chapter, total }: { pos: string; chapter: string; total: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginHorizontal: 20 }}>
      <Num size={12.5} tint={P.dim}>{pos}</Num>
      <Text size={12.5} tint={P.dim} numberOfLines={1} style={{ flexShrink: 1 }}>{chapter}</Text>
      <Num size={12.5} tint={P.dim}>{total}</Num>
    </View>
  );
}

/** A small pill button on the dark stage (CC, the speed). */
export function Pill({ children, on, onPress, label }: { children: ReactNode; on?: boolean; onPress: () => void; label: string }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }} accessibilityLabel={label}
      style={{ height: 36, minWidth: 44, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1.5, borderColor: on ? board.white : P.border, backgroundColor: on ? board.white : "transparent", alignItems: "center", justifyContent: "center" }}>
      {children}
    </Press>
  );
}
export const PillText = ({ children, on }: { children: string; on?: boolean }) => <Text size={12.5} weight={600} tint={on ? P.cardInk : P.fg}>{children}</Text>;

/** The transport: captions, back 10, play or pause, forward 10, speed. */
export function Transport({ cc, ccOn, onCc, speed, onSpeed, playing, onToggle, onBack, onForward, labels }: {
  cc: string; ccOn: boolean; onCc: () => void; speed: string; onSpeed: () => void; playing: boolean; onToggle: () => void; onBack: () => void; onForward: () => void; labels: { play: string; pause: string; back: string; forward: string; speed: string };
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginHorizontal: 12 }}>
      <View style={{ width: 56, alignItems: "center" }}><Pill on={ccOn} onPress={onCc} label={cc}><PillText on={ccOn}>CC</PillText></Pill></View>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 22 }}>
        <Press onPress={onBack} accessibilityRole="button" accessibilityLabel={labels.back} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Skip forward={false} /><Num size={10.5} weight={600} tint={P.fg} style={{ position: "absolute", top: 18 }}>10</Num></Press>
        <Press onPress={onToggle} accessibilityRole="button" accessibilityLabel={playing ? labels.pause : labels.play} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: board.white, alignItems: "center", justifyContent: "center" }}>{playing ? <PauseIcon size={28} /> : <PlayIcon size={28} />}</Press>
        <Press onPress={onForward} accessibilityRole="button" accessibilityLabel={labels.forward} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Skip forward /><Num size={10.5} weight={600} tint={P.fg} style={{ position: "absolute", top: 18 }}>10</Num></Press>
      </View>
      <View style={{ width: 56, alignItems: "center" }}><Pill onPress={onSpeed} label={labels.speed}><Num size={12.5} weight={600} tint={P.fg}>{speed}</Num></Pill></View>
    </View>
  );
}

/** A chapter in the list: its time, its title and where you are in it. */
export function ChapterRow({ first, time, title, current, status, onPress }: { first?: boolean; time: string; title: string; current: boolean; status?: ReactNode; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <View>
      {first ? null : <View style={{ height: 1, backgroundColor: colors.line }} />}
      <Press onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: current }} accessibilityLabel={`${time}, ${title}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 }}>
        <Num size={13.5} color={current ? "acc-t" : "muted"} style={{ width: 36 }}>{time}</Num>
        <Text size={14.5} weight={current ? 600 : 500} style={{ flexGrow: 1, flexShrink: 1 }}>{title}</Text>
        {status}
      </Press>
    </View>
  );
}

/** Under the stage: the topic tag and the length, a 21 title and a line about it. */
export function VideoInfo({ topic, length, title, sub }: { topic: string; length: string; title: string; sub: string }) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Tag accent>{topic}</Tag><Num size={12.5} color="muted">{length}</Num></View>
      <Text size={21} weight={600} tracking={-0.03} style={{ marginTop: 10 }} accessibilityRole="header">{title}</Text>
      <Text size={14.5} color="muted" leading={1.45} style={{ marginTop: 6 }}>{sub}</Text>
    </View>
  );
}

/** A card with its content spaced by 12 (the speed and the captions). */
export function SettingsCard({ children }: { children: ReactNode }) {
  return <Card padded style={{ gap: 12 }}>{children}</Card>;
}

/** "Speed" and the current speed on one line. */
export function SpeedLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text size={14.5} weight={500}>{label}</Text>
      <Num size={13.5} color="muted">{value}</Num>
    </View>
  );
}
