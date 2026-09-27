import { useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Phase 108 — a list row a thumb can swipe right to act on (approve an hour
 * entry). Touch and pen only: a mouse never drags it, and the row always
 * keeps a visible button for the same action (docs/MOBILE-RULES.md: nothing
 * needs a hover or a drag). Vertical scrolling is untouched (`touch-action:
 * pan-y`, and a gesture that starts vertical never becomes a swipe).
 *
 * The row slides out when the swipe lands; if `onSwipe` returns a promise
 * that rejects, it comes back (the list's refetch removes it on success).
 *
 *   <SwipeRow label="Approve" onSwipe={() => approve.mutateAsync([id])}>…row…</SwipeRow>
 */
export function SwipeRow({ children, label, onSwipe, disabled, className }: { children: ReactNode; label: string; onSwipe: () => Promise<unknown> | void; disabled?: boolean; className?: string }) {
  const row = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; axis: null | "x" | "y" } | null>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [gone, setGone] = useState(false);

  const reset = () => {
    start.current = null;
    setDragging(false);
    setDx(0);
  };

  return (
    <div className={cn("swipe-row", gone && "gone", className)}>
      <div className="swipe-under" aria-hidden="true" style={{ opacity: Math.min(1, dx / 60) }}>
        <Check /> {label}
      </div>
      <div
        ref={row}
        className="swipe-top"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dragging ? "none" : undefined }}
        onPointerDown={(e) => {
          if (disabled || gone || e.pointerType === "mouse") return;
          start.current = { x: e.clientX, y: e.clientY, axis: null };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const x = e.clientX - s.x;
          const y = e.clientY - s.y;
          if (!s.axis) {
            if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
            s.axis = Math.abs(x) > Math.abs(y) ? "x" : "y";
            if (s.axis === "x") {
              row.current?.setPointerCapture(e.pointerId);
              setDragging(true);
            }
          }
          if (s.axis === "x") setDx(Math.max(0, x));
        }}
        onPointerUp={() => {
          const width = row.current?.offsetWidth ?? 320;
          if (start.current?.axis === "x" && dx > Math.min(140, width * 0.4)) {
            start.current = null;
            setDragging(false);
            setDx(width);
            setGone(true);
            Promise.resolve(onSwipe()).catch(() => {
              setGone(false);
              setDx(0);
            });
            return;
          }
          reset();
        }}
        onPointerCancel={reset}
      >
        {children}
      </div>
    </div>
  );
}
