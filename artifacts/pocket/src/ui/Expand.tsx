// COMPONENTS §6, the expandable card ("read in place"), as the .xc rules on Quotes.dc.html draw it.
// - Tap the head: the same card grows downward (height 0 → content over 450 ms, `expand` easing)
//   and pushes what is below. Nothing covers the page.
// - The content fades in from 6 above after 120 ms; the 24 chevron turns 180° and gets a `sunk`
//   circle (`faint` → `ink`).
// - Floating pop: scale .985 → 1.022 → 1 and 3 → 2 up over 620 ms (`pop` easing), with a deep soft
//   shadow; the body's rows rise in one after another (10 below, scale .97, 40 ms apart from 100 ms).
// - In a list (`row`), the open card detaches: 8 outside the list edges and 8 above and below,
//   its own radius 22; the other rows fade to 45 %.
// - One open per screen (ExpandScrollView / ExpandGroup); the opened card scrolls itself into view
//   (16 from the top, 118 from the bottom, clear of the tab bar).
// - Reduced motion: it opens and closes at once.
import { Children, createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollView, View, useWindowDimensions, type ScrollViewProps } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { tokens } from "@/theme/tokens";
import { Glyph } from "./Icon";
import { easing, Press } from "./motion";
import { cssShadow } from "./shadow";
import { Text } from "./Text";
import { useTheme } from "./theme";

const EXPAND = easing("expand");
const POP = easing("pop");
const OUT = easing("out");
const H_MS = tokens.motion.expand.height.duration; // 450
const POP_MS = tokens.motion.expandPop.duration; // 620
const OPEN_SHADOW = "0 0 0 1px var(--ring), 0 30px 60px -30px var(--shadow), 0 12px 26px -20px var(--shadow)";

type Group = { openId: string | null; openList: string | null; setOpen: (id: string | null, list?: string) => void; reveal: (node: View | null) => void };
const GroupCtx = createContext<Group | null>(null);

/** One open card at a time among its children. */
export function ExpandGroup({ children }: { children: ReactNode }) {
  const outer = useContext(GroupCtx);
  const [open, setOpenState] = useState<{ id: string | null; list: string | null }>({ id: null, list: null });
  if (outer) return <>{children}</>;
  const setOpen = (id: string | null, list?: string) => setOpenState({ id, list: id ? list ?? null : null });
  return <GroupCtx.Provider value={{ openId: open.id, openList: open.list, setOpen, reveal: () => {} }}>{children}</GroupCtx.Provider>;
}

/** A ScrollView that is also the screen's ExpandGroup: an opened card scrolls itself into view. */
export function ExpandScrollView({ children, ...rest }: ScrollViewProps & { children: ReactNode }) {
  const [open, setOpenState] = useState<{ id: string | null; list: string | null }>({ id: null, list: null });
  const setOpen = (id: string | null, list?: string) => setOpenState({ id, list: id ? list ?? null : null });
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const { height: winH } = useWindowDimensions();
  const reveal = (node: View | null) => {
    node?.measureInWindow((_x, y, _w, h) => {
      const top = 16;
      const bottom = winH - 118;
      let d = 0;
      if (y + h > bottom) d = Math.min(y + h - bottom, y - top);
      else if (y < top) d = y - top;
      if (d) scroll.current?.scrollTo({ y: offset.current + d, animated: true });
    });
  };
  return (
    <GroupCtx.Provider value={{ openId: open.id, openList: open.list, setOpen, reveal }}>
      <ScrollView ref={scroll} scrollEventThrottle={16} {...rest} onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; rest.onScroll?.(e); }}>
        {children}
      </ScrollView>
    </GroupCtx.Provider>
  );
}

