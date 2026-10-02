// COMPONENTS §2. `Icon`: a glyph from icons.json in 3 layers (d1 full, d2 60 %, d3 35 %),
// each filled with the tone's diagonal gradient (top-left c0 → bottom-right c1), brightened
// ×1.15 at night. No box, no tile. `Glyph`: the plain stroke glyphs in currentColor, drawn
// exactly as the boards draw them (back, close, chevron, plus, minus, search, more, check…).
import { useId } from "react";
import { Platform } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import icons from "@/theme/icons.json";
import tones from "@/theme/tones.json";
import { useTheme, type ColorName } from "./theme";

/** Glyphs the screens' boards draw that the handoff's icons.json doesn't carry (Settings → Text size: a letter A with a dot). */
const EXTRA_GLYPHS = { text: { d1: "M12 8L17 21.5H14.8L13.8 18.6H10.2L9.2 21.5H7Z", d2: "M17.5 18.8a2.7 2.7 0 1 0 5.4 0a2.7 2.7 0 1 0 -5.4 0Z", d3: "M0 0Z" } } as const;
export type IconName = keyof typeof icons.glyphs | keyof typeof EXTRA_GLYPHS;

// Android / iOS accessibility props; react-native-svg passes them to the DOM on web.
const a11y = (label?: string) => (Platform.OS === "web" ? {} : { accessible: !!label, accessibilityLabel: label, importantForAccessibility: label ? ("yes" as const) : ("no-hide-descendants" as const) });
export type Tone = keyof typeof tones;

