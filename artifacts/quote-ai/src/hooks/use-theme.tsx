import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

const STORAGE_KEY = "quoteai-theme";
export type Theme = "light" | "dark";

/**
 * Dark mode only applies to the authenticated dashboard shell. The public
 * marketing/SEO/blog pages were never dark-mode-audited (mixed bg-white
 * cards outside the token system), so forcing `.dark` there renders a
 * half-dark, half-light page — this keeps a dashboard-set preference from
 * leaking onto the public site when the user navigates back out.
 */
export function isDarkModeEligiblePath(pathname: string): boolean {
  return pathname.startsWith("/dashboard");
}

function detectInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall through
  }
  // No OS-preference auto-detect: the public marketing/SEO pages aren't
  // dark-mode-audited, so an unset preference always starts light. Dark
  // mode only turns on when the user explicitly opts in via the toggle.
  return "light";
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(detectInitialTheme);
  const [pathname] = useLocation();

  useEffect(() => {
    const dark = theme === "dark" && isDarkModeEligiblePath(pathname);
    document.documentElement.classList.toggle("dark", dark);
  }, [theme, pathname]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore write failures
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
