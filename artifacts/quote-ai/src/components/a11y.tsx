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
    const timer = window.setTimeout(() => {
      const h1 = document.querySelector("h1")?.textContent?.trim();
      setMessage(h1 || document.title || location);
    }, 250);
    return () => window.clearTimeout(timer);
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
