// Feedback.dc.html: the 148 x 300 screenshot with what was drawn on it in red (and, while "Mark up" is on, a layer that takes the finger), the tools beside it, and the done screen's
// green ring. Strokes are kept as points in 0 to 1 (lib/feedback.ts) so they fit at any size.
import { useMemo, useRef, useState } from "react";
import { Image, PanResponder, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Glyph, Icon } from "./Icon";
import { Press } from "./motion";
import { Text } from "./Text";
import { useTheme } from "./theme";
import { pathOf, pointAt, type Stroke } from "@/lib/feedback";

export const SHOT_W = 148;
export const SHOT_H = 300;

/** The screenshot, the strokes over it, and (when `drawing`) a layer that adds a stroke for each drag. */
export function ShotPane({ uri, strokes, drawing, onStroke, label, empty }: { uri: string | null; strokes: Stroke[]; drawing: boolean; onStroke: (s: Stroke) => void; label: string; empty: string }) {
  const { colors } = useTheme();
  const live = useRef<Stroke>([]);
  const [now, setNow] = useState<Stroke>([]);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => drawing,
    onMoveShouldSetPanResponder: () => drawing,
    onPanResponderGrant: (e) => { live.current = [pointAt(e.nativeEvent.locationX, e.nativeEvent.locationY, SHOT_W, SHOT_H)]; setNow(live.current); },
    onPanResponderMove: (e) => { live.current = [...live.current, pointAt(e.nativeEvent.locationX, e.nativeEvent.locationY, SHOT_W, SHOT_H)]; setNow(live.current); },
    onPanResponderRelease: () => { if (live.current.length) onStroke(live.current); live.current = []; setNow([]); },
    onPanResponderTerminate: () => { live.current = []; setNow([]); },
  }), [drawing, onStroke]);
  return (
    <View accessible accessibilityLabel={label} style={{ width: SHOT_W, height: SHOT_H, borderRadius: 22, overflow: "hidden", backgroundColor: colors.card, borderWidth: uri ? 0 : 1.5, borderColor: colors.line2, alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 0 }}>
      {uri ? (
        <>
          <Image source={{ uri }} style={{ width: SHOT_W, height: SHOT_H }} resizeMode="cover" accessibilityIgnoresInvertColors />
          <View style={{ position: "absolute", top: 0, left: 0, width: SHOT_W, height: SHOT_H }} pointerEvents={drawing ? "auto" : "none"} {...pan.panHandlers}>
            <Svg width={SHOT_W} height={SHOT_H}>
              {[...strokes, now].map((s, i) => <Path key={i} d={pathOf(s, SHOT_W, SHOT_H)} fill="none" stroke={colors.bad} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />)}
            </Svg>
          </View>
        </>
      ) : (
        <>
          <Glyph name="photo" size={26} color="faint" />
          <Text size={12.5} color="muted">{empty}</Text>
        </>
      )}
    </View>
  );
}

/** A tool beside the screenshot: a glyph and a word on `sunk` (`acc-soft` while it is on). */
export function ToolButton({ icon, tone, label, on, onPress, disabled }: { icon: "pen" | "sync" | "photo"; tone: "violet" | "slate" | "azure"; label: string; on?: boolean; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: !!on, disabled: !!disabled }} accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: on ? colors["acc-soft"] : colors.sunk, opacity: disabled ? 0.45 : 1 }}>
      <Icon name={icon} tone={tone} size={22} />
      <Text size={13.5} weight={500} color={on ? "acc-soft-t" : "ink"} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Text>
    </Press>
  );
}

/** The 88 round `ok-soft` ring of the done screen, with the glyph given in it. */
export function DoneRing({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors["ok-soft"], alignItems: "center", justifyContent: "center" }}>{children}</View>;
}

/** The done screen's top: the ring, a 28 title and a 15 muted paragraph, centred. */
export function DoneHead({ ring, title, text }: { ring: React.ReactNode; title: string; text: string }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 96, paddingHorizontal: 28 }}>
      {ring}
      <Text size={28} weight={600} tracking={-0.04} align="center" style={{ marginTop: 22 }} accessibilityRole="header">{title}</Text>
      <Text size={15} color="muted" leading={1.5} align="center" style={{ marginTop: 10, maxWidth: 300 }}>{text}</Text>
    </View>
  );
}

/** The screenshot on the left and its tools (with a hint line) on the right. */
export function ShotRow({ pane, tools, hint }: { pane: React.ReactNode; tools: React.ReactNode; hint: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
      {pane}
      <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 8 }}>
        {tools}
        <Text size={12.5} color="muted" leading={1.45} style={{ marginTop: 4 }}>{hint}</Text>
      </View>
    </View>
  );
}

/** "From Job · quoteAI 2.4.0" under the switches. */
export function FromLine({ children }: { children: string }) {
  return <Text size={12.5} color="faint" style={{ marginHorizontal: 4, marginTop: 10 }}>{children}</Text>;
}

/** The done screen's lower part: a card of facts, then the buttons, with a gap above each. */
export function DoneBody({ facts, actions }: { facts: React.ReactNode; actions: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 28 }}>
      <View style={{ marginTop: 26 }}>{facts}</View>
      <View style={{ marginTop: 26, gap: 6 }}>{actions}</View>
    </View>
  );
}
