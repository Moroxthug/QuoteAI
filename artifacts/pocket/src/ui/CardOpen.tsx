// COMPONENTS §6b (board: SmartHomeOpen.dc.html): a Home widget card opens full screen as a container transform. Reusable: wrap a card's content in `OpenableCard`, mount `CardOpenProvider` once above
// the screens and the tab bar (app/_layout.tsx), wrap the screen the card is on in `PushBack`, and let the tab bar use `useBarSlide`.
//
// Open (540 ms, `expand` easing, no overshoot): the page starts exactly over the card (translated to its corner, scaled to its width, clipped to its height, corner 22) and grows to fill the screen. The
// expanded content fades in from 14 below from 35 % of the way; the top bar ("‹ Home", a grab handle) fades in from 8 above from 50 %. Behind it Home scales to .94 with 34 corners, a scrim fades in, the tab
// bar slides down 30 and fades by 70 %, and the backdrop behind the shrunk Home is black.
// Close (440 ms): the back button or the Android back gesture; the page shrinks into the card's CURRENT rect (measured again), the content fades out in the first 35 %.
// Swipe down (only at the top of the page): it follows the finger at .85x, shrinks to .86 at 400, the scrim goes to 20 %, Home comes forward from .94 to .98. Past 110 it closes from where it is; under 110 it
// springs back (420 ms, `cubic-bezier(.34,1.3,.64,1)`). Everything runs on the UI thread through shared values.
// Reduced motion: open and close are 150 ms fades, no scale and no push back. Accessibility: the page is a modal; focus moves to the back button on open and returns to the card on close.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { AccessibilityInfo, BackHandler, findNodeHandle, Platform, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, ScrollView as GestureScrollView } from "react-native-gesture-handler";
import Animated, { Easing, makeMutable, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { barSlide, CLOSE_MS, closedGeom, dragGeom, HOME_RADIUS, HOME_SCALE, lerpGeom, OPEN_MS, openGeom, shouldClose, SPRING_MS, type Geom, type Rect } from "@/lib/cardOpen";
import { board } from "@/theme/board";
import { Glyph } from "./Icon";
import { Press } from "./motion";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** Moves screen-reader focus to a view (the back button on open, the card on close). On the web the element itself takes focus. */
function focusView(node: View | null): void {
  if (!node) return;
  if (Platform.OS === "web") { (node as unknown as { focus?: () => void }).focus?.(); return; }
  const tag = findNodeHandle(node);
  if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
}

const AnimatedScroll = Animated.createAnimatedComponent(GestureScrollView);
const EXPAND = Easing.bezier(0.32, 0.72, 0, 1);
const OUT = Easing.bezier(0.16, 1, 0.3, 1);
const SPRING = Easing.bezier(0.34, 1.3, 0.64, 1);

// ── What the page, Home, the scrim and the tab bar are doing: shared values read by the host, PushBack and the tab bar. ──
export type Snap = { x: number; y: number; scale: number; height: number; radius: number; scrim: number; home: number };
const cardP = makeMutable(0); // phase 0: how far open, 0 to 1
const cardDy = makeMutable(0); // phase 1: the finger's distance down
const cardQ = makeMutable(0); // phases 2 and 3: progress of the close from a drag, or of the spring back
const cardPhase = makeMutable(0); // 0 opening/closing normally, 1 dragging, 2 closing from a drag, 3 springing back
const cardSnap = makeMutable<Snap>({ x: 0, y: 0, scale: 1, height: 0, radius: 12, scrim: 1, home: HOME_SCALE });
const cardReduced = makeMutable(0);

type Push = { homeScale: number; homeRadius: number; scrim: number; open: number };
/** What Home, the scrim and the tab bar do for the page's current state. Pure: the shared values are read by the caller, so a style that uses it re-runs when they change. */
function pushOf(ph: number, p: number, dy: number, q: number, snap: Snap, reduced: number): Push {
  "worklet";
  if (ph === 1) {
    const k = Math.min(Math.max(dy, 0), 400) / 400;
    return { homeScale: HOME_SCALE + k * 0.04, homeRadius: HOME_RADIUS, scrim: 1 - k * 0.8, open: 1 };
  }
  if (ph === 2) {
    const t = Math.min(1, Math.max(0, q));
    return { homeScale: snap.home + (1 - snap.home) * t, homeRadius: HOME_RADIUS * (1 - t), scrim: snap.scrim * (1 - t), open: 1 - t };
  }
  if (ph === 3) return { homeScale: snap.home + (HOME_SCALE - snap.home) * q, homeRadius: HOME_RADIUS, scrim: snap.scrim + (1 - snap.scrim) * q, open: 1 };
  return { homeScale: reduced ? 1 : 1 - (1 - HOME_SCALE) * p, homeRadius: reduced ? 0 : HOME_RADIUS * p, scrim: p, open: p };
}

/** Wrap the screen a card is on: while a card is open it is pushed back to .94 with 34 corners (and comes forward as the page is dragged down). */
export function PushBack({ children }: { children: ReactNode }) {
  const st = useAnimatedStyle(() => {
    const s = pushOf(cardPhase.value, cardP.value, cardDy.value, cardQ.value, cardSnap.value, cardReduced.value);
    return { flex: 1, overflow: "hidden", borderRadius: s.homeRadius, transform: [{ scale: s.homeScale }] };
  });
  return <Animated.View style={st}>{children}</Animated.View>;
}

/** The tab bar's style: it slides down 30 and fades while a card is open. */
export function useBarSlide() {
  return useAnimatedStyle(() => {
    const b = barSlide(pushOf(cardPhase.value, cardP.value, cardDy.value, cardQ.value, cardSnap.value, cardReduced.value).open);
    return { opacity: b.opacity, transform: [{ translateY: b.translateY }] };
  });
}

// ── The content of each card, kept current so the open page shows what the card shows now. ──
type Content = { collapsed: (inPage: boolean) => ReactNode; expanded: ReactNode; label: string };
const contents = new Map<string, Content>();
const subs = new Set<() => void>();
const version = { n: 0 };
let activeId: string | null = null;
/** Only the open card's page needs to hear about a change; the others just keep their latest content for when they are opened. */
const publish = (id: string, c: Content) => { contents.set(id, c); if (id === activeId) { version.n++; subs.forEach((f) => f()); } };
const useVersion = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => version.n, () => 0);

