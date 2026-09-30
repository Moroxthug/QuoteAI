// COMPONENTS §3. Light and night token sets; the light "ground" option overrides a few light
// tokens (and brings a fixed fade on dusk / dawn / veil / iris). Night ignores grounds.
// Appearance follows the phone unless overridden (the sandbox switch for now, Settings in 128).
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { tokens, type GroundName } from "@/theme/tokens";

export type ColorName = keyof typeof tokens.color.light;
export type Colors = Record<ColorName, string>;
export type Appearance = "auto" | "light" | "dark";

type ThemeState = {
  scheme: "light" | "dark";
  colors: Colors;
  ground: GroundName;
  /** The ground's fixed fade as a CSS gradient string, light only. */
  fade: string | null;
  appearance: Appearance;
  setAppearance: (a: Appearance) => void;
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
  const [appearance, setAppearance] = useState<Appearance>("auto");
  const [ground, setGround] = useState<GroundName>(tokens.ground.default as GroundName);
  const scheme = appearance === "auto" ? (system === "dark" ? "dark" : "light") : appearance;
  const value = useMemo<ThemeState>(() => {
    const opt = tokens.ground.options[ground] as { image?: string };
    return { scheme, colors: colorsFor(scheme, ground), ground, fade: scheme === "light" ? opt.image ?? null : null, appearance, setAppearance, setGround };
  }, [scheme, ground, appearance]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const t = useContext(ThemeContext);
  if (!t) throw new Error("useTheme outside ThemeProvider");
  return t;
}
