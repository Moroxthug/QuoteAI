import { Component, type ReactNode } from "react";
import { translations, type Lang } from "@/i18n/translations";

// Class components can't use hooks, so read the persisted language choice
// directly (mirrors LanguageContext's detection logic) instead of useLanguage().
function getLang(): Lang {
  try {
    const stored = window.localStorage.getItem("quoteai-lang");
    if (stored === "en" || stored === "fr") return stored;
  } catch {
    // ignore
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

function t(key: string): string {
  const lang = getLang();
  return translations[lang][key] ?? translations.en[key] ?? key;
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Without this, any runtime error anywhere in the tree unmounts React
// entirely and leaves an empty <div id="root">, which is indistinguishable
// from the page never having rendered at all — the worst possible outcome
// for both real visitors and JS-executing crawlers.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    console.error("Unhandled error in component tree", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-background">
          <h1 className="text-2xl font-bold text-foreground mb-3">{t("errorBoundary.title")}</h1>
          <p className="text-muted-foreground max-w-md mb-6">
            {t("errorBoundary.bodyPrefix")}{" "}
            <a href="mailto:info@quoteai.ca" className="text-violet-600 font-medium">
              info@quoteai.ca
            </a>
            .
          </p>
          <a
            href="/"
            className="btn-gradient inline-flex h-11 items-center justify-center px-6 text-sm font-semibold rounded-lg"
          >
            {t("errorBoundary.backHome")}
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
