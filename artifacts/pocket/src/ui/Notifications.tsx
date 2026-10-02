// Notifications.dc.html: a row (the glyph, a title that is 600 while unread over its two lines, the time and the unread dot on the right, and the one
// button some rows carry), and the sheet that asks to turn notifications on (a sample push over a soft halo). Sizes are the board's own (.nt-*).
import type { ReactNode } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useEffect } from "react";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { board } from "@/theme/board";
import { Button } from "./Button";
import { Hairline } from "./Card";
import { Icon, type IconName, type Tone } from "./Icon";
import { Swirl } from "./Logo";
import { easing, Press } from "./motion";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

/** `.nt-row`: icon, text, and on the right the time over the unread dot (which scales away once read). */
export function NotificationRow({ first, icon, tone, title, body, time, unread, label, action, onAction, onPress }: {
  first?: boolean; icon: IconName; tone: Tone; title: string; body: string; time: string; unread: boolean; label: string; action?: string; onAction?: () => void; onPress: () => void;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const dot = useSharedValue(unread ? 1 : 0);
  useEffect(() => { dot.value = reduced ? (unread ? 1 : 0) : withTiming(unread ? 1 : 0, { duration: 300 }); }, [unread, reduced, dot]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value, transform: [{ scale: dot.value }] }));
  return (
    <>
      {first ? null : <Hairline inset={56} />}
      <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
      <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ marginTop: 1, width: 28, height: 28, flexShrink: 0 }}><Icon name={icon} tone={tone} size={28} /></View>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 3 }}>
          <Text size={14.5} weight={unread ? 600 : 500} leading={1.3}>{title}</Text>
          {body ? <Text size={13.5} color="muted" leading={1.4} numberOfLines={2}>{body}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 8, flexShrink: 0, paddingTop: 2 }}>
          <Num size={12.5} weight={500} color="muted">{time}</Num>
          <Animated.View accessibilityElementsHidden style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.acc }, dotStyle]} />
        </View>
      </Press>
      {/* The button is beside the row, not inside it: a button can't hold a button on the web. */}
      {action ? <View style={{ marginTop: 8, marginLeft: 40, flexDirection: "row", gap: 8 }}><Button size="sm" kind="secondary" label={action} onPress={onAction} /></View> : null}
      </View>
    </>
  );
}

/** The opt-in sheet's body: the sample push, the question over its line, and the two buttons. */
export function AskBody({ stage, title, body, children }: { stage: ReactNode; title: string; body: string; children: ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 30 }}>
      {stage}
      <Text size={21} weight={600} tracking={-0.035} align="center" accessibilityRole="header" style={{ marginTop: 6 }}>{title}</Text>
      <View style={{ alignItems: "center", paddingTop: 8 }}><Text size={14.5} color="muted" leading={1.5} align="center" style={{ maxWidth: 310 }}>{body}</Text></View>
      <View style={{ paddingTop: 22, gap: 6 }}>{children}</View>
    </View>
  );
}

/** `.nt-stage`: a faded push behind and a sample one in front, over a soft violet halo. */
export function PushStage({ app, now, title, body, amount }: { app: string; now: string; title: string; body: string; amount: string }) {
  const { colors } = useTheme();
  const card = { position: "absolute" as const, left: 36, right: 36, borderRadius: 20, backgroundColor: colors.glass, flexDirection: "row" as const, gap: 11, alignItems: "flex-start" as const, paddingVertical: 12, paddingHorizontal: 14, boxShadow: `0 0 0 1px ${colors.ring}, 0 18px 40px -18px ${colors.shadow}` };
  const appIcon = (
    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 1px ${colors.ring}`, flexShrink: 0 }}>
      <Swirl size={20} />
    </View>
  );
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 178, marginTop: 8, marginHorizontal: -20, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: "50%", top: "50%", width: 320, height: 176, marginLeft: -160, marginTop: -88 }}>
        <Svg width={320} height={176}>
          <Defs><RadialGradient id="pushHalo" cx="50%" cy="50%" rx="50%" ry="50%"><Stop offset="0" stopColor={board.pushHalo} stopOpacity={0.32} /><Stop offset="1" stopColor={board.pushHalo} stopOpacity={0} /></RadialGradient></Defs>
          <Rect x={0} y={0} width={320} height={176} fill="url(#pushHalo)" />
        </Svg>
      </View>
      <View style={[card, { top: 18, opacity: 0.5, transform: [{ scale: 0.9 }] }]}>
        {appIcon}
        <View style={{ flexGrow: 1, gap: 6, paddingTop: 4 }}>
          <View style={{ height: 8, width: "60%", borderRadius: 4, backgroundColor: colors.sunk }} />
          <View style={{ height: 8, width: "80%", borderRadius: 4, backgroundColor: colors.sunk }} />
        </View>
      </View>
      <View style={[card, { top: 44 }]}>
        {appIcon}
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text size={11.5} color="muted">{app}</Text>
            <Text size={11.5} color="muted">{now}</Text>
          </View>
          <Text size={14.5} weight={600}>{title}</Text>
          <Text size={12.5} color="muted">{`${body} `}<Num size={12.5} weight={600} color="ink">{amount}</Num></Text>
        </View>
      </View>
    </View>
  );
}

