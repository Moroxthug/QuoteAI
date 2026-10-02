// COMPONENTS §3. Light and night token sets; the light "ground" option overrides a few light
// tokens (and brings a fixed fade on dusk / dawn / veil / iris). Night ignores grounds.
// Appearance follows the phone unless overridden (Settings → Display, and the sandbox); the choice and the text size are kept on the phone.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { kvGet, kvSet } from "@/lib/kv";
import { tokens, type GroundName } from "@/theme/tokens";

export type ColorName = keyof typeof tokens.color.light;
export type Colors = Record<ColorName, string>;
export type Appearance = "auto" | "light" | "dark";
/** Settings → Display → Text size: small, the default and large (a factor on every text). */
export const TEXT_SCALES = [0.92, 1, 1.15] as const;
const APPEARANCE_KEY = "quoteai_appearance";
const TEXT_SCALE_KEY = "quoteai_text_scale";

type ThemeState = {
  scheme: "light" | "dark";
  colors: Colors;
  ground: GroundName;
  /** The ground's fixed fade as a CSS gradient string, light only. */
  fade: string | null;
  appearance: Appearance;
  setAppearance: (a: Appearance) => void;
  /** 0 small, 1 default, 2 large. */
  textSize: 0 | 1 | 2;
  textScale: number;
  setTextSize: (i: 0 | 1 | 2) => void;
  setGround: (g: GroundName) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function colorsFor(scheme: "light" | "dark", ground: GroundName): Colors {
  if (scheme === "dark") return { ...tokens.color.dark };
  const { image: _image, ...over } = tokens.ground.options[ground] as Partial<Colors> & { image?: string };
  return { ...tokens.color.light, ...over };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [appearance, setAppearanceState] = useState<Appearance>("auto");
  const [textSize, setTextSizeState] = useState<0 | 1 | 2>(1);
  useEffect(() => {
    let live = true;
    void Promise.all([kvGet(APPEARANCE_KEY), kvGet(TEXT_SCALE_KEY)]).then(([a, s]) => {
      if (!live) return;
      if (a === "light" || a === "dark" || a === "auto") setAppearanceState(a);
      if (s === "0" || s === "1" || s === "2") setTextSizeState(Number(s) as 0 | 1 | 2);
    });
    return () => { live = false; };
  }, []);
  const setAppearance = useCallback((a: Appearance) => { setAppearanceState(a); void kvSet(APPEARANCE_KEY, a); }, []);
  const setTextSize = useCallback((i: 0 | 1 | 2) => { setTextSizeState(i); void kvSet(TEXT_SCALE_KEY, String(i)); }, []);
  const [ground, setGround] = useState<GroundName>(tokens.ground.default as GroundName);
  const scheme = appearance === "auto" ? (system === "dark" ? "dark" : "light") : appearance;
  const value = useMemo<ThemeState>(() => {
    const opt = tokens.ground.options[ground] as { image?: string };
    return { scheme, colors: colorsFor(scheme, ground), ground, fade: scheme === "light" ? opt.image ?? null : null, appearance, setAppearance, textSize, textScale: TEXT_SCALES[textSize], setTextSize, setGround };
  }, [scheme, ground, appearance, textSize, setAppearance, setTextSize]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const t = useContext(ThemeContext);
  if (!t) throw new Error("useTheme outside ThemeProvider");
  return t;
}
