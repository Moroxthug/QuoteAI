import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { ActionSheet, type SheetAction } from "./action-sheet";

type HeaderOverride = { title?: string; backHref?: string | null; actions?: Array<SheetAction | false | null | undefined> };
type Ctx = { override: HeaderOverride | null; set: (o: HeaderOverride | null) => void };

const HeaderContext = createContext<Ctx | null>(null);

/** Wraps the dashboard so a page can name itself in the phone top bar. */
export function MobileHeaderProvider({ children }: { children: ReactNode }) {
  const [override, set] = useState<HeaderOverride | null>(null);
  const value = useMemo(() => ({ override, set }), [override]);
  return <HeaderContext.Provider value={value}>{children}</HeaderContext.Provider>;
}

/**
 * A page's say in the phone top bar: a more specific title than the section
 * ("Kitchen — Dana Smith" instead of "Quotes"), a different parent, and the
 * ⋯ actions. Cleared when the page unmounts. Pass stable values (memoise the
 * actions) — every change re-renders the top bar.
 */
export function useMobileHeader(override: HeaderOverride | null) {
  const ctx = useContext(HeaderContext);
  const set = ctx?.set;
  useEffect(() => {
    if (!set) return;
    set(override);
    return () => set(null);
  }, [set, override]);
}

/**
 * Phase 100 — the phone top bar's left half: ‹ back (when the screen has a
 * parent), then the screen's title, then its ⋯. Hidden above 640 px (CSS),
 * where the page heading and the sidebar already say where you are.
 *
 * The title is `aria-hidden`: the page's own <h1> says the same thing to a
 * screen reader, once.
 */
export function MobilePageHeader({ title, backHref, backLabel }: { title: string; backHref: string | null; backLabel?: string }) {
  const { t } = useLanguage();
  const override = useContext(HeaderContext)?.override;
  const shownTitle = override?.title ?? title;
  const shownBack = override?.backHref !== undefined ? override.backHref : backHref;
  return (
    <>
      {shownBack && (
        <Link href={shownBack} className="tb-back" aria-label={backLabel ? t("mobile.backTo").replace("{section}", backLabel) : t("mobile.back")}>
          <ChevronLeft />
        </Link>
      )}
      <span className="tb-title" aria-hidden="true">{shownTitle}</span>
      {override?.actions && (
        <span className="tb-more">
          <ActionSheet actions={override.actions} plain />
        </span>
      )}
    </>
  );
}
