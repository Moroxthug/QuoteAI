import { useRef, useState, type ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { rowCommits, rubberBand, velocityTracker } from "@/lib/motion/decide";
import { cn } from "@/lib/utils";

/**
 * Phase 108 — a list row a thumb can swipe right to act on (approve an hour
 * entry). Touch and pen only: a mouse never drags it, and the row always
 * keeps a visible button for the same action (docs/MOBILE-RULES.md: nothing
 * needs a hover or a drag). Vertical scrolling is untouched (`touch-action:
 * pan-y`, and a gesture that starts vertical never becomes a swipe).
 *
 * Phase 120 — one quick action per row (approve hours, mark paid, call the
 * client): the row follows the finger with the action's colour beneath,
 * commits past 40 % or on a flick (a haptic tick), and springs back if let
 * go short. A row whose action removes it (`stays` off) slides out; if
 * `onSwipe` rejects it comes back. A row that stays (a call, a sheet that
 * opens) springs home once the action has started.
 *
 *   <SwipeRow label="Approve" onSwipe={() => approve.mutateAsync([id])}>…row…</SwipeRow>
 *   <SwipeRow label="Call" icon={Phone} tone="teal" stays onSwipe={() => call(phone)}>…</SwipeRow>
 */
export function SwipeRow({
  children,
  label,
  onSwipe,
  disabled,
  className,
  icon: Icon = Check,
  tone = "green",
  stays,
}: {
  children: ReactNode;
  label: string;
  onSwipe: () => Promise<unknown> | void;
  disabled?: boolean;
  className?: string;
  icon?: LucideIcon;
  tone?: "green" | "teal" | "navy";
  /** The row stays in the list after the action: spring back instead of sliding out. */
  stays?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; axis: null | "x" | "y" } | null>(null);
  const speed = useRef(velocityTracker());
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [gone, setGone] = useState(false);

  const width = () => row.current?.offsetWidth ?? 320;
  const reset = () => {
    start.current = null;
    setDragging(false);
    setDx(0);
  };
  const armed = dx > Math.min(140, width() * 0.4);

  return (
    <div className={cn("swipe-row", `tone-${tone}`, gone && "gone", armed && "armed", className)}>
      <div className="swipe-under" aria-hidden="true" style={{ opacity: Math.min(1, dx / 60) }}>
        <Icon /> {label}
      </div>
      <div
        ref={row}
        className="swipe-top"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dragging ? "none" : undefined }}
        onPointerDown={(e) => {
          if (disabled || gone || e.pointerType === "mouse") return;
          start.current = { x: e.clientX, y: e.clientY, axis: null };
          speed.current.reset();
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
              try {
                row.current?.setPointerCapture(e.pointerId);
              } catch {
                /* the pointer already ended */
              }
              setDragging(true);
            }
          }
          if (s.axis !== "x") return;
          const next = rubberBand(Math.max(0, x), width() * 0.7);
          speed.current.add(next);
          setDx(next);
        }}
        onPointerUp={() => {
          if (start.current?.axis === "x" && rowCommits(dx, width(), speed.current.speed())) {
            haptic("tick");
            start.current = null;
            setDragging(false);
            if (stays) {
              setDx(0);
              void Promise.resolve(onSwipe()).catch(() => {});
              return;
            }
            setDx(width());
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
