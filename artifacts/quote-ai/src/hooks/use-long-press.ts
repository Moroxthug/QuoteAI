import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { haptic } from "@/lib/haptics";

const HOLD_MS = 500;

/**
 * Phase 120 — press and hold a row for its ⋯ (docs/APP-DESIGN.md §4). Touch
 * and pen only; moving more than 8 px (a scroll, a swipe) cancels it, and the
 * tap that would follow the hold is swallowed so the row's link doesn't open
 * too. The ⋯ button stays: holding is a shortcut, never the only way.
 *
 *   const hold = useLongPress(() => setMenuOpen(true));
 *   <li {...hold}>…</li>
 */
export function useLongPress(onHold: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };

  return {
    onPointerDown(e: ReactPointerEvent) {
      if (e.pointerType === "mouse") return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        fired.current = true;
        start.current = null;
        haptic("light");
        onHold();
      }, HOLD_MS);
    },
    onPointerMove(e: ReactPointerEvent) {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu(e: React.MouseEvent) {
      // The phone's own long-press menu (copy link, open in new tab) would cover ours.
      if (fired.current || start.current) e.preventDefault();
    },
    onClickCapture(e: React.MouseEvent) {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