function Chevron({ open }: { open: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const r = useSharedValue(open ? 1 : 0);
  useEffect(() => { r.value = withTiming(open ? 1 : 0, { duration: reduced ? 0 : H_MS, easing: EXPAND }); }, [open, reduced, r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 180}deg` }] }));
  return (
    <Animated.View style={[{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: open ? colors.sunk : "transparent", flexShrink: 0 }, style]}>
      <Glyph name="chevronDown" size={16} color={open ? "ink" : "faint"} />
    </Animated.View>
  );
}

/** A body child that rises in after the card opens (xcrow). */
function RowIn({ index, open, children }: { index: number; open: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    if (reduced) { t.value = open ? 1 : 0; return; }
    t.value = open ? 0 : t.value;
    t.value = open
      ? withDelay(100 + index * tokens.motion.expandPop.rows.stagger, withTiming(1, { duration: 550, easing: POP }))
      : withTiming(0, { duration: 180 });
  }, [open, reduced, index, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * tokens.motion.expandPop.rows.translateY }, { scale: 1 - (1 - t.value) * (1 - tokens.motion.expandPop.rows.scaleFrom) }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

type Props = {
  id: string;
  /** Read aloud for the head ("Dana Whitfield, Q-2026-119"). */
  label: string;
  /** The closed card's content; the chevron is added on the right. */
  head: ReactNode;
  /** `card`: a card on its own (padding 16). `row`: a row in a list card, which detaches when open. */
  variant?: "card" | "row";
  /** The list a `row` belongs to: when one of its rows opens, the others fade to 45 %. */
  list?: string;
  children: ReactNode;
};

export function ExpandCard({ id, label, head, variant = "card", list, children }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const group = useContext(GroupCtx);
  const [solo, setSolo] = useState(false);
  const open = group ? group.openId === id : solo;
  const others = !!list && group?.openList === list && !open;
  const node = useRef<View>(null);
  const [bodyH, setBodyH] = useState(0);

  const h = useSharedValue(0); // 0 … 1 of the body's height
  const content = useSharedValue(0);
  const pop = useSharedValue(1);
  const lift = useSharedValue(0);
  const dim = useSharedValue(1);

  useEffect(() => {
    const ms = reduced ? 0 : H_MS;
    h.value = withTiming(open ? 1 : 0, { duration: ms, easing: EXPAND });
    content.value = open ? withDelay(reduced ? 0 : 120, withTiming(1, { duration: reduced ? 0 : 300 })) : withTiming(0, { duration: reduced ? 0 : 180 });
    if (open && !reduced) {
      const a = POP_MS * 0.42;
      pop.value = 0.985;
      pop.value = withSequence(withTiming(1.022, { duration: a, easing: POP }), withTiming(1, { duration: POP_MS - a, easing: POP }));
      lift.value = withSequence(withTiming(-3, { duration: a, easing: POP }), withTiming(-2, { duration: POP_MS - a, easing: POP }));
    } else {
      pop.value = 1;
      lift.value = withTiming(open ? -2 : 0, { duration: reduced ? 0 : H_MS, easing: OUT });
    }
    if (open && group) {
      const t = setTimeout(() => group.reveal(node.current), reduced ? 0 : H_MS);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { dim.value = withTiming(others ? 0.45 : 1, { duration: reduced ? 0 : 350 }); }, [others, reduced, dim]);

  const toggle = () => (group ? group.setOpen(open ? null : id, list) : setSolo((o) => !o));

  const outer = useAnimatedStyle(() => ({ opacity: dim.value, transform: [{ translateY: lift.value }, { scale: pop.value }] }));
  const body = useAnimatedStyle(() => ({ height: bodyH * h.value }));
  const inner = useAnimatedStyle(() => ({ opacity: content.value, transform: [{ translateY: (1 - content.value) * tokens.motion.expand.content.translateY }] }));

  const row = variant === "row";
  const shape = row
    ? open
      ? { marginHorizontal: -8, marginVertical: 8, paddingHorizontal: 8, borderRadius: tokens.radius.card, backgroundColor: colors.card, boxShadow: cssShadow(OPEN_SHADOW, colors), zIndex: 3 }
      : {}
    : { borderRadius: tokens.radius.card, backgroundColor: colors.card, boxShadow: cssShadow(open ? OPEN_SHADOW : tokens.shadow.ring, colors), zIndex: open ? 3 : 0 };

  return (
    <Animated.View ref={node} style={[shape, outer]}>
      <Press onPress={toggle} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }}
        style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, padding: row ? 0 : 16, paddingRight: row ? 16 : 16 }}>
        <View style={{ flex: 1, minWidth: 0 }}>{head}</View>
        <View style={{ paddingTop: row ? 12 : 0 }}><Chevron open={open} /></View>
      </Press>
      <Animated.View style={[{ overflow: "hidden" }, body]}>
        <View onLayout={(e) => setBodyH(e.nativeEvent.layout.height)} style={{ position: "absolute", left: 0, right: 0, top: 0 }}>
          <Animated.View style={[{ paddingHorizontal: 16, paddingBottom: 16 }, inner]}>
            {Children.toArray(children).map((c, i) => <RowIn key={i} index={i} open={open}>{c}</RowIn>)}
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** .xc-div: a hairline 14 above and 2 below. */
export function XcDivider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.line, marginTop: 14, marginBottom: 2 }} />;
}

/** .xc-cap: 12.5 muted, 12 above. */
export function XcCaption({ children }: { children: string }) {
  return <Text size={12.5} color="muted" style={{ marginTop: 12, marginBottom: 2 }}>{children}</Text>;
}

/** .xc-row: title 14.5/500 and context 12.5 muted; on the right a figure and/or a 34 action. */
export function XcRow({ title, sub, right, first }: { title: string; sub?: ReactNode; right?: ReactNode; first?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text size={14.5} weight={500}>{title}</Text>
        {typeof sub === "string" ? <Text size={12.5} color="muted" leading={1.35}>{sub}</Text> : sub}
      </View>
      {right ? <View style={{ alignItems: "flex-end", gap: 7, flexShrink: 0 }}>{right}</View> : null}
    </View>
  );
}

/** .xc-btn: a 34 action in a row (min 72, radius 11, 13.5/600); `done` turns it ok-soft, `soft` is sunk. */
export function XcButton({ label, onPress, tone = "primary" }: { label: string; onPress?: () => void; tone?: "primary" | "done" | "soft" }) {
  const { colors } = useTheme();
  const bg = tone === "done" ? colors["ok-soft"] : tone === "soft" ? colors.sunk : colors.inv;
  const fg = tone === "done" ? "ok" : tone === "soft" ? "ink" : "on-inv";
  return (
    <Press onPress={onPress} accessibilityRole="button" hitSlop={5}
      style={{ height: 34, minWidth: 72, paddingHorizontal: 12, borderRadius: 11, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Text size={13.5} weight={600} color={fg}>{label}</Text>
    </Press>
  );
}

/** .xc-acts: the "Open …" link (44, `sunk`, 500) and the one primary action (44, `inv`), side by side, gap 8. */
export function XcActions({ link, onLink, main, onMain, mainDone }: { link: string; onLink?: () => void; main?: string; onMain?: () => void; mainDone?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
      <Press onPress={onLink} accessibilityRole="link" style={{ flex: 1, height: 44, borderRadius: 13, backgroundColor: colors.sunk, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }}>
        <Text size={14.5} weight={500} numberOfLines={1}>{link}</Text>
      </Press>
      {main ? (
        <Press onPress={onMain} accessibilityRole="button" style={{ flex: 1, height: 44, borderRadius: 13, backgroundColor: mainDone ? colors["ok-soft"] : colors.inv, alignItems: "center", justifyContent: "center" }}>
          <Text size={14.5} weight={600} color={mainDone ? "ok" : "on-inv"} numberOfLines={1}>{main}</Text>
        </Press>
      ) : null}
    </View>
  );
}
