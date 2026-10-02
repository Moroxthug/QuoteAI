// HomeAI.dc.html's assistant layer: the live orb (a dark ball of four slow blobs and a shine that swells with what it is doing), the glass round buttons, the two bubbles and the message bar. Dark in both themes.
import { useEffect, useId, useRef, type ReactNode } from "react";
import { ScrollView, TextInput, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { ampFor, type Mood } from "@/lib/assistantChat";
import { board } from "@/theme/board";
import { Glyph, type GlyphName } from "./Icon";
import { Press } from "./motion";
import { cssShadow } from "./shadow";
import { Text } from "./Text";
import { useTheme } from "./theme";

const L = board.assistantLayer;
const BLOBS: { c: string; size: number; x: number; y: number; ms: number; o: number }[] = [
  { c: L.blobs[0]!, size: 0.78, x: -0.14, y: 0.04, ms: 7000, o: 1 }, { c: L.blobs[1]!, size: 0.7, x: 0.48, y: -0.16, ms: 9000, o: 1 },
  { c: L.blobs[2]!, size: 0.72, x: 0.12, y: 0.54, ms: 8000, o: 1 }, { c: L.blobs[3]!, size: 0.6, x: 0.48, y: 0.46, ms: 10000, o: 0.85 },
];

function Blob({ c, size, x, y, ms, o, d, think, still }: { c: string; size: number; x: number; y: number; ms: number; o: number; d: number; think: boolean; still: boolean }) {
  const id = useId().replace(/:/g, "");
  const p = useSharedValue(0);
  useEffect(() => {
    if (still) { p.value = 0; return; }
    p.value = withRepeat(withTiming(1, { duration: think ? ms / 4 : ms, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [still, think, ms, p]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: p.value * d * 0.28 }, { translateY: p.value * d * 0.2 }, { scale: 1 + p.value * 0.12 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: x * d, top: y * d, width: size * d, height: size * d, opacity: o }, st]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs><RadialGradient id={id} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={c} stopOpacity={0.95} /><Stop offset="0.55" stopColor={c} stopOpacity={0.5} /><Stop offset="1" stopColor={c} stopOpacity={0} /></RadialGradient></Defs>
        <Circle cx={50} cy={50} r={50} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** The live orb, 220 across. It swells with `mood`; muted it dims and holds still. */
export function LiveOrb({ mood, size = 220 }: { mood: Mood; size?: number }) {
  const reduced = useReducedMotion();
  const amp = useSharedValue(0.1);
  const gid = useId().replace(/:/g, "");
  useEffect(() => {
    if (reduced) { amp.value = 0.1; return; }
    const t0 = Date.now();
    const timer = setInterval(() => { amp.value = amp.value + (ampFor(mood, (Date.now() - t0) / 1000) - amp.value) * 0.35; }, 33);
    return () => clearInterval(timer);
  }, [mood, reduced, amp]);
  const ball = useAnimatedStyle(() => ({ transform: [{ scale: 1 + amp.value * 0.13 }] }));
  const glow = useAnimatedStyle(() => ({ opacity: mood === "mute" ? 0.08 : 0.28 + amp.value * 0.55, transform: [{ scale: 0.9 + amp.value * 0.2 }] }));
  const still = mood === "mute" || !!reduced;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -50, left: -50, right: -50, bottom: -50 }, glow]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs><RadialGradient id={`g${gid}`} cx="50%" cy="50%" r="50%"><Stop offset="0.3" stopColor={L.blobs[0]} stopOpacity={0.9} /><Stop offset="0.6" stopColor={L.blobs[1]} stopOpacity={0.45} /><Stop offset="1" stopColor={L.blobs[3]} stopOpacity={0} /></RadialGradient></Defs>
          <Circle cx={50} cy={50} r={50} fill={`url(#g${gid})`} />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: size / 2, overflow: "hidden", backgroundColor: L.orbBase, opacity: mood === "mute" ? 0.55 : 1 }, ball]}>
        {BLOBS.map((b) => <Blob key={b.c} {...b} d={size} think={mood === "think"} still={still} />)}
        <Svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: "absolute" }}>
          <Defs><RadialGradient id={`s${gid}`} cx="32%" cy="26%" r="36%"><Stop offset="0" stopColor={L.shine} /><Stop offset="1" stopColor={L.shine} stopOpacity={0} /></RadialGradient></Defs>
          <Circle cx={50} cy={50} r={50} fill={`url(#s${gid})`} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** A glass round button (56, or 52 in the message bar). */
export function GlassButton({ glyph, label, onPress, size = 56 }: { glyph: GlyphName; label: string; onPress: () => void; size?: number }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: L.glass, boxShadow: `inset 0 0 0 1px ${L.glassRing}`, alignItems: "center", justifyContent: "center" }}>
      <Glyph name={glyph} size={size > 50 ? 22 : 20} tint={board.white} />
    </Press>
  );
}

