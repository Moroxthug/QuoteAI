// JoinCode.dc.html (.jc-wrap / .jc-box / .jc-sep): the access code as boxes, 60 tall, radius 15, Manrope
// 24/600, a 10×2 dash between the halves (XXXXX-XXXXX). The next box to fill has a 1.5 `acc` ring, a 5
// `acc-soft` halo and a blinking caret; a wrong code turns every box `bad` and shakes the row once.
// One real input sits over the boxes so the keyboard, paste and autofill all land in it.
import { useEffect, useRef } from "react";
import { Platform, TextInput, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { CODE_HALF, CODE_LENGTH } from "@/lib/joinCode";
import { noOutline } from "./Field";
import { Num } from "./Text";
import { useTheme } from "./theme";

export type BoxesState = "typing" | "checking" | "bad";

function Caret() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.value = withRepeat(withSequence(withDelay(500, withTiming(0, { duration: 0 })), withDelay(500, withTiming(1, { duration: 0 }))), -1);
    return () => cancelAnimation(o);
  }, [reduced, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 2, height: 24, borderRadius: 2, backgroundColor: colors.acc }, style]} />;
}

export function JoinBoxes({ label, value, onChange, state, shakeKey, autoFocus }: {
  label: string; value: string; onChange: (raw: string) => void; state: BoxesState;
  /** Changes each time the row should shake (a code the server refused). */
  shakeKey: number; autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const input = useRef<TextInput>(null);
  const x = useSharedValue(0);
  useEffect(() => {
    if (!shakeKey || reduced) return;
    // .jc-shake: 450 ms, left 6 / right 6 four times, then rest.
    x.value = withSequence(withTiming(-6, { duration: 90 }), withTiming(6, { duration: 90 }), withTiming(-6, { duration: 90 }), withTiming(6, { duration: 90 }), withTiming(0, { duration: 90 }));
  }, [shakeKey, reduced, x]);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const bad = state === "bad";
  const box = (i: number) => {
    const active = !bad && state === "typing" && i === value.length;
    const ring = bad ? `0 0 0 1.5px ${colors.bad}` : active ? `0 0 0 1.5px ${colors.acc}, 0 0 0 5px ${colors["acc-soft"]}` : `0 0 0 1px ${colors.line2}`;
    return (
      <View key={i} style={{ flex: 1, minWidth: 0, height: 60, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: bad ? colors["bad-soft"] : colors.card, boxShadow: ring }}>
        {value[i] ? <Num size={24} weight={600} color={bad ? "bad" : "ink"}>{value[i]}</Num> : active ? <Caret /> : null}
      </View>
    );
  };
  const cells = [];
  for (let i = 0; i < CODE_LENGTH; i++) {
    if (i === CODE_HALF) cells.push(<View key="sep" style={{ width: 10, height: 2, borderRadius: 2, backgroundColor: colors.line2, flexShrink: 0 }} />);
    cells.push(box(i));
  }
  return (
    <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, shake]}>
      {cells}
      <TextInput
        ref={input}
        value={value}
        onChangeText={onChange}
        maxLength={CODE_LENGTH + 4}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        editable={state !== "checking"}
        autoFocus={autoFocus}
        caretHidden
        accessibilityLabel={label}
        aria-invalid={bad}
        style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: "transparent", fontSize: 16, cursor: Platform.OS === "web" ? "text" : undefined } as object, noOutline]}
      />
    </Animated.View>
  );
}
