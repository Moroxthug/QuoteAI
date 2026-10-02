// A pad to draw a signature with a finger: strokes become SVG path data in a 330 x 92 box (Profile → Signature for quotes). The baseline is drawn under it,
// as on the board.
import { useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { useTheme } from "./theme";

export const SIG_W = 330;
export const SIG_H = 92;

/** Draws saved signature path data (or nothing) with its baseline, at the width it is given. */
export function SignatureView({ d, label, width = SIG_W }: { d: string; label: string; width?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={width} height={(width * SIG_H) / SIG_W} viewBox={`0 0 ${SIG_W} ${SIG_H}`} accessibilityRole="image" accessibilityLabel={label}>
      <Line x1={18} y1={70} x2={312} y2={70} stroke={colors.line2} strokeWidth={1} />
      {d ? <Path d={d} fill="none" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </Svg>
  );
}

/** The drawing surface: `value` is the path so far, `onChange` gets it as strokes are drawn. */
export function SignaturePad({ value, onChange, label }: { value: string; onChange: (d: string) => void; label: string }) {
  const [w, setW] = useState(SIG_W);
  const d = useRef(value);
  d.current = value;
  const scale = SIG_W / w;
  const pt = (x: number, y: number) => `${(x * scale).toFixed(1)} ${(y * scale).toFixed(1)}`;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => onChange(`${d.current}M${pt(e.nativeEvent.locationX, e.nativeEvent.locationY)}`),
      onPanResponderMove: (e) => onChange(`${d.current}L${pt(e.nativeEvent.locationX, e.nativeEvent.locationY)}`),
    }),
  );
  return (
    <View accessible accessibilityLabel={label} onLayout={(e) => setW(Math.max(1, e.nativeEvent.layout.width))} {...pan.current.panHandlers}>
      <SignatureView d={value} label={label} width={w} />
    </View>
  );
}