/** The big round microphone: a card with a violet shadow, or red-tinted when muted. */
export function MuteButton({ muted, label, onPress }: { muted: boolean; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: muted }}
      style={{ width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: muted ? L.muteBg : colors.card, boxShadow: muted ? `inset 0 0 0 1px ${L.muteRing}` : cssShadow(L.micShadow, colors) }}>
      <Glyph name={muted ? "micOff" : "mic"} size={26} tint={muted ? L.muteFg : undefined} />
    </Press>
  );
}

export function Bubble({ mine, children, streaming }: { mine: boolean; children: string; streaming?: boolean }) {
  return mine ? (
    <View style={{ alignSelf: "flex-end", maxWidth: "78%", paddingVertical: 10, paddingHorizontal: 14, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 6, backgroundColor: L.mine }}>
      <Text size={14.5} leading={1.45} tint={board.white}>{children}</Text>
    </View>
  ) : (
    <View style={{ alignSelf: "flex-start", maxWidth: "88%" }}>
      <Text size={15} leading={1.55} tint={L.bot}>{children + (streaming ? " ▍" : "")}</Text>
    </View>
  );
}

/** The message bar: a glass pill with the field and a round send button. */
export function MessageBar({ value, onChange, onSend, placeholder, sendLabel, fieldLabel, disabled }: { value: string; onChange: (v: string) => void; onSend: () => void; placeholder: string; sendLabel: string; fieldLabel: string; disabled?: boolean }) {
  const { colors } = useTheme();
  const off = disabled || !value.trim();
  return (
    <View style={{ flex: 1, height: 52, borderRadius: 26, backgroundColor: L.glass, boxShadow: `inset 0 0 0 1px ${L.glassRing}`, flexDirection: "row", alignItems: "center", paddingLeft: 18, paddingRight: 6, gap: 6 }}>
      <TextInput value={value} onChangeText={onChange} onSubmitEditing={onSend} placeholder={placeholder} placeholderTextColor={L.placeholder} accessibilityLabel={fieldLabel} returnKeyType="send"
        style={{ flex: 1, minWidth: 0, height: 40, color: board.white, fontSize: 15, fontFamily: "Geist" }} />
      <Press onPress={onSend} disabled={off} accessibilityRole="button" accessibilityLabel={sendLabel} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.acc, alignItems: "center", justifyContent: "center", opacity: off ? 0.5 : 1 }}>
        <Glyph name="arrowUp" size={17} tint={board.white} weight={2.3} />
      </Press>
    </View>
  );
}

/** The layer's ground and the soft violet glow at its foot. */
export function Layer({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: L.ground, overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}><View style={{ position: "absolute", left: "-20%", right: "-20%", bottom: "-30%", height: "60%" }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs><RadialGradient id="amb" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={L.ambient} /><Stop offset="1" stopColor={L.ambient} stopOpacity={0} /></RadialGradient></Defs>
          <Circle cx={50} cy={50} r={50} fill="url(#amb)" />
        </Svg>
      </View></View>
      {children}
    </View>
  );
}

/** Where the orb sits: centred at 46 % of the height; the screen animates it up and smaller for the keyboard. */
export function OrbSlot({ children, style }: { children: ReactNode; style: object }) {
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", left: "50%", top: "46%", width: 220, height: 220, marginLeft: -110, marginTop: -110 }, style]}>{children}</Animated.View>;
}

/** The title at the top of the voice view and, under the orb, why it is only resting. */
export function VoiceNote({ title, note, top }: { title: string; note: string; top: number }) {
  return (
    <>
      <View style={{ position: "absolute", top, left: 0, right: 0, alignItems: "center" }}><Text size={15} weight={600} tint={board.white} accessibilityRole="header">{title}</Text></View>
      <View style={{ position: "absolute", left: 32, right: 32, top: "46%", marginTop: 150, alignItems: "center" }}><Text size={13.5} leading={1.45} align="center" tint={L.placeholder}>{note}</Text></View>
    </>
  );
}

export function VoiceControls({ children, bottom }: { children: ReactNode; bottom: number }) {
  return <View style={{ position: "absolute", left: 0, right: 0, bottom, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28 }}>{children}</View>;
}

export function KeyboardBar({ children, bottom }: { children: ReactNode; bottom: number }) {
  return <View style={{ position: "absolute", left: 12, right: 12, bottom, flexDirection: "row", alignItems: "center", gap: 8 }}>{children}</View>;
}

/** The messages, bottom-aligned, kept scrolled to the newest. */
export function Thread({ children, top, bottom }: { children: ReactNode; top: number; bottom: number }) {
  const ref = useRef<ScrollView>(null);
  return (
    <ScrollView ref={ref} onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })} style={{ position: "absolute", left: 0, right: 0, top, bottom }} contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: 20, gap: 14 }}>
      {children}
    </ScrollView>
  );
}

export function BubbleActions({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 }}>{children}</View>;
}

/** The close button in the keyboard view: top right. */
export function Corner({ children, top }: { children: ReactNode; top: number }) {
  return <View style={{ position: "absolute", top, right: 16 }}>{children}</View>;
}
