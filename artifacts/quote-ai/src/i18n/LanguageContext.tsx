import { createContext, useCallback, useContext, useMemo, useState, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { type Lang, translations } from "./translations";

const STORAGE_KEY = "quoteai-lang";

/** True for any URL under the /fr locale prefix (/fr, /fr/, /fr/soumissions/...). */
export function isFrenchPath(pathname: string): boolean {
  return pathname === "/fr" || pathname.startsWith("/fr/");
}

function detectInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  // The URL is the source of truth for prerendered/SEO routes — a /fr/ URL
  // must always render French, regardless of a stale localStorage value,
  // so static hreflang/lang metadata and the hydrated React tree agree.
  if (isFrenchPath(window.location.pathname)) return "fr";
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  // The URL is authoritative for locale-routed pages (/, /quotes/*,
  // /fr, /fr/soumissions/*): keep `lang` in sync as the user navigates
  // client-side (Link clicks, back/forward) so hydrated French routes
  // never render with stale English context state, and vice versa.
  // wouter's useLocation re-renders on every client-side navigation
  // (Link, setLocation, and popstate alike), so this stays in sync.
  const [wouterPath] = useLocation();
  useEffect(() => {
    const isEnglishLocaleRoute = wouterPath === "/" || wouterPath.startsWith("/quotes/");
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

  const t = useCallback(
    (key: string) => translations[lang][key] ?? translations.en[key] ?? key,
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
