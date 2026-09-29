/**
 * Phase 144 — the Pocket shell (docs/POCKET-DESIGN-PLAN.md), from the canvas's Home,
 * Quote draft, Menu and Settings artboards:
 *
 * - the floating pill tab bar (Home · Quotes · Jobs · Clients) with the black assistant
 *   button beside it — on the section screens only, as on Home; a screen you open from
 *   one (a quote, Menu, Settings) has none, as in the canvas;
 * - everywhere but Home, the header row: the 44 px round back, and ⋯ on the right.
 *
 * Tab memory (each tab reopens its last screen) is the phone navigation's, unchanged.
 */
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { isNativeApp } from "@/lib/native/env";
import { Link, useLocation, useSearch } from "wouter";
import { useLanguage } from "@/i18n/LanguageContext";
import { useRole } from "@/hooks/use-role";
import { haptic } from "@/lib/haptics";
import { markNextNav } from "@/lib/motion/nav-mark";
import { restoreScrollOnNextVisit } from "@/components/scroll-manager";
import { prefetchRoute } from "@/lib/route-chunks";
import { TabClients, TabHome, TabJobs, TabQuotes, BackIcon } from "./icons";
// Phase 150: the assistant layer is its own chunk, fetched on the first tap.
const AssistantOverlay = lazy(() => import("./assistant").then((m) => ({ default: m.AssistantOverlay })));
import type { SheetAction } from "@/components/mobile/action-sheet";

type Tab = { href: string; label: string; Icon: (p: { on?: boolean }) => React.ReactElement; exact?: boolean; match?: string[] };

const MEMORY_KEY = "phone-tab-memory";
const readMemory = (): Record<string, string> => { try { return JSON.parse(sessionStorage.getItem(MEMORY_KEY) || "{}") as Record<string, string>; } catch { return {}; } };
const writeMemory = (m: Record<string, string>) => { try { sessionStorage.setItem(MEMORY_KEY, JSON.stringify(m)); } catch { /* private mode */ } };
const under = (loc: string, href: string) => loc === href || loc.startsWith(href + "/") || loc.startsWith(href + "?");
const owns = (tab: Tab, loc: string) => (tab.exact ? loc === tab.href : under(loc, tab.href) || !!tab.match?.some((m) => under(loc, m)));

/** The tabs: the canvas's four (a foreman: jobs first). */
export function usePocketTabs(shown: Set<string>): Tab[] {
  const { t } = useLanguage();
  const { role } = useRole();
  return useMemo(() => {
    const all: Record<string, Tab> = {
      "/dashboard/quotes": { href: "/dashboard/quotes", label: t("pocket.tab.quotes"), Icon: TabQuotes },
      "/dashboard/jobs": { href: "/dashboard/jobs", label: t("pocket.tab.jobs"), Icon: TabJobs },
      "/dashboard/clients": { href: "/dashboard/clients", label: t("pocket.tab.clients"), Icon: TabClients },
    };
    const order = role === "foreman" ? ["/dashboard/jobs", "/dashboard/quotes", "/dashboard/clients"] : ["/dashboard/quotes", "/dashboard/jobs", "/dashboard/clients"];
    return [{ href: "/dashboard", label: t("pocket.tab.home"), Icon: TabHome, exact: true }, ...order.filter((h) => shown.has(h)).map((h) => all[h]!)];
  }, [shown, role, t]);
}

/** A section screen: where the tab bar shows (the canvas draws it on Home only; the other tabs are the same kind of screen). */
export function isTabRoot(location: string, tabs: Tab[]) {
  return tabs.some((tab) => location === tab.href);
}

export function PocketNav({ tabs, assistant }: { tabs: Tab[]; assistant: boolean }) {
  const { t } = useLanguage();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const [ai, setAi] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("has-pk-nav");
    return () => document.documentElement.classList.remove("has-pk-nav");
  }, []);

  useEffect(() => {
    const owner = tabs.find((tab) => owns(tab, location));
    if (!owner) return;
    const m = readMemory();
    m[owner.href] = location + (search ? `?${search}` : "");
    writeMemory(m);
  }, [location, search, tabs]);

  const onTab = useCallback((tab: Tab, e: React.MouseEvent) => {
    const here = location + (search ? `?${search}` : "");
    if (owns(tab, location)) {
      e.preventDefault();
      if (here !== tab.href) navigate(tab.href);
      else window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      return;
    }
    markNextNav("tab");
    haptic("selection");
    const target = readMemory()[tab.href] ?? tab.href;
    restoreScrollOnNextVisit(target);
    if (target !== tab.href) { e.preventDefault(); navigate(target); }
  }, [location, search, navigate]);

  return (
    <nav className="pk-nav" aria-label={t("mobile.sections")}>
      <div className="pk-tabs">
        {tabs.map((tab) => {
          const on = owns(tab, location);
          return (
            <Link key={tab.href} href={tab.href} className="pk-tab" aria-current={on ? "page" : undefined} onClick={(e) => onTab(tab, e)} onPointerDown={() => prefetchRoute(tab.href)}>
              <tab.Icon on={on} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
      {assistant && (
        <button type="button" className="pk-fab pk-press" aria-label={t("pocket.openAssistant")} aria-haspopup="dialog" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setAi({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); haptic("light"); }}>
          <span className="pk-mini-orb" aria-hidden="true"><span className="pk-mb pk-mb1" /><span className="pk-mb pk-mb2" /><span className="pk-mb pk-mb3" /></span>
        </button>
      )}
      {ai && <Suspense fallback={null}><AssistantOverlay open from={ai} onClose={() => setAi(null)} /></Suspense>}
    </nav>
  );
}

/** The header row of every screen but Home: round back, and the screen's ⋯ (its actions, then what can be started from here). */
export function PocketHeader({ backHref, backLabel, more }: { backHref: string | null; backLabel: string; more: React.ReactNode }) {
  if (!backHref && !more) return null;
  return (
    <header className="pk-header pk-topbar">
      {backHref ? <Link href={backHref} className="pk-icon-btn pk-press tb-back" aria-label={backLabel}><BackIcon /></Link> : <span />}
      <span />
      {more ?? <span />}
    </header>
  );
}

export type { SheetAction };

/**
 * Whether the phone layout wears Pocket. Until Phase 152 turns it on for everyone: the phone app,
 * the dev server, and a browser that opened any page with ?pocket=1 (?pocket=0 turns it off again).
 */
export function pocketEnabled(): boolean {
  if (isNativeApp || import.meta.env.DEV) return true;
  try {
    const q = new URLSearchParams(window.location.search).get("pocket");
    if (q === "1") localStorage.setItem("quoteai.pocket", "1");
    if (q === "0") localStorage.removeItem("quoteai.pocket");
    return localStorage.getItem("quoteai.pocket") === "1";
  } catch {
    return false;
  }
}

/** The phone layout (≤ 980 px, where the tab bar shows) with Pocket on. */
export function usePocket(): boolean {
  const phone = useMediaQuery("(max-width: 980px)");
  const [on] = useState(pocketEnabled);
  return phone && on;
}

/** The sections this person's plan and role show (the layout's nav list), for screens that list them (Menu). */
const NavShownContext = createContext<Set<string>>(new Set());
export const NavShownProvider = NavShownContext.Provider;
export const useNavShown = () => useContext(NavShownContext);
