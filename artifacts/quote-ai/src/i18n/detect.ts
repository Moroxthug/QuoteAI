// The first render's language, decided without React so main.tsx can load
// that language's strings (Phase 115) in parallel with the App chunk.
import type { Lang } from "./translations";

export const LANG_STORAGE_KEY = "quoteai-lang";

/** True for any URL under the /fr locale prefix (/fr, /fr/, /fr/soumissions/...). */
export function isFrenchPath(pathname: string): boolean {
  return pathname === "/fr" || pathname.startsWith("/fr/");
}

/**
 * English-locale routes: pages that have a French twin under /fr, so the URL
 * decides the language rather than a stored preference. Phase 81 added the
 * pricing, pilot and province pages to the list — without it, a visitor whose
 * last visit was French would hydrate the English /pricing in French and
 * React would tear the prerendered markup.
 */
export function isEnglishLocalePath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/quotes/") ||
    pathname.startsWith("/provinces/") ||
    pathname === "/pricing" || pathname === "/pricing/" ||
    pathname === "/pilot" || pathname === "/pilot/" ||
    pathname === "/privacy-policy" || pathname === "/privacy-policy/" ||
    pathname === "/terms" || pathname === "/terms/"
  );
}

export function detectInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  // The URL is the source of truth for prerendered/SEO routes — a /fr/ URL
  // must always render French, regardless of a stale localStorage value,
  // so static hreflang/lang metadata and the hydrated React tree agree.
  // The same holds for "/" and /quotes/*: the sync effect in the provider
  // would flip them to English on mount anyway, and the homepage is
  // server-rendered in English (Phase 68), so starting from a stored "fr"
  // would only produce a hydration mismatch and a French flash.
  if (isFrenchPath(window.location.pathname)) return "fr";
  if (isEnglishLocalePath(window.location.pathname)) return "en";
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === "en" || stored === "fr") return stored;
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall through
  }
  return navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
}