type Session = { id: string; ref: RefObject<View | null> };
type Api = { open: (id: string, ref: RefObject<View | null>) => void; openId: string | null };
const Ctx = createContext<Api>({ open: () => {}, openId: null });

/** True while a card is open: Home does not scroll and its carousels do not swipe. */
export function useCardOpenActive(): boolean {
  return useContext(Ctx).openId !== null;
}

/** A card that opens full screen. `collapsed(false)` is the card; `collapsed(true)` the same top part inside the page, followed by `expanded`. */
export function OpenableCard({ id, label, hint, collapsed, expanded, style, children, openable = true }: { id: string; label: string; hint?: string; collapsed: (inPage: boolean) => ReactNode; expanded: ReactNode; style?: object; children?: ReactNode; /** False while there is nothing to open (the weather is loading or unavailable): the card is just a card, so a button inside it is not nested in another. */ openable?: boolean }) {
  const api = useContext(Ctx);
  const ref = useRef<View>(null);
  useEffect(() => { publish(id, { collapsed, expanded, label }); }); // every render, so the page is never behind the card
  return (
    <View ref={ref} collapsable={false} style={style}>
      {openable ? (
        <Press onPress={() => api.open(id, ref)} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ expanded: api.openId === id }}>
          {collapsed(false)}
        </Press>
      ) : collapsed(false)}
      {children}
    </View>
  );
}

