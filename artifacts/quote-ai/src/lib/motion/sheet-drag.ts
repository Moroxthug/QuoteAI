import { rubberBand, sheetCloses, velocityTracker } from "./decide";

// Phase 120: a phone sheet follows the finger (docs/APP-DESIGN.md §4). Drag
// it down by its handle, its header, or its body when that is scrolled to the
// top; past 30 % of its height or on a flick it closes, otherwise it springs
// back. Upward it gives a little and stops. Fields, the signature pad and
// anything scrolled keep their own gestures.
//
// Closing goes through Escape — the same door as the scrim and the ✕ — so a
// dialog that refuses to close (a send in flight) refuses the drag too and
// the sheet comes back.

const NO_DRAG = "input, textarea, select, canvas, [contenteditable='true'], [data-no-sheet-drag], .stabs, .swipe-row";

function scrolledAbove(target: Element, sheet: HTMLElement): boolean {
  for (let el: Element | null = target; el && el !== sheet.parentElement; el = el.parentElement) {
    if (el.scrollTop > 0) return true;
  }
  return false;
}

function scrimOf(): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>('.modal-scrim[data-state="open"]');
  return all[all.length - 1] ?? null;
}

export function attachSheetDrag(sheet: HTMLElement): () => void {
  let start: { y: number; x: number; axis: null | "x" | "y" } | null = null;
  let dy = 0;
  const speed = velocityTracker();

  const phone = () => window.matchMedia("(max-width: 640px)").matches;

  const put = (y: number, animate: boolean) => {
    sheet.style.transition = animate ? "transform .32s cubic-bezier(.2,.9,.25,1)" : "none";
    sheet.style.transform = y ? `translateY(${y}px)` : "";
    const scrim = scrimOf();
    if (scrim) {
      scrim.style.transition = animate ? "opacity .22s" : "none";
      scrim.style.opacity = y > 0 ? String(Math.max(0, 1 - y / sheet.offsetHeight)) : "";
    }
  };

  const onStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!phone() || e.touches.length !== 1 || !t || !(e.target instanceof Element)) return;
    if (e.target.closest(NO_DRAG) || scrolledAbove(e.target, sheet)) return;
    start = { x: t.clientX, y: t.clientY, axis: null };
    dy = 0;
    speed.reset();
  };

  const onMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!start || !t) return;
    const y = t.clientY - start.y;
    const x = t.clientX - start.x;
    if (!start.axis) {
      if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
      // Only a downward pull is the sheet's; up and sideways are the content's.
      start.axis = y > Math.abs(x) ? "y" : "x";
      if (start.axis === "x") {
        start = null;
        return;
      }
    }
    if (e.cancelable) e.preventDefault();
    dy = y >= 0 ? y : -rubberBand(-y * 0.25, 12);
    speed.add(dy);
    put(dy, false);
  };

  const onEnd = () => {
    if (!start) return;
    const wasDragging = start.axis === "y";
    start = null;
    if (!wasDragging) return;
    if (sheetCloses(dy, sheet.offsetHeight, speed.speed())) {
      const scrim = scrimOf();
      sheet.style.transition = "transform .2s cubic-bezier(.4,0,1,1)";
      sheet.style.transform = "translateY(100%)";
      if (scrim) {
        scrim.style.transition = "opacity .2s";
        scrim.style.opacity = "0";
      }
      window.setTimeout(() => {
        // Close without replaying the closing animation from the top.
        sheet.classList.add("drag-closed");
        scrim?.classList.add("drag-closed");
        sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
        window.setTimeout(() => {
          if (!sheet.isConnected || sheet.dataset.state === "closed") return;
          // The dialog said no (something is still running): come back.
          sheet.classList.remove("drag-closed");
          scrim?.classList.remove("drag-closed");
          put(0, true);
        }, 60);
      }, 200);
    } else {
      put(0, true);
    }
    dy = 0;
  };

  sheet.addEventListener("touchstart", onStart, { passive: true });
  sheet.addEventListener("touchmove", onMove, { passive: false });
  sheet.addEventListener("touchend", onEnd);
  sheet.addEventListener("touchcancel", onEnd);
  return () => {
    sheet.removeEventListener("touchstart", onStart);
    sheet.removeEventListener("touchmove", onMove);
    sheet.removeEventListener("touchend", onEnd);
    sheet.removeEventListener("touchcancel", onEnd);
  };
}