function brighten(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.min(255, Math.round(((n >> s) & 255) * k)).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

export function Icon({ name, tone = "violet", size = 28, label }: { name: IconName; tone?: Tone; size?: number; label?: string }) {
  const { scheme } = useTheme();
  const id = useId().replace(/:/g, "");
  const t = tones[tone];
  const k = scheme === "dark" ? 1.15 : 1;
  const g = (name in EXTRA_GLYPHS ? EXTRA_GLYPHS[name as keyof typeof EXTRA_GLYPHS] : icons.glyphs[name as keyof typeof icons.glyphs]) as { d1: string; d2: string; d3: string };
  const layers: [string, number][] = [
    [g.d3, 0.35],
    [g.d2, 0.6],
    [g.d1, 1],
  ];
  return (
    <Svg width={size} height={size} viewBox={icons.viewBox} {...a11y(label)}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={brighten(t.c0, k)} />
          <Stop offset="1" stopColor={brighten(t.c1, k)} />
        </LinearGradient>
      </Defs>
      {layers.map(([d, o], i) => (d && d !== "M0 0Z" ? <Path key={i} d={d} fill={`url(#${id})`} fillOpacity={o} /> : null))}
    </Svg>
  );
}

export type GlyphName = "lock" | "back" | "close" | "chevron" | "chevronDown" | "plus" | "minus" | "search" | "more" | "check" | "alert" | "play" | "mic" | "eye" | "eyeOff" | "gear" | "camera" | "arrowUp" | "dollar" | "photo" | "user" | "cloud" | "cloudRain" | "sun" | "phone" | "text" | "mail" | "grip" | "micOff" | "keyboard" | "wave";

type Stroke = { w: number; round?: boolean };
const GLYPHS: Record<GlyphName, { stroke?: Stroke; draw: (c: string) => React.ReactNode }> = {
  lock: { stroke: { w: 2.2, round: true }, draw: () => (<><Rect x="5" y="11" width="14" height="9" rx="2" /><Path d="M8 11V8a4 4 0 0 1 8 0v3" /></>) },
  back: { stroke: { w: 2, round: true }, draw: () => <Path d="m15 5-7 7 7 7" /> },
  close: { stroke: { w: 2.2 }, draw: () => <Path d="M6 6l12 12M18 6 6 18" /> },
  chevron: { stroke: { w: 2, round: true }, draw: () => <Path d="m9 6 6 6-6 6" /> },
  chevronDown: { stroke: { w: 2, round: true }, draw: () => <Path d="m6 9 6 6 6-6" /> },
  plus: { stroke: { w: 2.2 }, draw: () => <Path d="M5 12h14M12 5v14" /> },
  minus: { stroke: { w: 2.2 }, draw: () => <Path d="M5 12h14" /> },
  search: { stroke: { w: 1.9 }, draw: () => (<><Circle cx="11" cy="11" r="6.5" /><Path d="m20 20-4-4" /></>) },
  more: {
    draw: (c) => (
      <>
        <Circle cx="5.5" cy="12" r="1.6" fill={c} />
        <Circle cx="12" cy="12" r="1.6" fill={c} />
        <Circle cx="18.5" cy="12" r="1.6" fill={c} />
      </>
    ),
  },
  check: { stroke: { w: 3, round: true }, draw: () => <Path d="m5 12.5 4.5 4.5L19 7.5" /> },
  alert: { stroke: { w: 2.2 }, draw: () => (<><Circle cx="12" cy="12" r="9" /><Path d="M12 7.5v5.5M12 16.3v.2" /></>) },
  play: { stroke: { w: 1.8 }, draw: (c) => (<><Circle cx="12" cy="12" r="9" /><Path d="M10.2 8.8v6.4l5-3.2z" fill={c} stroke="none" /></>) },
  eye: { stroke: { w: 1.8, round: true }, draw: () => (<><Path d="M2.5 12C4.5 7.8 8 5.5 12 5.5s7.5 2.3 9.5 6.5c-2 4.2-5.5 6.5-9.5 6.5S4.5 16.2 2.5 12Z" /><Circle cx="12" cy="12" r="3" /></>) },
  eyeOff: { stroke: { w: 1.8, round: true }, draw: () => <Path d="M3 3l18 18M10.6 5.6A10 10 0 0 1 12 5.5c4 0 7.5 2.3 9.5 6.5a12.6 12.6 0 0 1-2.8 3.8M6.2 6.9C4.7 8.1 3.4 9.9 2.5 12c2 4.2 5.5 6.5 9.5 6.5 1.7 0 3.3-.4 4.7-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2" /> },
  gear: { stroke: { w: 1.8, round: true }, draw: () => (<><Circle cx="12" cy="12" r="3" /><Path d="M19.4 13.5l1.6 1-1.8 3.2-1.8-.6a7 7 0 0 1-2.2 1.3L14.8 21h-3.6l-.4-2.6a7 7 0 0 1-2.2-1.3l-1.8.6-1.8-3.2 1.6-1a7 7 0 0 1 0-3l-1.6-1 1.8-3.2 1.8.6a7 7 0 0 1 2.2-1.3L11.2 3h3.6l.4 2.6a7 7 0 0 1 2.2 1.3l1.8-.6 1.8 3.2-1.6 1a7 7 0 0 1 0 3z" /></>) },
  arrowUp: { stroke: { w: 2.3, round: true }, draw: () => <Path d="M12 19V5M6 11l6-6 6 6" /> },
  dollar: { stroke: { w: 1.8, round: true }, draw: () => <Path d="M12 3v18M16.5 7.5c-.7-1.3-2.4-2-4.5-2-2.6 0-4.3 1.3-4.3 3.1 0 4.4 9 2.3 9 6.8 0 1.9-1.8 3.2-4.6 3.2-2.3 0-4.1-.9-4.8-2.4" /> },
  photo: { stroke: { w: 1.8, round: true }, draw: () => (<><Rect x="3.5" y="5" width="17" height="14" rx="3" /><Circle cx="9" cy="10" r="1.6" /><Path d="m20 16-5-5-8 8" /></>) },
  user: { stroke: { w: 1.8, round: true }, draw: () => (<><Circle cx="12" cy="8" r="3.6" /><Path d="M5 20a7 7 0 0 1 14 0" /></>) },
  cloud: { stroke: { w: 1.8, round: true }, draw: () => <Path d="M7 16a4.5 4.5 0 1 1 1-8.9A6 6 0 0 1 19 8.5 3.8 3.8 0 0 1 17.5 16z" /> },
  cloudRain: { stroke: { w: 1.8, round: true }, draw: () => (<><Path d="M7 16a4.5 4.5 0 1 1 1-8.9A6 6 0 0 1 19 8.5 3.8 3.8 0 0 1 17.5 16z" /><Path d="M9 18.6l-.8 1.5M13 18.6l-.8 1.5M17 18.6l-.8 1.5" /></>) },
  sun: { stroke: { w: 1.8, round: true }, draw: () => (<><Circle cx="12" cy="12" r="4" /><Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>) },
  phone: { stroke: { w: 2, round: true }, draw: () => <Path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /> },
  text: { stroke: { w: 2, round: true }, draw: () => <Path d="M4 5h16v11H9l-5 4z" /> },
  mail: { stroke: { w: 2, round: true }, draw: () => (<><Rect x="3" y="5" width="18" height="14" rx="2" /><Path d="m4 7 8 6 8-6" /></>) },
  grip: { draw: (c) => (<>{[6, 12, 18].map((y) => [9, 15].map((x) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill={c} />))}</>) },
  camera: { stroke: { w: 2.2, round: true }, draw: () => (<><Path d="M4 8h3l2-3h6l2 3h3v11H4z" /><Circle cx="12" cy="13" r="3.2" /></>) },
  mic: { stroke: { w: 2, round: true }, draw: () => (<><Rect x="9" y="3" width="6" height="11" rx="3" /><Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>) },
  micOff: { stroke: { w: 1.9, round: true }, draw: () => <Path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11a6.4 6.4 0 0 1-.6 2.7M12 17.5V21M4 4l16 16" /> },
  keyboard: { stroke: { w: 1.7, round: true }, draw: () => (<><Rect x="2.5" y="6" width="19" height="12" rx="3" /><Path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8" /></>) },
  wave: { stroke: { w: 1.9, round: true }, draw: () => <Path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" /> },
};

/** A stroke glyph. `weight` overrides the board's stroke width where a board draws it heavier (e.g. plus 2.4, check 3.2). */
export function Glyph({ name, size = 20, color = "ink", tint, weight }: { name: GlyphName; size?: number; color?: ColorName; /** A board value outside the theme (board.white). */ tint?: string; weight?: number }) {
  const { colors } = useTheme();
  const c = tint ?? colors[color];
  const spec = GLYPHS[name];
  const s = spec.stroke;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={s ? c : "none"} strokeWidth={weight ?? s?.w} strokeLinecap="round" strokeLinejoin={s?.round ? "round" : undefined} {...a11y()}>
      {spec.draw(c)}
    </Svg>
  );
}
