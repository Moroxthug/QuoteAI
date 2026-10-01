// SmartHome's "Needs you" (HOME-WIDGETS-SPEC.md, SmartHome.dc.html .ny-*).
// A title (15/600) with an ink count badge (Num 11.5/600) and "Swipe for more"; a snap row of 268 x
// 124 cards (radius 22, `card` with the ring, 10 apart): a 26 gradient icon beside the title (14.5/500,
// one line) and one or two muted lines, a plain status bottom left and one 36 ink button bottom
// right. A button that changes something here (a reminder) turns the card green-soft: the content
// lifts out and a 28 tick springs in with the past tense; after 2.6 s the card closes its width and
// the count drops. Empty: a green-soft line, never a celebration.
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { board } from "@/theme/board";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { easing, Press } from "./motion";
import { Status, type StatusShape, type StatusTone } from "./Status";
import { Num, Text } from "./Text";
import { useTheme } from "./theme";

export type NeedsCardData = {
  id: string;
  icon: IconName;
  tone: Tone;
  title: string;
  sub: string;
  status: { tone: StatusTone; shape: StatusShape; word: string };
  button: string;
  doneLabel: string;
  /** Runs when the button is pressed. Resolve true when the card is done here (it then turns green and leaves). */
  onAct: () => Promise<boolean | void> | boolean | void;
};

const CARD_W = 268;
const GAP = 10;
const SHUT = easing("expand");

function Card({ card, onGone, onDone }: { card: NeedsCardData; onGone: (id: string) => void; onDone: (id: string, done: boolean) => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const w = useSharedValue(1);
  const tick = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const press = async () => {
    if (busy || done) return;
    setBusy(true);
    const r = await card.onAct();
    setBusy(false);
    if (r !== true) return;
    setDone(true);
    onDone(card.id, true);
    tick.value = withDelay(100, withTiming(1, { duration: reduced ? 0 : 450 }));
    timer.current = setTimeout(() => {
      w.value = withTiming(0, { duration: reduced ? 0 : 500, easing: SHUT });
      setTimeout(() => onGone(card.id), reduced ? 0 : 520);
    }, reduced ? 600 : 2600);
  };

  const outer = useAnimatedStyle(() => ({ width: w.value * CARD_W, marginRight: w.value * GAP - (1 - w.value) * 0, opacity: w.value }));
  const tickStyle = useAnimatedStyle(() => ({ opacity: tick.value, transform: [{ scale: 0.9 + 0.1 * tick.value }] }));
  return (
    <Animated.View style={[{ height: 124, borderRadius: 22, backgroundColor: done ? colors["ok-soft"] : colors.card, boxShadow: `0 0 0 1px ${colors.ring}`, overflow: "hidden" }, outer]}>
      {!done ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, paddingTop: 14, paddingBottom: 12, paddingLeft: 16, paddingRight: 14 }}>
          <View style={{ flexDirection: "row", gap: 11, alignItems: "flex-start" }}>
            <Icon name={card.icon} tone={card.tone} size={26} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text size={14.5} weight={500} numberOfLines={1}>{card.title}</Text>
              <Text size={12.5} color="muted" leading={1.35} numberOfLines={2}>{card.sub}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto" }}>
            <Status plain tone={card.status.tone} shape={card.status.shape}>{card.status.word}</Status>
            <Press onPress={() => void press()} accessibilityRole="button" accessibilityLabel={`${card.button}. ${card.title}`} accessibilityState={{ busy }}
              style={{ height: 36, minWidth: 44, paddingHorizontal: 14, borderRadius: 11, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
              <Text size={13.5} weight={600} color="on-inv">{card.button}</Text>
            </Press>
          </View>
        </View>
      ) : (
        <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }, tickStyle]} accessibilityLiveRegion="polite">
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors["ok-dot"], alignItems: "center", justifyContent: "center" }}><Glyph name="check" size={16} tint={board.checkWhite} weight={3} /></View>
          <Text size={14.5} weight={600} color="ok">{card.doneLabel}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

export function NeedsYou({ cards, title, hint, hintDone, emptyTitle, emptyBody }: { cards: NeedsCardData[]; title: string; hint: string; hintDone: string; emptyTitle: string; emptyBody: string }) {
  const { colors } = useTheme();
  const [gone, setGone] = useState<Record<string, true>>({});
  const [done, setDone] = useState<Record<string, true>>({});
  const shown = cards.filter((c) => !gone[c.id]);
  const left = cards.filter((c) => !done[c.id] && !gone[c.id]).length;

  if (cards.length === 0 || shown.length === 0) {
    return (
      <View style={{ paddingTop: 22, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors["ok-soft"] }} accessible accessibilityLabel={`${emptyTitle}. ${emptyBody}`}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors["ok-dot"], alignItems: "center", justifyContent: "center" }}><Glyph name="check" size={16} tint={board.checkWhite} weight={3} /></View>
          <Text size={14.5} color="ok" style={{ flexShrink: 1 }}><Text size={14.5} weight={600} color="ok">{emptyTitle}</Text>{` · ${emptyBody}`}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={{ paddingTop: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text size={15} weight={600} tracking={-0.02} accessibilityRole="header">{title}</Text>
          <View style={{ minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: colors.inv, alignItems: "center", justifyContent: "center" }}>
            <Num size={11.5} weight={600} color="on-inv">{String(left)}</Num>
          </View>
        </View>
        <Text size={12.5} color="muted">{left ? hint : hintDone}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={CARD_W + GAP} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 6 }} accessibilityLabel={title}>
        {shown.map((c) => (
          <Card key={c.id} card={c} onDone={(id, d) => setDone((s) => (d ? { ...s, [id]: true } : s))} onGone={(id) => setGone((s) => ({ ...s, [id]: true }))} />
        ))}
      </ScrollView>
    </View>
  );
}
