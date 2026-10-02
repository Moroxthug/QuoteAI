// COMPONENTS §20 and the Status section of Components.dc.html. Status = word + colour + shape.
// Status: 24 tall, radius 999, padding 0 9 0 7, gap 5, 11.5/600 (−0.005em); a 12 shape in the
// text colour on the left (the board's .st::before). The colour says how it feels (tone), the shape
// says where it is in the flow (tokens.json → status.shapes). Plain: no background, no padding,
// 18 tall, for dense rows and headers. The word always shows and is what a screen reader hears.
// Tag (roles and labels, not states): 24 tall, radius 8, padding 0 9, 11.5/600, `sunk` / `t2`;
// the accent tag is `acc-soft` / `acc-soft-t`.
import { useEffect, useId } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Mask, Path, Rect } from "react-native-svg";
import { board } from "@/theme/board";
import { easing } from "./motion";
import { Text } from "./Text";
import { useTheme, type ColorName, type Colors } from "./theme";

export type StatusTone = "ok" | "warn" | "bad" | "acc" | "info" | "mute";
export type StatusShape = "draft" | "q1" | "q2" | "q3" | "check" | "live" | "clock" | "pause" | "alert" | "x" | "off" | "dot";

/** Each tone's own shape when none is given (.st-ok, .st-warn … without an si- class). */
const TONE_SHAPE: Record<StatusTone, StatusShape> = { ok: "check", warn: "clock", bad: "alert", acc: "q2", info: "q1", mute: "draft" };

const TONE_TEXT: Record<StatusTone, ColorName> = { ok: "ok", warn: "warn", bad: "bad", acc: "acc-soft-t", info: "info", mute: "muted" };

function toneFill(tone: StatusTone, colors: Colors): string {
  switch (tone) {
    case "ok": return colors["ok-soft"];
    case "warn": return board.warnSoft;
    case "bad": return colors["bad-soft"];
    case "acc": return colors["acc-soft"];
    case "info": return colors["info-soft"];
    case "mute": return colors.sunk;
  }
}

const RING = { cx: 12, cy: 12, r: 9.2, fill: "none", strokeWidth: 3 } as const;
const PIE = {
  q1: "M12 12V6.2A5.8 5.8 0 0 1 17.8 12Z",
  q2: "M12 6.2A5.8 5.8 0 0 1 12 17.8Z",
  q3: "M12 12V6.2A5.8 5.8 0 1 1 6.2 12Z",
} as const;
/** The cut-outs of the solid shapes: a disc (r 11) with the mark punched through. */
const CUT = {
  check: <Path d="M7.4 12.4l3.1 3.1 6.1-6.4" fill="none" stroke={board.maskCut} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />,
  alert: (<><Path d="M12 6.8v6.4" fill="none" stroke={board.maskCut} strokeWidth={3} strokeLinecap="round" /><Circle cx={12} cy={17} r={1.7} fill={board.maskCut} /></>),
  x: <Path d="M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" fill="none" stroke={board.maskCut} strokeWidth={3} strokeLinecap="round" />,
} as const;

/** The 12 shapes, drawn as the board's mask SVGs (viewBox 24) in one colour. */
export function StatusShapeIcon({ shape, color, size = 12 }: { shape: Exclude<StatusShape, "live">; color: string; size?: number }) {
  const id = useId().replace(/:/g, "");
  let body: React.ReactNode;
  if (shape === "check" || shape === "alert" || shape === "x") {
    body = (
      <>
        <Defs>
          <Mask id={id} x="0" y="0" width="24" height="24" maskUnits="userSpaceOnUse">
            <Rect width={24} height={24} fill={board.maskKeep} />
            {CUT[shape]}
          </Mask>
        </Defs>
        <Circle cx={12} cy={12} r={11} fill={color} mask={`url(#${id})`} />
      </>
    );
  } else if (shape === "dot") {
    body = <Circle cx={12} cy={12} r={5.5} fill={color} />;
  } else if (shape === "draft") {
    body = <Circle {...RING} stroke={color} strokeDasharray="3.6 3.6" />;
  } else {
    body = (
      <>
        <Circle {...RING} stroke={color} />
        {shape === "q1" || shape === "q2" || shape === "q3" ? <Path d={PIE[shape]} fill={color} /> : null}
        {shape === "clock" ? <Path d="M12 7.4V12l3 2" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {shape === "pause" ? (<><Rect x={8.6} y={8} width={2.4} height={8} rx={1} fill={color} /><Rect x={13} y={8} width={2.4} height={8} rx={1} fill={color} /></>) : null}
        {shape === "off" ? <Path d="M6.3 17.7L17.7 6.3" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" /> : null}
      </>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      {body}
    </Svg>
  );
}

/** "Happening now": a 7 dot (margin 2.5) with a ring that spreads 5 pt and fades, every 2.2 s. */
function LiveDot({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    // The board's keyframes: spread 0 → 5 over the first 70 % (out easing), then rest.
    t.value = withRepeat(withSequence(withTiming(1, { duration: 1540, easing: easing("out") }), withDelay(660, withTiming(0, { duration: 0, easing: Easing.linear }))), -1);
  }, [reduced, t]);
  const ring = useAnimatedStyle(() => ({ opacity: t.value === 0 ? 0 : 1 - t.value, transform: [{ scale: 1 + (t.value * 10) / 7 }] }));
  return (
    <View style={{ width: 7, height: 7, marginHorizontal: 2.5 }}>
      {reduced ? null : <Animated.View style={[{ position: "absolute", width: 7, height: 7, borderRadius: 4, backgroundColor: color }, ring]} />}
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

export function Status({ tone, shape, children, plain }: { tone: StatusTone; shape?: StatusShape; children: string; plain?: boolean }) {
  const { colors } = useTheme();
  const text = TONE_TEXT[tone];
  const s = shape ?? TONE_SHAPE[tone];
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={children}
      style={{
        flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, borderRadius: 999,
        minHeight: plain ? 18 : 24, paddingLeft: plain ? 0 : 7, paddingRight: plain ? 0 : 9,
        backgroundColor: plain ? "transparent" : toneFill(tone, colors),
      }}>
      {s === "live" ? <LiveDot color={colors[text]} /> : <StatusShapeIcon shape={s} color={colors[text]} />}
      <Text size={11.5} weight={600} tracking={-0.005} color={text} numberOfLines={1}>{children}</Text>
    </View>
  );
}

export function Tag({ children, accent, onCard }: { children: string; accent?: boolean; /** On a `sunk` box the tag takes the card colour (the assistant's "It will text" label). */ onCard?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignSelf: "flex-start", justifyContent: "center", minHeight: 24, paddingHorizontal: 9, borderRadius: 8, backgroundColor: accent ? colors["acc-soft"] : onCard ? colors.card : colors.sunk }}>
      <Text size={11.5} weight={600} color={accent ? "acc-soft-t" : "t2"} numberOfLines={1}>{children}</Text>
    </View>
  );
}
