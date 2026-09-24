import { createContext, useCallback, useContext, useMemo, useState, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useLocation } from "wouter";
import { type Lang } from "./translations";
import { lookup, subscribeTranslations, getTranslationsVersion } from "./registry";
import { setMoneyLang } from "@/lib/money";

const STORAGE_KEY = "quoteai-lang";

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
function isEnglishLocalePath(pathname: string): boolean {
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

function detectInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  // The URL is the source of truth for prerendered/SEO routes — a /fr/ URL
  // must always render French, regardless of a stale localStorage value,
  // so static hreflang/lang metadata and the hydrated React tree agree.
  // The same holds for "/" and /quotes/*: the sync effect below would flip
  // them to English on mount anyway, and the homepage is server-rendered in
  // English (Phase 68), so starting from a stored "fr" would only produce a
  // hydration mismatch and a French flash.
  if (isFrenchPath(window.location.pathname)) return "fr";
  if (isEnglishLocalePath(window.location.pathname)) return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "fr") return stored;
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall through
  }
  return navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** `initialLang` is only set by the build-time renderer (entry-server.tsx); the browser detects from URL/storage. */
export function LanguageProvider({ children, initialLang }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? detectInitialLang());
  // Phase 94: money helpers (lib/money.ts) format in this language. Set during
  // render, not in an effect, so children rendered in this pass already see it.
  setMoneyLang(lang);

  // The URL is authoritative for locale-routed pages (/, /quotes/*,
  // /fr, /fr/soumissions/*): keep `lang` in sync as the user navigates
  // client-side (Link clicks, back/forward) so hydrated French routes
  // never render with stale English context state, and vice versa.
  // wouter's useLocation re-renders on every client-side navigation
  // (Link, setLocation, and popstate alike), so this stays in sync.
  const [wouterPath] = useLocation();
  useEffect(() => {
    const isEnglishLocaleRoute = isEnglishLocalePath(wouterPath);
    if (isFrenchPath(wouterPath) && lang !== "fr") {
      setLangState("fr");
    } else if (isEnglishLocaleRoute && lang !== "en") {
      setLangState("en");
    }
    // Any other path (dashboard, auth, blog, ...) doesn't have a distinct
    // French URL yet, so it doesn't force a language — the toggle there
    // just flips the client-side chrome, matching the pre-existing behaviour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wouterPath]);

  // Keep <html lang> correct regardless of whether `lang` changed via the
  // manual toggle (setLang below) or the URL-sync effect above.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore write failures
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "en" ? "fr" : "en");
  }, [lang, setLang]);

  // Re-create `t` when a lazy chunk registers more keys (dashboard dictionary).
  const dictVersion = useSyncExternalStore(subscribeTranslations, getTranslationsVersion, getTranslationsVersion);
  const t = useCallback(
    (key: string) => lookup(lang, key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, dictVersion]
  );

  const value = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
