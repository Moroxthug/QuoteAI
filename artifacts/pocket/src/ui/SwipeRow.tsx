// COMPONENTS §17 and .cp-swipe on Components.dc.html. A list row that slides left to reveal
// 78-wide action tiles (a 22 icon over a 12.5/600 label, gap 4), tinted by tone. The front moves
// over 450 ms with the `out` easing and snaps open or closed: a drag past half the actions, or a
// fast flick, opens it. On its own it sits in a radius 22 card with the `ring` outline.
// A row that is expanded can't be swiped (`locked`). Reduced motion: it jumps.
// Screen readers get each action as a custom action on the row, so nothing needs a swipe.
import { useEffect, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { board } from "@/theme/board";
import { tokens } from "@/theme/tokens";
import { Icon, type IconName, type Tone } from "./Icon";
import { easing } from "./motion";
import { shadow } from "./shadow";
import { Text } from "./Text";
import { useTheme, type ColorName, type Colors } from "./theme";

export type SwipeTone = "info" | "ok" | "acc" | "bad" | "warn" | "mute";
export type SwipeAction = { key: string; label: string; icon: IconName; iconTone: Tone; tone: SwipeTone; onPress: () => void };

const TILE = 78;
/** .cp-swipe .front: transform .45s with the out easing (the segmented thumb's timing). */
const SLIDE = tokens.motion.segmentThumb.duration;
// Built once here: gesture callbacks run on the UI thread and can't call plain JS helpers.
const OUT = easing("out");

function tile(tone: SwipeTone, colors: Colors): { bg: string; fg: ColorName } {
  switch (tone) {
    case "info": return { bg: colors["info-soft"], fg: "info" };
    case "ok": return { bg: colors["ok-soft"], fg: "ok" };
    case "acc": return { bg: colors["acc-soft"], fg: "acc-soft-t" };
    case "bad": return { bg: colors["bad-soft"], fg: "bad" };
    case "warn": return { bg: board.warnSoft, fg: "warn" };
    case "mute": return { bg: colors.sunk, fg: "ink" };
  }
}

type Props = {
  actions: SwipeAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tapping the row (the board's sample toggles it). */
  onPress?: () => void;
  locked?: boolean;
  /** Sit in its own card (radius 22, ring). Off inside a list card. */
  card?: boolean;
  accessibilityLabel: string;
  children: ReactNode;
};

export function SwipeRow({ actions, open, onOpenChange, onPress, locked, card = true, accessibilityLabel, children }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const width = actions.length * TILE;
  const x = useSharedValue(open ? -width : 0);
  const start = useSharedValue(0);
  const ms = reduced ? 0 : SLIDE;

  useEffect(() => {
    x.value = withTiming(open && !locked ? -width : 0, { duration: ms, easing: OUT });
  }, [open, locked, width, ms, x]);

  const pan = Gesture.Pan()
    .enabled(!locked)
    .activeOffsetX([-10, 10])
    .failOffsetY([-8, 8])
    .onBegin(() => { start.value = x.value; })
    .onUpdate((e) => { x.value = Math.min(0, Math.max(-width, start.value + e.translationX)); })
    .onEnd((e) => {
      const toOpen = e.velocityX < -500 || (e.velocityX < 500 && x.value < -width / 2);
      x.value = withTiming(toOpen ? -width : 0, { duration: ms, easing: OUT });
      scheduleOnRN(onOpenChange, toOpen);
    });
  const tap = Gesture.Tap().maxDistance(10).onEnd((_e, ok) => { if (ok && onPress) scheduleOnRN(onPress); });
  const front = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={card ? { borderRadius: tokens.radius.card, overflow: "hidden", boxShadow: shadow("ring", colors) } : { overflow: "hidden" }}>
      <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, flexDirection: "row" }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {actions.map((a) => {
          const t = tile(a.tone, colors);
          return (
            <Pressable key={a.key} onPress={a.onPress} disabled={!open}
              style={{ width: TILE, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", gap: 4 }}>
              <Icon name={a.icon} tone={a.iconTone} size={22} />
              <Text size={12.5} weight={600} color={t.fg} numberOfLines={1}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <Animated.View style={[{ backgroundColor: colors.card }, front]}
          accessible accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={accessibilityLabel}
          accessibilityActions={actions.map((a) => ({ name: a.key, label: a.label }))}
          onAccessibilityAction={(e) => actions.find((a) => a.key === e.nativeEvent.actionName)?.onPress()}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
