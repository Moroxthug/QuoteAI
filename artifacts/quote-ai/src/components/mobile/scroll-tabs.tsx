import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export type ScrollTab = { id: string; label: string; count?: number; href?: string };

/**
 * Phase 100 — tabs scroll, they don't wrap (docs/MOBILE-RULES.md rule 5).
 * One line of pills that scrolls sideways on a phone and keeps the active one
 * in view; `sticky` pins it under the top bar. Items with `href` are links
 * (`aria-current="page"`), the rest are toggle buttons (`aria-pressed`) — the
 * same semantics the pill rows already use.
 */
export function ScrollTabs({
  tabs,
  value,
  onChange,
  sticky,
  label,
  className,
}: {
  tabs: ScrollTab[];
  value: string;
  onChange?: (id: string) => void;
  sticky?: boolean;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = ref.current;
    const active = row?.querySelector<HTMLElement>('[data-active="true"]');
    if (!row || !active) return;
    // Scroll the row only — scrollIntoView would also move the page.
    const left = active.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + active.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - 16), behavior: "auto" });
    }
  }, [value]);

  return (
    <div ref={ref} className={cn("stabs", sticky && "sticky", className)} role="group" aria-label={label}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        const inner = (
          <>
            {tab.label}
            {tab.count !== undefined && <span className="cnt">{tab.count}</span>}
          </>
        );
        return tab.href ? (
          <Link key={tab.id} href={tab.href} className={cn("pill", active && "on")} data-active={active} aria-current={active ? "page" : undefined}>
            {inner}
          </Link>
        ) : (
          <button key={tab.id} type="button" className={cn("pill", active && "on")} data-active={active} aria-pressed={active} onClick={() => onChange?.(tab.id)}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}
