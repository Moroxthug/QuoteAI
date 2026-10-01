// Verify.dc.html .vf-wrap: six 60-tall boxes (radius 15, Manrope 24/600, gap 8) with a 10×2 dash
// after the third. The next box gets the 1.5 `acc` ring and a 5 `acc-soft` halo; `bad` after a
// wrong code (the row shakes once), `ok` once verified, `off` (45 %) when locked. One invisible
// input lies over the boxes, so the keyboard, paste and SMS autofill all land in it.
import { useEffect, useRef } from "react";
import { Platform, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { noOutline } from "./Field";
import { Num } from "./Text";
import { useTheme } from "./theme";

export type VerifyCodeState = "typing" | "checking" | "wrong" | "ok" | "locked";

export function VerifyCode({ label, value, onChange, state, shakeKey = 0, length = 6 }: { label: string; value: string; onChange: (v: string) => void; state: VerifyCodeState; /** Bump to shake the row. */ shakeKey?: number; length?: number }) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const input = useRef<TextInput>(null);
  const x = useSharedValue(0);
  useEffect(() => {
    if (!shakeKey || reduce) return;
    x.value = withSequence(withTiming(-6, { duration: 90 }), withTiming(6, { duration: 90 }), withTiming(-6, { duration: 90 }), withTiming(6, { duration: 90 }), withTiming(0, { duration: 90 }));
  }, [shakeKey, reduce, x]);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  useEffect(() => {
    if (state === "typing") input.current?.focus();
  }, [state]);

  const half = length / 2;
  const box = (i: number) => {
    const active = state === "typing" && i === value.length;
    let bg = colors.card;
    let ring = `0 0 0 1px ${colors.line2}`;
    let ink: "ink" | "bad" | "ok" = "ink";
    if (state === "wrong") { bg = colors["bad-soft"]; ring = `0 0 0 1.5px ${colors.bad}`; ink = "bad"; }
    else if (state === "ok") { bg = colors["ok-soft"]; ring = `0 0 0 1.5px ${colors["ok-dot"]}`; ink = "ok"; }
    else if (active) ring = `0 0 0 1.5px ${colors.acc}, 0 0 0 5px ${colors["acc-soft"]}`;
    return (
      <View key={i} style={{ flex: 1, minWidth: 0, height: 60, borderRadius: 15, backgroundColor: bg, alignItems: "center", justifyContent: "center", boxShadow: ring, opacity: state === "locked" ? 0.45 : 1 }}>
        <Num size={24} weight={600} color={ink}>{value[i] ?? ""}</Num>
        {active ? <View style={{ position: "absolute", width: 2, height: 24, borderRadius: 2, backgroundColor: colors.acc }} /> : null}
      </View>
    );
  };
  return (
    <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, shake]}>
      {Array.from({ length }, (_, i) =>
        i === half ? [<View key="dash" style={{ width: 10, height: 2, borderRadius: 2, backgroundColor: colors.line2, flexShrink: 0 }} />, box(i)] : box(i),
      )}
      <TextInput
        ref={input}
        value={state === "wrong" ? "" : value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
        editable={state === "typing" || state === "wrong"}
        autoFocus
        caretHidden
        accessibilityLabel={label}
        aria-invalid={state === "wrong"}
        style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: "transparent" }, noOutline]}
      />
    </Animated.View>
  );
}
