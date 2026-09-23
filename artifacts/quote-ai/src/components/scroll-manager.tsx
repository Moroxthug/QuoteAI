import { useEffect } from "react";

/**
 * Phase 84 — scroll position on navigation.
 *
 * A browser scrolls to the top of a new document, remembers where you were on
 * back, and jumps to `#anchor` — all of it tied to a *document load*. Every
 * link in this app is a `pushState`, so none of it happened: clicking a quote
 * in a list half-way down the page opened the quote half-way down, and
 * `/#trades` from another page landed at the top of the homepage with the
 * anchor ignored.
 *
 * wouter patches `history.pushState` / `replaceState` to dispatch same-named
 * window events (`use-browser-location.js`), so this listens to exactly what
 * the router listens to — including hash-only navigations, which do not
 * change wouter's `useLocation()` and would never re-render a component.
 */

/** Where each visited URL was left, so Back can put it back. */
const positions = new Map<string, number>();

function stickyHeaderOffset(): number {
  // `.site-head` (public) and `.topbar` (dashboard) are sticky: an anchor
  // scrolled to 0 would sit underneath them.
  for (const selector of [".site-head", ".topbar"]) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && getComputedStyle(el).position === "sticky") return el.offsetHeight;
  }
  return 0;
}

/**
 * Applies `target` now and on the next few frames: a lazy route (every page
 * outside the homepage is `React.lazy`) mounts its content *after* the
 * navigation event, and an anchor or a saved offset that does not exist yet
 * would silently do nothing.
 */
function applyRepeatedly(target: () => number | null, deadlineMs = 600, keepCorrecting = false) {
  const start = performance.now();
  let cancelled = false;
  // Whatever we are trying to do, the person wins: the moment they touch the
  // page we stop moving it under them.
  const stop = () => { cancelled = true; };
  const userEvents = ["wheel", "touchstart", "keydown", "mousedown"] as const;
  for (const e of userEvents) window.addEventListener(e, stop, { passive: true, once: true });
  const done = () => {
    cancelled = true;
    for (const e of userEvents) window.removeEventListener(e, stop);
  };

  const tick = () => {
    if (cancelled) return done();
    const y = target();
    if (y !== null) {
      const drift = Math.abs(window.scrollY - y);
      // `keepCorrecting` is for anchors: the homepage reveals its sections as
      // they enter the viewport, so the target moves for a few hundred ms
      // after we first land on it. A page still loading can also be too short
      // to reach `y` at all — either way, keep asking until the deadline.
      if (drift <= 1 && !keepCorrecting) return done();
      if (drift > (keepCorrecting ? 4 : 1)) window.scrollTo({ top: y, left: 0, behavior: "auto" });
    }
    if (performance.now() - start >= deadlineMs) return done();
    requestAnimationFrame(tick);
  };
  tick();
}

export function ScrollManager() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // We restore Back ourselves (below): the browser's own attempt fires
    // before a lazy route has rendered, so it restores against a short page.
    const previousRestoration = history.scrollRestoration;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    let currentHref = window.location.href;
    positions.set(currentHref, 0);

    const remember = () => positions.set(currentHref, window.scrollY);
    const onScroll = () => positions.set(currentHref, window.scrollY);

    const handle = (kind: "push" | "pop") => {
      remember();
      const previousHref = currentHref;
      currentHref = window.location.href;
      if (previousHref === currentHref) return;

      if (kind === "pop") {
        const saved = positions.get(currentHref);
        applyRepeatedly(() => saved ?? 0);
        return;
      }

      const hash = window.location.hash.slice(1);
      if (hash) {
        applyRepeatedly(
          () => {
            const el = document.getElementById(decodeURIComponent(hash));
            if (!el) return null; // not mounted yet — try again next frame
            return Math.max(0, el.getBoundingClientRect().top + window.scrollY - stickyHeaderOffset() - 24);
          },
          900,
          true,
        );
        return;
      }
      applyRepeatedly(() => 0, 200);
    };

    const onPush = () => handle("push");
    const onPop = () => handle("pop");

    window.addEventListener("pushState", onPush);
    window.addEventListener("replaceState", onPush);
    window.addEventListener("hashchange", onPush);
    window.addEventListener("popstate", onPop);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("pushState", onPush);
      window.removeEventListener("replaceState", onPush);
      window.removeEventListener("hashchange", onPush);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("scroll", onScroll);
      if ("scrollRestoration" in history) history.scrollRestoration = previousRestoration;
    };
  }, []);

  return null;
}

