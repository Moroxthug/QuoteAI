// Welcome.dc.html: the three-slide intro. The header (logo + EN/FR), the carousel (art, title,
// arrows, dots) and the tour link. Every size here is the board's (.w-* rules); colours come from
// the theme, and the few the tokens don't name from src/theme/welcomeBoard.ts.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanResponder, Pressable, View, type DimensionValue } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { percent, money, type Locale } from "@/lib/format";
import { welcomeBoard } from "@/theme/welcomeBoard";
import { avatarTint } from "./Avatar";
import { LangSwitch } from "./Auth";
import { Glyph, Icon, type IconName, type Tone } from "./Icon";
import { Logo } from "./Logo";
import { easing, Press, Rise } from "./motion";
import { cssShadow } from "./shadow";
import { Status } from "./Status";
import { Num, Text } from "./Text";
import { useTheme, type Colors } from "./theme";

const OUT = easing("out");
const LINEAR = Easing.linear;

// ---------- header + tour link ----------

/** The header row: the logo (104) left, the EN / FR pill (104) right, 44 tall (.rise header). */
export function WelcomeHeader() {
  const insets = useSafeAreaInsets();
  return (
    <Rise>
      <View style={{ paddingTop: 14 + insets.top }}>
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 6, paddingHorizontal: 20 }}>
          <Logo width={104} />
          <LangSwitch width={104} />
        </View>
      </View>
    </Rise>
  );
}

/** "Watch the 60-second tour": 13.5 muted, a play glyph, 30 tall with a 44 tap. */
export function TourLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="link" accessibilityLabel={label} hitSlop={{ top: 7, bottom: 7 }}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 30 }}>
      <Glyph name="play" size={18} color="muted" weight={1.8} />
      <Text size={13.5} color="muted">{label}</Text>
    </Press>
  );
}

// ---------- looping motion ----------

/** A 0 → 1 loop (period in ms) that starts `phase` of the way round (the board's negative delays). Reduced motion: it holds still. */
function useLoop(period: number, phase = 0): SharedValue<number> {
  const reduced = useReducedMotion();
  const p = useSharedValue(phase);
  useEffect(() => {
    cancelAnimation(p);
    p.value = phase;
    if (reduced) return;
    p.value = withSequence(
      withTiming(1, { duration: (1 - phase) * period, easing: LINEAR }),
      withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: period, easing: LINEAR })), -1),
    );
    return () => cancelAnimation(p);
  }, [reduced, period, phase, p]);
  return p;
}

/** .w-bob: the element floats up 7 and back, 5.5 to 7 s. */
function Bob({ period, phase = 0, style, children }: { period: number; phase?: number; style: object; children?: ReactNode }) {
  const p = useLoop(period, phase);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: -7 * ((1 - Math.cos(2 * Math.PI * p.value)) / 2) }] }));
  return <Animated.View style={[{ position: "absolute" }, style, anim]}>{children}</Animated.View>;
}

/** .w-wave: five 3-wide bars, 5 to 20 tall, 1.2 s, each its own offset. */
function Wave() {
  const { colors } = useTheme();
  const delays = [0, 0.2, 0.5, 0.8, 0.35];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 22 }}>
      {delays.map((d, i) => <WaveBar key={i} phase={d / 1.2} color={colors.acc} />)}
    </View>
  );
}
function WaveBar({ phase, color }: { phase: number; color: string }) {
  const reduced = useReducedMotion();
  const p = useLoop(1200, reduced ? 0.5 : phase);
  const anim = useAnimatedStyle(() => ({ height: 5 + 15 * ((1 - Math.cos(2 * Math.PI * p.value)) / 2) }));
  return <Animated.View style={[{ width: 3, borderRadius: 3, backgroundColor: color }, anim]} />;
}

// ---------- art pieces ----------

const shadowOf = (colors: Colors, blur: string) => cssShadow(`0 0 0 1px var(--ring), ${blur} var(--shadow)`, colors);
const FLOAT = "0 24px 48px -24px";

function Halo({ n }: { n: 0 | 1 | 2 }) {
  const { scheme } = useTheme();
  const { h1, h2 } = welcomeBoard.halo[n];
  const blob = (c: [string, number], left: number, top: number, id: string) => (
    <Svg width={230} height={230} style={{ position: "absolute", left, top }}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c[0]} stopOpacity={c[1]} />
          <Stop offset="1" stopColor={c[0]} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={115} cy={115} r={115} fill={`url(#${id})`} />
    </Svg>
  );
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, opacity: scheme === "dark" ? 0.7 : 1 }}>
      {blob(h1, 50, 10, `h1-${n}`)}
      {blob(h2, 130, 60, `h2-${n}`)}
    </View>
  );
}

