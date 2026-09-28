import { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useLocation } from "wouter";
import { type Lang } from "./translations";
import { lookup, subscribeTranslations, getTranslationsVersion, ensureStrings, stringsReady, setActiveLang } from "./registry";
import { detectInitialLang, isEnglishLocalePath, isFrenchPath, LANG_STORAGE_KEY } from "./detect";
import { setMoneyLang } from "@/lib/money";

// Phase 115: detection moved to ./detect.ts so main.tsx can run it before React loads.
export { isFrenchPath } from "./detect";

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
  // Phase 115: and the lazy dashboard roots load their strings in it.
  setActiveLang(lang);

  // Phase 115: each language is its own chunk. Switch once the target's
  // strings are loaded (immediately when they already are), so nothing renders
  // raw keys; the last request wins if two overlap.
  const requested = useRef(lang);
  const switchTo = useCallback((next: Lang) => {
    requested.current = next;
    if (stringsReady(next)) {
      setLangState(next);
      return;
    }
    ensureStrings(next).then(
      () => { if (requested.current === next) setLangState(next); },
      () => { /* offline: stay in the current language */ },
    );
  }, []);

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
      switchTo("fr");
    } else if (isEnglishLocaleRoute && lang !== "en") {
      switchTo("en");
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
    switchTo(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore write failures
    }
  }, [switchTo]);

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
