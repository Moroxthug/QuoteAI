import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Unread / needs-you count; hidden at 0. */
  badge?: number;
  /** Only this exact path is "this tab" (the Today tab at /dashboard). */
  exact?: boolean;
  /** A button instead of a link (the More sheet). */
  onClick?: () => void;
  /** Force the active state (More while its sheet is open). */
  active?: boolean;
};

function isActive(tab: TabItem, location: string) {
  if (tab.active !== undefined) return tab.active;
  if (tab.exact) return location === tab.href;
  return location === tab.href || location.startsWith(tab.href + "/") || location.startsWith(tab.href + "?");
}

/**
 * Phase 100 — the phone's navigation: four or five sections at the bottom of
 * the screen, within thumb reach, instead of twenty links behind a hamburger.
 * Shown under 980 px only (CSS); while mounted it marks <html> with
 * `has-tabbar` so the page and any StickyActionBar leave room for it.
 * Phase 101 wires it into the dashboard with the role-aware tab sets.
 */
export function BottomTabBar({ tabs, label, onNew, newLabel }: { tabs: TabItem[]; label: string; onNew?: () => void; newLabel?: string }) {
  const [location] = useLocation();

  useEffect(() => {
    document.documentElement.classList.add("has-tabbar");
    return () => document.documentElement.classList.remove("has-tabbar");
  }, []);

  const mid = Math.ceil(tabs.length / 2);
  const cells = tabs.map((tab) => {
    const active = isActive(tab, location);
    const inner = (
      <>
        <tab.icon aria-hidden="true" />
        <span>{tab.label}</span>
        {!!tab.badge && <span className="tabbar-badge">{tab.badge > 99 ? "99+" : tab.badge}</span>}
      </>
    );
    return tab.onClick ? (
      <button key={tab.label} type="button" className={cn("tabbar-link", active && "active")} onClick={tab.onClick} aria-expanded={tab.active}>
        {inner}
      </button>
    ) : (
      <Link key={tab.href} href={tab.href} className={cn("tabbar-link", active && "active")} aria-current={active ? "page" : undefined}>
        {inner}
      </Link>
    );
  });
  if (onNew) {
    cells.splice(mid, 0, (
      <button key="__new" type="button" className="tabbar-link tabbar-new" onClick={onNew} aria-label={newLabel}>
        <span><Plus aria-hidden="true" /></span>
      </button>
    ));
  }

  return (
    <nav className="tabbar" aria-label={label}>
      {cells}
    </nav>
  );
}
