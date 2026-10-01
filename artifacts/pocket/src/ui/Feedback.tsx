// COMPONENTS §22–23 and the Feedback section of Components.dc.html.
// Banner (.banner): radius 16, padding 12×14, gap 11, a 24 icon, 13.5 text (1.4 leading) with the
// key phrase 600. Tones info, warn, bad, ok, acc. One banner per screen at most.
// Empty (.empty): centred, gap 8, padding 36 28; a 44 icon, title 16/600 (6 above), one line
// 13.5 muted (1.45, max 260), then a small button and an optional "Watch how" link.
// Skeleton (.skel): radius 6, `sunk` with a `soft` band sweeping across every 1.2 s. No spinners
// on content. Reduced motion: still.
// Toast (.cp-toast): `inv` / `on-inv`, radius 18, padding 8 8 8 16, 14.5 text, min 44, the
// float shadow; an optional 40-tall 600 action (Undo). ToastHost shows one 104 above the bottom,
// slides it in over 450 ms and hides it after 3 s.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { View, type DimensionValue } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { board } from "@/theme/board";
import { tokens } from "@/theme/tokens";
import { Button } from "./Button";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { easing, Press } from "./motion";
import { cssShadow } from "./shadow";
import { Text } from "./Text";
import { useTheme, type ColorName, type Colors } from "./theme";

export type BannerTone = "info" | "warn" | "bad" | "ok" | "acc";

function bannerColors(tone: BannerTone, colors: Colors): { bg: string; fg: ColorName } {
  switch (tone) {
    case "info": return { bg: colors["info-soft"], fg: "info" };
    case "warn": return { bg: board.warnSoft, fg: "warn" };
    case "bad": return { bg: colors["bad-soft"], fg: "bad" };
    case "ok": return { bg: colors["ok-soft"], fg: "ok" };
    case "acc": return { bg: colors["acc-soft"], fg: "acc-soft-t" };
  }
}

export function Banner({ tone, icon, iconTone, lead, children, link, onLink }: { tone: BannerTone; icon: IconName; iconTone: Tone; /** The key phrase, in 600. */ lead: string; children?: string; /** An underlined 600 link at the end of the text ("Enter the code"). */ link?: string; onLink?: () => void }) {
  const { colors } = useTheme();
  const c = bannerColors(tone, colors);
  return (
    <View accessibilityRole={tone === "bad" || tone === "warn" ? "alert" : "summary"}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 12, paddingHorizontal: 14, borderRadius: tokens.radius.banner, backgroundColor: c.bg }}>
      <Icon name={icon} tone={iconTone} size={24} />
      <Text size={13.5} leading={1.4} color={c.fg} style={{ flexShrink: 1, flexGrow: 1 }}>
        <Text size={13.5} leading={1.4} weight={600} color={c.fg}>{lead}</Text>
        {children ? ` ${children}` : null}
        {link ? <Text size={13.5} leading={1.4} weight={600} color={c.fg} accessibilityRole="link" onPress={onLink} style={{ textDecorationLine: "underline" }}>{` ${link}`}</Text> : null}
      </Text>
    </View>
  );
}

export function Empty({ icon, iconTone = "violet", title, body, action, onAction, actionKind = "primary", link, onLink, padding }: {
  icon: IconName; iconTone?: Tone; title: string; body: string;
  action?: string; onAction?: () => void; actionKind?: "primary" | "secondary";
  /** "Watch how": a play glyph and a 13.5 muted link under the button. */
  link?: string; onLink?: () => void;
  /** The error state is tighter (28 24). */
  padding?: { v: number; h: number };
}) {
  return (
    <View style={{ alignItems: "center", gap: 8, paddingVertical: padding?.v ?? 36, paddingHorizontal: padding?.h ?? 28 }}>
      <Icon name={icon} tone={iconTone} size={44} />
      <Text size={16} weight={600} align="center" accessibilityRole="header" style={{ marginTop: 6 }}>{title}</Text>
      <Text size={13.5} color="muted" leading={1.45} align="center" style={{ maxWidth: 260 }}>{body}</Text>
      {action ? <View style={{ marginTop: 6 }}><Button label={action} kind={actionKind} size="sm" onPress={onAction} /></View> : null}
      {link ? (
        <Press onPress={onLink} accessibilityRole="link" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 10, minHeight: 44 }}>
          <Glyph name="play" size={16} color="muted" />
          <Text size={13.5} color="muted">{link}</Text>
        </Press>
      ) : null}
    </View>
  );
}

export function Skeleton({ width = "100%", height, radius = 6 }: { width?: DimensionValue; height: number; radius?: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced || !w) return;
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1);
  }, [reduced, w, t]);
  // The board slides a 200 %-wide sunk → soft → sunk gradient from right to left.
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: w * (1 - 2 * t.value) }] }));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} importantForAccessibility="no-hide-descendants"
      style={{ width, height, borderRadius: radius, backgroundColor: colors.sunk, overflow: "hidden" }}>
      {reduced ? null : (
        <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, width: w }, band]}>
          <LinearGradient colors={[colors.sunk, colors.soft, colors.sunk]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
      )}
    </View>
  );
}

/** The toast pill itself (also used inline on the board). */
export function Toast({ message, action, onAction }: { message: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, borderRadius: 18, paddingVertical: 8, paddingRight: 8, paddingLeft: 16,
        backgroundColor: colors.inv, boxShadow: cssShadow("0 14px 34px -12px var(--shadow)", colors),
      }}>
      <Text size={14.5} color="on-inv" style={{ flexGrow: 1, flexShrink: 1 }}>{message}</Text>
      {action ? (
        <Press onPress={onAction} accessibilityRole="button" style={{ height: 40, minWidth: 44, paddingHorizontal: 12, borderRadius: 12, justifyContent: "center", opacity: 0.9 }}>
          <Text size={14.5} weight={600} color="on-inv">{action}</Text>
        </Press>
      ) : null}
    </View>
  );
}

type ToastMsg = { message: string; action?: string; onAction?: () => void };
const ToastCtx = createContext<(t: ToastMsg) => void>(() => {});

/** Show a toast: `const toast = useToast(); toast({ message, action: t("undo"), onAction })`. */
export function useToast() {
  return useContext(ToastCtx);
}

const SLIDE = easing("out");

export function ToastHost({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const y = useSharedValue(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = useCallback(() => {
    y.value = withTiming(1, { duration: reduced ? 0 : tokens.motion.segmentThumb.duration, easing: SLIDE });
    timer.current = setTimeout(() => setMsg(null), reduced ? 0 : tokens.motion.segmentThumb.duration);
  }, [reduced, y]);
  const show = useCallback((m: ToastMsg) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(m);
    y.value = 1;
    y.value = withTiming(0, { duration: reduced ? 0 : tokens.motion.segmentThumb.duration, easing: SLIDE });
    timer.current = setTimeout(hide, 3000);
  }, [hide, reduced, y]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const style = useAnimatedStyle(() => ({ opacity: 1 - y.value, transform: [{ translateY: y.value * 24 }] }));
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View pointerEvents="box-none" style={[{ position: "absolute", left: 16, right: 16, bottom: 104 }, style]}>
          <Toast message={msg.message} action={msg.action} onAction={() => { msg.onAction?.(); hide(); }} />
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}
