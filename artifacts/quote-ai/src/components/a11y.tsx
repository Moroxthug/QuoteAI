import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Phase 83 — the two things a keyboard and a screen reader need from the
 * chrome of a single-page app, neither of which axe can see is missing.
 */

/**
 * First tabbable element on the page: jumps past the header (11 controls on a
 * public page, 24 on the dashboard) straight to `#main`. Invisible until it
 * takes focus, which is the whole point — `.skip-link` in mockup-system.css.
 */
export function SkipLink({ targetId = "main" }: { targetId?: string }) {
  const { t } = useLanguage();
  return (
    <a
      href={`#${targetId}`}
      className="skip-link"
      onClick={(e) => {
        // The href alone moves the *scroll* but, for a non-interactive target,
        // not the focus — so the next Tab would start from the header again.
        e.preventDefault();
        const target = document.getElementById(targetId);
        if (!target) return;
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: false });
        target.scrollIntoView({ block: "start" });
      }}
    >
      {t("a11y.skipToContent")}
    </a>
  );
}

function focusHeading(h: HTMLElement) {
  h.setAttribute("tabindex", "-1");
  h.setAttribute("data-route-focus", "");
  h.focus({ preventScroll: true });
}

/** The heading of the screen on show (a screen kept alive behind another is hidden). */
function visibleHeading(): HTMLElement | null {
  if (!document.querySelector("#main")) return document.querySelector<HTMLElement>("h1");
  return Array.from(document.querySelectorAll<HTMLElement>("#main h1")).find((h) => h.getClientRects().length > 0 && !h.closest("[hidden], [inert], [aria-hidden='true']")) ?? null;
}

/** Move focus to the new screen's heading, unless the screen or an open sheet already holds it. */
function shouldFocusHeading(active: Element | null): boolean {
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return false;
  if (!active || active === document.body || !active.isConnected) return true;
  const fieldOnScreen = active.matches("input, textarea, select, [contenteditable='true']") && !!active.closest("#main");
  return !fieldOnScreen;
}

/**
 * A client-side navigation replaces the page in silence: the URL changes, the
 * DOM changes, and a screen reader — which announces a *document* load — says
 * nothing at all. This is the one live region that speaks the new page, after
 * the route has had a tick to set its own `<h1>` / title.
 */
export function RouteAnnouncer() {
  const [location] = useLocation();
  const [message, setMessage] = useState("");
  const first = useRef(true);

  useEffect(() => {
    // The initial document load is announced by the browser itself.
    if (first.current) {
      first.current = false;
      return;
    }
    setMessage("");
    // Phase 122: focus follows the screen. The tapped link or tab is gone
    // (or on another screen), so TalkBack / VoiceOver would start reading
    // from the top of the page or from nowhere; on the new screen's heading
    // it reads the title and continues with the content. Unless the screen
    // took focus itself (a field it opened on) or a sheet is open.
    //
    // For up to 4 s it watches: a screen still loading shows a skeleton; a
    // tab switch keeps the old screen up for a moment; a sheet that led here
    // is still closing (and hands focus back to its button when it goes); a
    // screen may draw its heading again when its data arrives. Each time the
    // new screen is ready and focus is still where the navigation left it —
    // the tapped control, the app's chrome, <body>, or a heading since
    // replaced — it goes to the visible heading. Anything the person does
    // on the new screen in the meantime wins.
    const started = Date.now();
    const origin = document.activeElement;
    // The old screen can still be up when this runs (a tab switch renders in a transition): its heading is not the new one.
    const before = visibleHeading();
    const beforeText = before?.textContent;
    let timer = 0;
    let focused: HTMLElement | null = null;
    let sheetAt = 0;
    // A key or a tap after the screen changed is the person taking over (opening a menu, typing): stop there.
    let acted = false;
    const onAct = () => { acted = true; };
    const stopWatching = () => {
      document.removeEventListener("pointerdown", onAct, true);
      document.removeEventListener("keydown", onAct, true);
    };
    document.addEventListener("pointerdown", onAct, true);
    document.addEventListener("keydown", onAct, true);
    const ours = (a: Element | null) => !a || a === document.body || !a.isConnected || a === origin || a === focused || !a.closest("#main");
    const speak = (heading: HTMLElement | null) => setMessage(heading?.textContent?.trim() || document.title || location);
    const settle = () => {
      if (acted) {
        stopWatching();
        if (!focused) speak(visibleHeading());
        return;
      }
      const main = document.querySelector("#main");
      const heading = visibleHeading();
      const loading = !!main?.querySelector("[class*='skel'], [aria-busy='true']");
      const sheet = !!document.querySelector('[role="dialog"], [role="alertdialog"]');
      if (sheet) sheetAt = Date.now();
      // A slow phone can take a while to close the sheet and hand focus back: watch 1 s past it.
      const over = (Date.now() - started >= 4000 && Date.now() - sheetAt >= 1000) || Date.now() - started >= 10_000;
      const stale = heading === before && heading?.textContent === beforeText && Date.now() - started < 600;
      if (heading && !loading && !sheet && !stale) {
        const a = document.activeElement;
        if (a !== heading) {
          if (!ours(a)) return focused ? undefined : speak(heading); // the person has moved on
          if (!shouldFocusHeading(a)) return speak(heading); // the screen focused a field
          focusHeading(heading);
          focused = heading;
        }
      }
      if (over) {
        stopWatching();
        if (!focused) speak(heading);
        return;
      }
      timer = window.setTimeout(settle, 100);
    };
    timer = window.setTimeout(settle, 150);
    return () => {
      window.clearTimeout(timer);
      stopWatching();
    };
  }, [location]);

  return (
    <div
      data-route-announcer=""
      aria-live="polite"
      aria-atomic="true"
      // Not `display:none`/`hidden`: either would take it out of the
      // accessibility tree and nothing would ever be read.
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        margin: -1,
        padding: 0,
        border: 0,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        clipPath: "inset(50%)",
        whiteSpace: "nowrap",
      }}
    >
      {message}
    </div>
  );
}
