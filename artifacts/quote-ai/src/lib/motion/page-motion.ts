import { isNativeApp } from "@/lib/native/env";
import { edgeGoesBack, navKind, velocityTracker, type NavKind } from "./decide";
import { markNextNav, takeMark } from "./nav-mark";

// Phase 120: screens move like a phone app's (docs/APP-DESIGN.md §4).
//
// - Open a screen: it slides in from the right (300 ms), the old one drifts
//   28 % left and dims. Back (‹, Android back, the iOS edge swipe) reverses
//   it (260 ms). A tab switch cross-fades (160 ms). Reduced motion: a 120 ms
//   fade. The tab bar and the top bar stay put (mockup-system.css, "Page motion").
// - Built on the View Transitions API (Android WebView, iOS 18+): wouter's
//   history pushes and the browser's popstate are wrapped so React renders the
//   new screen inside `startViewTransition`. Without the API nothing changes.
// - Only in the phone app and an installed (standalone) web app at phone
//   width: a mobile browser already animates its own back swipe, and two
//   animations for one step read as a glitch.
// - iOS has no back button: a swipe from the left edge follows the finger
//   and goes back past 40 % or on a flick, else springs home. (Android's back
//   gesture is the system's, and arrives as popstate.)

type Doc = Document & { startViewTransition?: (update: () => Promise<void> | void) => { finished: Promise<void> } };

const phone = () => window.matchMedia("(max-width: 640px)").matches;

function pageMotionWanted(): boolean {
  if (typeof document === "undefined" || !(document as Doc).startViewTransition) return false;
  return phone() && (isNativeApp || window.matchMedia("(display-mode: standalone)").matches);
}

/** React commits a location change on the next task; the new screen is then in the DOM. */
const settle = () => new Promise<void>((r) => setTimeout(r, 0));

function transition(kind: NavKind, update: () => void): void {
  const doc = document as Doc;
  if (kind === "none" || document.hidden || !doc.startViewTransition || !phone()) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset.nav = kind;
  try {
    const t = doc.startViewTransition(() => {
      update();
      return settle();
    });
    void t.finished.finally(() => {
      if (root.dataset.nav === kind) delete root.dataset.nav;
    });
  } catch {
    delete root.dataset.nav;
    update();
  }
}

let started = false;

/**
 * Call once the router is in place (wouter patches history.pushState when
 * it loads; this wraps its version so its location event fires inside the
 * transition). The signed-in layout loads it on mount at phone width (its own
 * chunk: the website on a computer never downloads it).
 */
export function startPageMotion(): void {
  if (started || !pageMotionWanted()) return;
  started = true;
  document.documentElement.classList.add("page-motion");

  const push = history.pushState;
  history.pushState = function (data: unknown, unused: string, url?: string | URL | null) {
    const kind = url == null ? "none" : navKind(window.location.pathname, String(url), takeMark());
    transition(kind, () => push.call(history, data, unused, url));
  };

  let replaying = false;
  window.addEventListener("popstate", (e) => {
    if (replaying) return;
    const kind = takeMark() ?? "pop";
    if (kind === "none") return;
    // Hold everyone else's popstate (wouter, the scroll manager) until the old screen is captured.
    e.stopImmediatePropagation();
    const state = e.state as unknown;
    transition(kind, () => {
      replaying = true;
      try {
        window.dispatchEvent(new PopStateEvent("popstate", { state }));
      } finally {
        replaying = false;
      }
    });
  }, { capture: true });

  if (isIos()) startEdgeSwipe();
}

function isIos(): boolean {
  if (isNativeApp) return (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === "ios";
  return /iP(hone|od|ad)/.test(navigator.userAgent);
}

const EDGE = 24;

function startEdgeSwipe(): void {
  let start: { x: number; y: number; axis: null | "x" | "y" } | null = null;
  let dx = 0;
  const speed = velocityTracker();
  const page = () => document.getElementById("main");

  const canGoBack = () =>
    window.history.length > 1 &&
    window.location.pathname !== "/dashboard" &&
    !document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"], [role="menu"]');

  const put = (x: number, animate: boolean) => {
    const el = page();
    if (!el) return;
    el.style.transition = animate ? "transform .26s cubic-bezier(.2,.8,.2,1)" : "none";
    el.style.transform = x ? `translateX(${x}px)` : "";
    document.documentElement.classList.toggle("edge-dragging", x > 0);
  };

  window.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    if (e.touches.length !== 1 || !t || t.clientX > EDGE || !canGoBack()) return;
    start = { x: t.clientX, y: t.clientY, axis: null };
    dx = 0;
    speed.reset();
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (!start || !t) return;
    const x = t.clientX - start.x;
    const y = t.clientY - start.y;
    if (!start.axis) {
      if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
      start.axis = x > Math.abs(y) ? "x" : "y";
      if (start.axis === "y") {
        start = null;
        return;
      }
    }
    dx = Math.max(0, x);
    speed.add(dx);
    put(dx, false);
  }, { passive: true });

  const end = () => {
    if (!start) return;
    start = null;
    const width = window.innerWidth;
    if (edgeGoesBack(dx, width, speed.speed())) {
      put(width, true);
      window.setTimeout(() => {
        markNextNav("none");
        window.history.back();
        // The screen underneath arrives from where the old one had pushed it.
        window.setTimeout(() => {
          const el = page();
          put(0, false);
          el?.classList.add("edge-arrive");
          window.setTimeout(() => el?.classList.remove("edge-arrive"), 300);
        }, 0);
      }, 200);
    } else {
      put(0, true);
    }
    dx = 0;
  };
  window.addEventListener("touchend", end);
  window.addEventListener("touchcancel", end);
}
