// Phase 118: pull down at the top of a screen to refresh what it shows — the
// gesture people expect in a phone app (the website leaves it to the browser).
// Refetches the queries on screen; the live feed (Phase 117) already keeps them
// current, so this is for "I want to be sure".

import { haptic } from "@/lib/haptics";

const THRESHOLD = 72;
const MAX = 110;

function scrolledInside(target: EventTarget | null): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop > 0) return true;
  }
  return false;
}

export function startPullToRefresh(refresh: () => Promise<unknown>): void {
  const mark = document.createElement("div");
  mark.className = "ptr-mark";
  mark.setAttribute("aria-hidden", "true");
  document.body.appendChild(mark);

  let startY: number | null = null;
  let pulled = 0;
  let busy = false;

  const reset = () => {
    startY = null;
    pulled = 0;
    mark.style.transform = "";
    mark.classList.remove("ready");
  };

  window.addEventListener("touchstart", (e) => {
    if (busy || e.touches.length !== 1 || window.scrollY > 0) return;
    if (!window.location.pathname.startsWith("/dashboard")) return;
    if (document.querySelector('[role="dialog"][aria-modal="true"], [data-modal-scrim]')) return;
    if (scrolledInside(e.target)) return;
    startY = e.touches[0]!.clientY;
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (startY === null) return;
    const dy = e.touches[0]!.clientY - startY;
    if (dy <= 0 || window.scrollY > 0) {
      reset();
      return;
    }
    pulled = Math.min(MAX, dy * 0.5);
    mark.style.transform = `translate(-50%, ${pulled}px) rotate(${pulled * 3}deg)`;
    const ready = pulled >= THRESHOLD * 0.5;
    // Phase 120: a light tap the moment letting go would refresh.
    if (ready && !mark.classList.contains("ready")) haptic("light");
    mark.classList.toggle("ready", ready);
  }, { passive: true });

  window.addEventListener("touchend", () => {
    if (startY === null) return;
    if (pulled < THRESHOLD * 0.5) {
      reset();
      return;
    }
    busy = true;
    startY = null;
    mark.classList.add("busy");
    mark.style.transform = `translate(-50%, ${THRESHOLD * 0.6}px)`;
    void refresh().finally(() => {
      busy = false;
      mark.classList.remove("busy");
      reset();
    });
  });
  window.addEventListener("touchcancel", () => { if (!busy) reset(); });
}