function Ring({ size, faded }: { size: number; faded?: boolean }) {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: "50%", top: "50%", width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, borderRadius: size / 2, opacity: faded ? 0.6 : 1, boxShadow: `0 0 0 1px ${colors.line2}` }} />
  );
}

function Card({ left, top, width, children, style }: { left: number; top: number; width?: number; children?: ReactNode; style?: object }) {
  const { colors } = useTheme();
  return (
    <View style={[{ position: "absolute", left, top, width, backgroundColor: colors.card, borderRadius: 22, boxShadow: shadowOf(colors, FLOAT) }, style]}>{children}</View>
  );
}

function Orb({ left, top, size, icon, tone, glyph, period, phase }: { left: number; top: number; size: number; icon: IconName; tone: Tone; glyph: number; period: number; phase: number }) {
  const { colors } = useTheme();
  return (
    <Bob period={period} phase={phase} style={{ left, top }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", boxShadow: shadowOf(colors, "0 18px 36px -18px") }}>
        <Icon name={icon} tone={tone} size={glyph} />
      </View>
    </Bob>
  );
}

function Spark({ left, top, size, color }: { left: number; top: number; size: number; color: string }) {
  return <View pointerEvents="none" style={{ position: "absolute", left, top, width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** .w-ln: a 7 tall placeholder line. */
function Ln({ w, tone = "sunk", h = 7 }: { w: DimensionValue; tone?: "sunk" | "line2"; h?: number }) {
  const { colors } = useTheme();
  return <View style={{ width: w, height: h, borderRadius: 7, backgroundColor: colors[tone] }} />;
}

function Between({ children, gap = 10, align = "center", mt }: { children: ReactNode; gap?: number; align?: "center" | "baseline"; mt?: number }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: align, gap, marginTop: mt }}>{children}</View>;
}

function Slide1({ amount }: { amount: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <>
      <Halo n={0} />
      <Ring size={262} />
      <Ring size={190} faded />
      <Bob period={6000} style={{ left: 92, top: 52, width: 176 }}>
        <View style={{ padding: 16, backgroundColor: colors.card, borderRadius: 22, boxShadow: shadowOf(colors, FLOAT), transform: [{ rotate: "-3deg" }] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="doc" tone="violet" size={24} />
            <View style={{ flexGrow: 1, gap: 5 }}><Ln w="70%" tone="line2" /><Ln w="44%" h={5} /></View>
          </View>
          <View style={{ gap: 9, marginTop: 16 }}>
            <Between><Ln w="58%" /><Ln w="18%" /></Between>
            <Between><Ln w="46%" /><Ln w="22%" /></Between>
            <Between><Ln w="64%" /><Ln w="16%" /></Between>
          </View>
          <View style={{ height: 1, backgroundColor: colors.line, marginTop: 14, marginBottom: 10 }} />
          <Between gap={6} align="baseline">
            <Text size={11.5} color="muted">{t("welcome.total")}</Text>
            <Num size={16} weight={600} tracking={-0.03}>{amount}</Num>
          </Between>
        </View>
      </Bob>
      <Orb left={40} top={170} size={74} icon="mic" tone="violet" glyph={38} period={7000} phase={2 / 7} />
      <Bob period={5500} phase={1 / 5.5} style={{ left: 222, top: 206 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.card, boxShadow: shadowOf(colors, FLOAT) }}>
          <Wave />
          <Num size={12.5} weight={500} color="muted">0:12</Num>
        </View>
      </Bob>
      <Spark left={268} top={44} size={10} color={welcomeBoard.spark.s1a} />
      <Spark left={70} top={96} size={6} color={welcomeBoard.spark.s1b} />
    </>
  );
}

function MiniAvatar({ initials, tint, ring, first }: { initials: string; tint: 1 | 2 | 3; ring: "ok-dot" | "warn-dot"; first?: boolean }) {
  const { colors } = useTheme();
  const tone = avatarTint(tint, colors);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: 28, height: 28, borderRadius: 14, marginLeft: first ? 0 : 4, backgroundColor: tone.bg, alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 2px ${colors.card}, 0 0 0 3.5px ${colors[ring]}` }}>
      <Text size={10.5} weight={600} color={tone.fg} allowFontScaling={false}>{initials}</Text>
    </View>
  );
}

function Slide2({ progress }: { progress: string }) {
  const { colors } = useTheme();
  return (
    <>
      <Halo n={1} />
      <Ring size={262} />
      <Card left={84} top={40} width={190} style={{ height: 70, opacity: 0.55, transform: [{ scale: 0.9 }] }} />
      <Card left={78} top={56} width={202} style={{ height: 70, opacity: 0.8, transform: [{ scale: 0.95 }], flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10 }}>
        <Icon name="cal" tone="azure" size={22} />
        <Ln w="50%" />
      </Card>
      <Bob period={6000} style={{ left: 70, top: 86, width: 218 }}>
        <View style={{ padding: 16, backgroundColor: colors.card, borderRadius: 22, boxShadow: shadowOf(colors, FLOAT) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name="house" tone="teal" size={30} />
            <View style={{ flexGrow: 1, flexShrink: 1, gap: 5 }}><Ln w="76%" tone="line2" /><Ln w="48%" h={5} /></View>
            <Num size={13.5} weight={600}>{progress}</Num>
          </View>
          <View style={{ height: 5, borderRadius: 5, backgroundColor: colors.sunk, marginTop: 14, overflow: "hidden" }}>
            <View style={{ width: "64%", height: 5, borderRadius: 5, backgroundColor: colors.acc }} />
          </View>
          <Between mt={14}>
            <View style={{ flexDirection: "row" }}>
              <MiniAvatar first initials="LB" tint={1} ring="ok-dot" />
              <MiniAvatar initials="AO" tint={2} ring="ok-dot" />
              <MiniAvatar initials="SM" tint={3} ring="warn-dot" />
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Icon name="photo" tone="sky" size={22} />
              <Icon name="receipt" tone="amber" size={22} />
            </View>
          </Between>
        </View>
      </Bob>
      <Orb left={250} top={214} size={62} icon="cone" tone="amber" glyph={32} period={7000} phase={2 / 7} />
      <Orb left={46} top={226} size={52} icon="users" tone="lilac" glyph={26} period={5500} phase={1 / 5.5} />
      <Spark left={290} top={70} size={8} color={welcomeBoard.spark.s2} />
    </>
  );
}

function Slide3({ amount }: { amount: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <>
      <Halo n={2} />
      <Ring size={262} />
      <Ring size={190} faded />
      <Bob period={6000} style={{ left: 78, top: 70, width: 202 }}>
        <View style={{ padding: 18, backgroundColor: colors.card, borderRadius: 22, boxShadow: shadowOf(colors, FLOAT) }}>
          <Between>
            <Icon name="receipt" tone="amber" size={24} />
            <Status tone="ok">{t("welcome.paid")}</Status>
          </Between>
          <Num size={30} weight={600} tracking={-0.045} style={{ marginTop: 14 }}>{amount}</Num>
          <View style={{ gap: 7, marginTop: 10 }}><Ln w="66%" /><Ln w="40%" /></View>
        </View>
      </Bob>
      <Orb left={250} top={18} size={64} icon="check" tone="sage" glyph={34} period={7000} phase={2 / 7} />
      <Orb left={48} top={206} size={60} icon="card" tone="indigo" glyph={30} period={5500} phase={1 / 5.5} />
      <Bob period={5500} phase={1 / 5.5} style={{ left: 196, top: 236 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.card, boxShadow: shadowOf(colors, FLOAT) }}>
          <Icon name="bank" tone="sage" size={20} />
          <Text size={11.5} weight={500} color="t2">{t("welcome.interac")}</Text>
        </View>
      </Bob>
      <Spark left={60} top={60} size={8} color={welcomeBoard.spark.s3} />
    </>
  );
}

// ---------- carousel ----------

function Arrow({ dir, label, disabled, onPress }: { dir: "prev" | "next"; label: string; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const next = dir === "next";
  const stroke = next ? colors["on-inv"] : colors.ink;
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: next ? colors.inv : colors.sunk, opacity: disabled ? 0.35 : 1 }}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d={next ? "m9 5 7 7-7 7" : "m15 5-7 7 7 7"} />
      </Svg>
    </Press>
  );
}

function Dot({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const w = useSharedValue(on ? 22 : 8);
  useEffect(() => {
    w.value = withTiming(on ? 22 : 8, { duration: reduced ? 0 : 500, easing: OUT });
  }, [on, reduced, w]);
  const anim = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} style={{ width: 30, height: 44, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ height: 8, borderRadius: 8, backgroundColor: on ? colors.ink : colors.line2 }, anim]} />
    </Pressable>
  );
}

/** .w-fade: the title and sub rise 8 and fade in over .6 s each time the slide changes. */
function Fade({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => { if (!reduced) t.value = withTiming(1, { duration: 600, easing: OUT }); }, [reduced, t]);
  const anim = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * 8 }] }));
  return <Animated.View style={anim}>{children}</Animated.View>;
}

const SLIDES = 3;

export function WelcomeCarousel({ locale }: { locale: Locale }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(390);
  const x = useSharedValue(0);
  const live = useRef({ index: 0, width: 390 });
  live.current = { index, width };

  const settle = (i: number, w = width) => {
    cancelAnimation(x);
    x.value = withTiming(-i * w, { duration: reduced ? 0 : 700, easing: OUT });
  };
  const go = (n: number) => {
    const i = Math.max(0, Math.min(SLIDES - 1, n));
    setIndex(i);
    settle(i);
  };
  useEffect(() => { x.value = -live.current.index * width; }, [width, x]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => cancelAnimation(x),
      onPanResponderMove: (_, g) => { x.value = -live.current.index * live.current.width + g.dx; },
      onPanResponderRelease: (_, g) => {
        const { index: i, width: w } = live.current;
        const n = g.dx < -w * 0.15 || g.vx < -0.5 ? i + 1 : g.dx > w * 0.15 || g.vx > 0.5 ? i - 1 : i;
        const next = Math.max(0, Math.min(SLIDES - 1, n));
        setIndex(next);
        settle(next, w);
      },
      onPanResponderTerminate: () => settle(live.current.index, live.current.width),
    }),
  ).current;

  const track = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const art = [
    <Slide1 key={0} amount={money(4131.05, locale)} />,
    <Slide2 key={1} progress={percent(0.64, locale)} />,
    <Slide3 key={2} amount={money(2340, locale)} />,
  ];
  const slideProps = (i: number) => ({ accessibilityLabel: t("welcome.slideOf", { n: i + 1, total: SLIDES }), "aria-roledescription": "slide" }) as object;

  return (
    <>
      <Rise delay={60} style={{ marginTop: 10 }}>
        <View style={{ overflow: "hidden" }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...pan.panHandlers}>
          <Animated.View style={[{ flexDirection: "row", width: width * SLIDES }, track]}>
            {art.map((a, i) => (
              <View key={i} {...slideProps(i)} style={{ width, paddingHorizontal: 24, flexShrink: 0 }}>
                <Pressable onPress={() => go(index + 1 > SLIDES - 1 ? 0 : index + 1)} accessible={false} style={{ height: 292, marginHorizontal: -8 }}>
                  {a}
                </Pressable>
              </View>
            ))}
          </Animated.View>
        </View>
      </Rise>
      <View style={{ paddingTop: 4, paddingHorizontal: 24, minHeight: 150 }} accessibilityLiveRegion="polite">
        <Fade key={index}>
          <Text accessibilityRole="header" size={28} weight={600} tracking={-0.04} leading={1.12}>{t(`welcome.s${index + 1}.title`)}</Text>
          <Text size={15} color="muted" leading={1.5} style={{ marginTop: 10 }}>{t(`welcome.s${index + 1}.sub`)}</Text>
        </Fade>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 6, paddingHorizontal: 20 }}>
        <Arrow dir="prev" label={t("welcome.prev")} disabled={index === 0} onPress={() => go(index - 1)} />
        <View accessibilityRole="tablist" accessibilityLabel={t("welcome.slides")} style={{ flexDirection: "row", alignItems: "center" }}>
          {[0, 1, 2].map((n) => <Dot key={n} on={n === index} label={t("welcome.dot", { n: n + 1 })} onPress={() => go(n)} />)}
        </View>
        <Arrow dir="next" label={t("welcome.next")} disabled={index === SLIDES - 1} onPress={() => go(index + 1)} />
      </View>
    </>
  );
}
