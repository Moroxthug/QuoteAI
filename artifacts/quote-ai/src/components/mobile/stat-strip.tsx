import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatItem = {
  label: string;
  value: ReactNode;
  /** Colour of the number: ok (green) · warn (yellow) · bad (red). */
  tone?: "ok" | "warn" | "bad";
  sub?: ReactNode;
};

/**
 * Phase 100 — numbers as a strip, not a tower (docs/MOBILE-RULES.md rule 3).
 * One card with N hairline-separated cells on desktop, a 2-column grid on
 * phones. `variant="line"` is the quieter form: "3 quotes · 2 won · $4,200
 * outstanding" as one wrapping line.
 */
export function StatStrip({ items, variant = "grid", className, label }: { items: StatItem[]; variant?: "grid" | "line"; className?: string; label?: string }) {
  if (variant === "line") {
    return (
      <p className={cn("stat-line", className)} aria-label={label}>
        {items.map((s) => (
          <span key={s.label}><b>{s.value}</b>{s.label}</span>
        ))}
      </p>
    );
  }
  return (
    <dl className={cn("stat-strip", className)} style={{ "--ss-cols": Math.min(items.length, 6) } as CSSProperties} aria-label={label}>
      {items.map((s) => (
        <div key={s.label} className="ss-item">
          <dt className="ss-lbl">{s.label}</dt>
          <dd className={cn("ss-val", s.tone)}>{s.value}</dd>
          {s.sub && <dd className="ss-sub">{s.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}