export function CardOpenProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const { width: W, height: H } = useWindowDimensions();
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const busy = useRef(false);
  const closed = useSharedValue<Geom>({ x: 0, y: 0, scale: 1, height: 0, radius: 0 });
  const fade = useSharedValue(0);
  const body = useSharedValue(0);
  const bar = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const startOk = useSharedValue(0);
  const backRef = useRef<View>(null);
  const { colors, scheme } = useTheme();
  const { t } = useTranslation();
  useVersion();

  useEffect(() => { cardReduced.value = reduced ? 1 : 0; }, [reduced]);

  const finish = useCallback(() => {
    const s = sessionRef.current;
    sessionRef.current = null;
    busy.current = false;
    cardPhase.value = 0; cardP.value = 0; cardDy.value = 0; cardQ.value = 0; fade.value = 0; body.value = 0; bar.value = 0;
    setSession(null);
    focusView(s?.ref.current ?? null);
  }, [bar, body, fade]);

  const open = useCallback((id: string, ref: RefObject<View | null>) => {
    if (busy.current || !ref.current) return;
    busy.current = true;
    ref.current.measureInWindow((x, y, w, h) => {
      const src: Rect = { x, y, w, h };
      closed.value = closedGeom(src, { w: W, h: H });
      cardPhase.value = 0; cardDy.value = 0; cardQ.value = 0; scrollY.value = 0;
      const s = { id, ref };
      sessionRef.current = s;
      setSession(s);
      if (reduced) {
        cardP.value = 1; body.value = 1; bar.value = 1;
        fade.value = withTiming(1, { duration: 150 }, () => { /* settled */ });
      } else {
        fade.value = 1;
        cardP.value = 0;
        cardP.value = withTiming(1, { duration: OPEN_MS, easing: EXPAND });
        body.value = withDelay(OPEN_MS * 0.35, withTiming(1, { duration: OPEN_MS * 0.65, easing: OUT }));
        bar.value = withDelay(OPEN_MS * 0.5, withTiming(1, { duration: OPEN_MS * 0.5 }));
      }
      busy.current = false;
      setTimeout(() => focusView(backRef.current), reduced ? 200 : OPEN_MS);
    });
  }, [H, W, bar, body, closed, fade, reduced, scrollY]);

  /** Close from the open page: shrink into the card where it is NOW (measured again, it may have moved). */
  const close = useCallback(() => {
    const s = sessionRef.current;
    if (!s || busy.current) return;
    busy.current = true;
    const run = (src: Rect | null) => {
      if (src) closed.value = closedGeom(src, { w: W, h: H });
      if (reduced) { fade.value = withTiming(0, { duration: 150 }, (done) => { if (done) runOnJS(finish)(); }); return; }
      body.value = withTiming(0, { duration: CLOSE_MS * 0.35 });
      bar.value = withTiming(0, { duration: CLOSE_MS * 0.25 });
      cardP.value = withTiming(0, { duration: CLOSE_MS, easing: EXPAND }, (done) => { if (done) runOnJS(finish)(); });
    };
    if (s.ref.current) s.ref.current.measureInWindow((x, y, w, h) => run({ x, y, w, h }));
    else run(null);
  }, [H, W, bar, body, closed, fade, finish, reduced]);

  /** Release past 110: the page is already where the finger left it (phase 2); measure the card again and shrink from there. */
  const closeFromDrag = useCallback(() => {
    const s = sessionRef.current;
    busy.current = true;
    const go = (src: Rect | null) => {
      if (src) closed.value = closedGeom(src, { w: W, h: H });
      body.value = withTiming(0, { duration: CLOSE_MS * 0.35 });
      bar.value = withTiming(0, { duration: CLOSE_MS * 0.25 });
      cardQ.value = withTiming(1, { duration: CLOSE_MS, easing: EXPAND }, (done) => { if (done) runOnJS(finish)(); });
    };
    if (s?.ref.current) s.ref.current.measureInWindow((x, y, w, h) => go({ x, y, w, h }));
    else go(null);
  }, [H, W, bar, body, closed, finish]);

  useEffect(() => {
    if (!session) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { close(); return true; });
    return () => sub.remove();
  }, [session, close]);

  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const native = Gesture.Native();
  const pan = Gesture.Pan()
    .minDistance(8)
    .failOffsetX([-30, 30])
    .simultaneousWithExternalGesture(native)
        .onStart(() => { startOk.value = scrollY.value <= 0.5 ? 1 : 0; })
    .onUpdate((e) => {
      if (!startOk.value) return;
      if (cardReduced.value) { cardDy.value = Math.max(0, e.translationY); return; } // reduced motion: nothing moves, but a long swipe still closes
      cardPhase.value = 1;
      cardDy.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (startOk.value && cardReduced.value) { if (shouldClose(e.translationY)) runOnJS(close)(); cardDy.value = 0; return; }
      if (!startOk.value || cardPhase.value !== 1) return;
      const g = dragGeom(cardDy.value, { w: W, h: H });
      cardSnap.value = { x: g.x, y: g.y, scale: g.scale, height: H, radius: g.radius, scrim: g.scrim, home: g.homeScale };
      if (shouldClose(e.translationY)) {
        cardPhase.value = 2; cardQ.value = 0;
        runOnJS(closeFromDrag)();
      } else {
        cardPhase.value = 3; cardQ.value = 0;
        cardQ.value = withTiming(1, { duration: SPRING_MS, easing: SPRING }, (done) => { if (done) { cardPhase.value = 0; cardDy.value = 0; } });
      }
    });

  const panel = useAnimatedStyle(() => {
    const ph = cardPhase.value;
    const full = openGeom({ w: W, h: H });
    let g: Geom;
    if (cardReduced.value) g = full;
    else if (ph === 1) g = dragGeom(cardDy.value, { w: W, h: H });
    else if (ph === 2) { const s = cardSnap.value; g = lerpGeom({ x: s.x, y: s.y, scale: s.scale, height: s.height, radius: s.radius }, closed.value, Math.min(1, cardQ.value)); }
    else if (ph === 3) { const s = cardSnap.value; g = lerpGeom({ x: s.x, y: s.y, scale: s.scale, height: s.height, radius: s.radius }, full, cardQ.value); }
    else g = lerpGeom(closed.value, full, cardP.value);
    return { position: "absolute", left: 0, top: 0, width: W, height: g.height, borderRadius: g.radius, overflow: "hidden", opacity: cardReduced.value ? fade.value : 1, transformOrigin: "0% 0%", transform: [{ translateX: g.x }, { translateY: g.y }, { scale: g.scale }] };
  });
  const scrim = useAnimatedStyle(() => ({ opacity: cardReduced.value ? fade.value * 0 : pushOf(cardPhase.value, cardP.value, cardDy.value, cardQ.value, cardSnap.value, cardReduced.value).scrim }));
  const bodyStyle = useAnimatedStyle(() => ({ opacity: body.value, transform: [{ translateY: (1 - body.value) * 14 }] }));
  const barStyle = useAnimatedStyle(() => ({ opacity: bar.value, transform: [{ translateY: (1 - bar.value) * -8 }] }));

  activeId = session?.id ?? null;
  const openId = session?.id ?? null;
  const api = useMemo<Api>(() => ({ open, openId }), [open, openId]);
  const c = session ? contents.get(session.id) : undefined;
  return (
    <Ctx.Provider value={api}>
      {children}
      {session && c ? (
        <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: scheme === "dark" ? board.cardOpen.scrimDark : board.cardOpen.scrimLight }, scrim]} />
          <Animated.View style={panel} accessibilityViewIsModal importantForAccessibility="yes" {...(Platform.OS === "web" ? { role: "dialog" as const } : {})} accessibilityLabel={c.label}>
            <View style={{ position: "absolute", top: 0, left: 0, width: W, height: H, backgroundColor: colors.card }}>
              <GestureDetector gesture={Gesture.Simultaneous(pan, native)}>
                <AnimatedScroll onScroll={onScroll} scrollEventThrottle={16} bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 56, paddingBottom: 60 }}>
                  <View style={{ paddingHorizontal: 16, paddingTop: 0 }}>
                    {c.collapsed(true)}
                    <Animated.View style={bodyStyle}>{c.expanded}</Animated.View>
                  </View>
                </AnimatedScroll>
              </GestureDetector>
              <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, height: 56, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }, barStyle]}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", left: "50%", top: 6, width: 36, height: 5, marginLeft: -18, borderRadius: 5, backgroundColor: colors.line2 }} />
                <View ref={backRef} collapsable={false}>
                  <Press onPress={close} accessibilityRole="button" accessibilityLabel={t("tabs.home")} style={{ height: 44, paddingRight: 10, paddingLeft: 4, flexDirection: "row", alignItems: "center", gap: 2 }}>
                    <Glyph name="back" size={22} color="acc-t" weight={2.2} />
                    <Text size={16} weight={500} color="acc-t">{t("tabs.home")}</Text>
                  </Press>
                </View>
              </Animated.View>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </Ctx.Provider>
  );
}
