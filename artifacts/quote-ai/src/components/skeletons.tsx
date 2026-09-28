import type { CSSProperties } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Phase 115 — skeletons shaped like the content (docs/APP-PLAN.md "Instant";
 * docs/APP-DESIGN.md §4). A screen waiting for its data shows the rows,
 * header, numbers and cards it is about to show, in the same places and at
 * the same heights, so nothing moves when the data lands. They use the real
 * layout classes (`.card`, `.card-head`, `.stat-strip`, `.q-hero`) plus
 * `.skel-*` rows that mirror `.lrow` on a phone and a `.tbl` row from 640 px
 * up (mockup-system.css, "Skeletons").
 *
 * Everything fades in only past 300 ms (`.skel-wait`): a fast answer never
 * flashes grey bars. The bars are aria-hidden; the wrapper says it is busy.
 */

// Varied widths so a column of bars reads as text, not as a barcode.
const TITLE_W = ["58%", "44%", "66%", "50%", "38%", "62%", "47%", "55%"];
const SUB_W = ["34%", "46%", "28%", "40%", "36%", "30%", "42%", "25%"];

export type ListSkeletonProps = {
  /** How many rows (default 6). */
  rows?: number;
  /** What sits before the text: an avatar (circle), an icon tile, a checkbox, or nothing. */
  lead?: "avatar" | "icon" | "check" | false;
  /** The quiet second line (default on). */
  sub?: boolean;
  /** The amount on the right (default on). */
  amount?: boolean;
  /** A status chip on the right (default on). */
  chip?: boolean;
  /** Skip the 300 ms wait (inside something that already waited). */
  immediate?: boolean;
  className?: string;
};

/** Rows shaped like the page's list: `.lrow` on a phone, a `.tbl` row on a computer. Goes inside the page's `.card`. */
export function ListSkeleton({ rows = 6, lead = false, sub = true, amount = true, chip = true, immediate, className }: ListSkeletonProps) {
  return (
    <div className={cn("skel-list", !immediate && "skel-wait", className)} aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={cn("skel-row", !sub && "one")} aria-hidden="true">
          {lead && <Skeleton className={cn("skel-lead", lead)} />}
          <div className="skel-main">
            <Skeleton className="skel-line skel-title" style={{ width: TITLE_W[i % TITLE_W.length] }} />
            {sub && <Skeleton className="skel-line skel-sub" style={{ width: SUB_W[i % SUB_W.length] }} />}
          </div>
          {(amount || chip) && (
            <div className="skel-end">
              {chip && <Skeleton className="skel-chip" />}
              {amount && <Skeleton className="skel-line skel-amt" />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** A `.stat-strip` with its cells (label over number), 2 columns on a phone like the real one. */
export function StatStripSkeleton({ cells = 4, immediate, className }: { cells?: number; immediate?: boolean; className?: string }) {
  return (
    <div className={cn("stat-strip", !immediate && "skel-wait", className)} style={{ "--ss-cols": Math.min(cells, 6) } as CSSProperties} aria-busy="true">
      {Array.from({ length: cells }, (_, i) => (
        <div key={i} className="ss-item" aria-hidden="true">
          <Skeleton className="skel-line skel-sub" style={{ width: "55%" }} />
          <Skeleton className="skel-line skel-num" style={{ width: i % 2 ? "48%" : "62%" }} />
        </div>
      ))}
    </div>
  );
}

/**
 * A `.card`: a heading bar, then list rows — or, with `height`, one block
 * that size (a chart, a form). `head={false}` for a card without a head.
 */
export function CardSkeleton({ rows = 3, head = true, height, list, immediate, className }: { rows?: number; head?: boolean; height?: number; list?: Omit<ListSkeletonProps, "rows" | "immediate">; immediate?: boolean; className?: string }) {
  return (
    <div className={cn("card", !immediate && "skel-wait", className)} aria-busy="true">
      {head && (
        <div className="card-head" aria-hidden="true">
          <Skeleton className="skel-line skel-h2" />
        </div>
      )}
      {height ? (
        <div className="act-body" aria-hidden="true"><Skeleton className="skel-block" style={{ height }} /></div>
      ) : (
        <ListSkeleton rows={rows} amount={false} chip={false} {...list} immediate />
      )}
    </div>
  );
}

/**
 * A detail screen: the hero card (eyebrow, name, who, a chip; the big number
 * on the right), the number strip, then the first card. Mirrors `.q-hero`
 * used by the quote, job and invoice screens.
 */
export function DetailSkeleton({ strip = 4, tabs = false, rows = 4, back = true, className }: { strip?: number; tabs?: boolean; rows?: number; back?: boolean; className?: string }) {
  return (
    <div className={cn("skel-wait", className)} aria-busy="true">
      {back && <Skeleton className="skel-line skel-back hide-phone" aria-hidden="true" />}
      <section className="card q-hero" aria-hidden="true">
        <div className="q-hero-main">
          <Skeleton className="skel-line skel-sub" style={{ width: 140 }} />
          <Skeleton className="skel-line skel-h1" />
          <Skeleton className="skel-line skel-title" style={{ width: "38%", marginTop: 10 }} />
          <Skeleton className="skel-chip" style={{ marginTop: 14 }} />
        </div>
        <div className="q-hero-side hide-phone">
          <Skeleton className="skel-line skel-sub" style={{ width: 70 }} />
          <Skeleton className="skel-line skel-num" style={{ width: 120 }} />
        </div>
      </section>
      {strip > 0 && <StatStripSkeleton cells={strip} immediate />}
      {tabs && <TabsSkeleton immediate />}
      <CardSkeleton rows={rows} immediate />
    </div>
  );
}

/** A row of tab pills (ScrollTabs) above a page's content. */
export function TabsSkeleton({ count = 5, immediate, className }: { count?: number; immediate?: boolean; className?: string }) {
  return (
    <div className={cn("skel-tabs", !immediate && "skel-wait", className)} aria-hidden="true">
      {[72, 88, 64, 80, 70, 76, 68].slice(0, count).map((w, i) => <Skeleton key={i} className="skel-pill" style={{ width: w }} />)}
    </div>
  );
}
