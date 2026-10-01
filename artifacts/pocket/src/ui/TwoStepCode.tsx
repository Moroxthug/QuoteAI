// TwoStep.dc.html .ts-wrap / .ts-box: six 60 tall boxes (radius 15, Manrope 24/600) with a 10×2
// dash after the third. The next box to fill gets the 1.5 `acc` ring and 5 `acc-soft` halo; a wrong
// code turns every box `bad` and shakes them (.45 s); a right one turns them `ok`; a locked field
// fades to .45. One real input lies over the boxes (keyboard, paste, autofill).
import { useEffect, useRef } from "react";
import { Platform, TextInput, View, type TextStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { Num } from "./Text";
import { useTheme } from "./theme";
import type { ColorName } from "./theme";

export type CodeState = "typing" | "wrong" | "ok" | "locked";

const noOutline = Platform.OS === "web" ? ({ outlineWidth: 0 } satisfies TextStyle) : null;

export function TwoStepCode({ label, value, onChange, state = "typing", disabled, autoFocus, length = 6 }: {
  label: string; value: string; onChange: (v: string) => void; state?: CodeState; disabled?: boolean; autoFocus?: boolean; length?: number;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const shake = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; if (state !== "wrong") return; }
    if (state === "wrong" && !reduced) {
      shake.value = withSequence(withTiming(-6, { duration: 90 }), withTiming(6, { duration: 90 }), withTiming(-6, { duration: 90 }), withTiming(6, { duration: 90 }), withTiming(0, { duration: 90 }));
    }
  }, [state, reduced, shake]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const half = Math.ceil(length / 2);
  const next = value.length < length ? value.length : -1;
  const box = (i: number) => {
    let ring = `0 0 0 1px ${colors.line2}`;
    let bg: string = colors.card;
    let text: ColorName = "ink";
    if (state === "wrong") { ring = `0 0 0 1.5px ${colors.bad}`; bg = colors["bad-soft"]; text = "bad"; }
    else if (state === "ok") { ring = `0 0 0 1.5px ${colors["ok-dot"]}`; bg = colors["ok-soft"]; text = "ok"; }
    else if (state === "typing" && !disabled && i === next) ring = `0 0 0 1.5px ${colors.acc}, 0 0 0 5px ${colors["acc-soft"]}`;
    return (
      <View key={i} style={{ flex: 1, minWidth: 0, height: 60, borderRadius: 15, backgroundColor: bg, alignItems: "center", justifyContent: "center", boxShadow: ring, opacity: state === "locked" ? 0.45 : 1 }}>
        <Num size={24} weight={600} color={text}>{value[i] ?? ""}</Num>
      </View>
    );
  };
  return (
    <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, shakeStyle]}>
      {Array.from({ length }, (_, i) => (
        i === half ? [<View key="dash" style={{ width: 10, height: 2, borderRadius: 2, backgroundColor: colors.line2, flexShrink: 0 }} />, box(i)] : box(i)
      ))}
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
        editable={!disabled && state !== "locked"}
        autoFocus={autoFocus}
        caretHidden
        accessibilityLabel={label}
        aria-invalid={state === "wrong"}
        style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: "transparent", fontSize: 16 }, noOutline]}
      />
    </Animated.View>
  );
}
