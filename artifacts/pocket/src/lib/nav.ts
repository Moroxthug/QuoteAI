// Where the app's links go. A screen from a later phase isn't built yet, but its row or link
// stays on screen exactly as designed (owner ruling 2026-09-30) and opens the one shared
// "Coming soon" screen with that screen's real title. When a phase builds the screen, its
// entry moves from LATER to BUILT and nothing else changes.
import type { Href } from "expo-router";

/** Screens built so far, by the design's screen name. */
export const BUILT = {
  Menu: "/menu",
  SmartHome: "/home",
  Quotes: "/quotes",
  Clients: "/clients",
} as const;

export type BuiltScreen = keyof typeof BUILT;

/** The Coming soon screen for a later screen, titled with its already-translated name. */
export function comingSoonHref(title: string): Href {
  return { pathname: "/coming-soon", params: { title } } as Href;
}

export function builtHref(screen: BuiltScreen): Href {
  return BUILT[screen] as Href;
}
