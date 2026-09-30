// The design's shadows are CSS strings over theme variables ("0 10px 30px -8px var(--shadow)").
// React Native (new architecture) takes CSS box-shadow strings, so the tokens are used as they
// are, with var(--x) swapped for the current theme's colour.
import { tokens } from "@/theme/tokens";
import type { Colors } from "./theme";

export function cssShadow(css: string, colors: Colors): string {
  return css.replace(/var\(--([a-z0-9-]+)\)/g, (_, name: string) => colors[name as keyof Colors] ?? "transparent");
}

export function shadow(name: keyof typeof tokens.shadow, colors: Colors): string {
  return cssShadow(tokens.shadow[name], colors);
}
