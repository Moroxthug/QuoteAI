import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function tabbablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  });
}

/**
 * Phase 83 — what Radix gives every `<Dialog>` for free, for the two overlays
 * that are hand-rolled: the public mobile drawer and the dashboard sidebar.
 *
 * While `open`:
 *   • focus moves into the panel (and back to whatever had it, on close)
 *   • Tab and Shift+Tab cycle inside it
 *   • Escape closes it
 *   • everything else on the page is `inert` — out of the tab order, out of
 *     the accessibility tree, and unclickable — except an element marked
 *     `data-modal-scrim`, which stays clickable so tapping the dim area still
 *     closes the panel.
 */
export function useModalTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Inert every sibling on the way up to <body>: that is the whole page
    // except the panel's own ancestor chain.
    const inerted: HTMLElement[] = [];
    for (let el: HTMLElement | null = panel; el && el !== document.body; el = el.parentElement) {
      for (const sibling of Array.from(el.parentElement?.children ?? [])) {
        if (sibling === el || !(sibling instanceof HTMLElement)) continue;
        if (sibling.hasAttribute("inert") || sibling.hasAttribute("data-modal-scrim")) continue;
        if (sibling.tagName === "SCRIPT" || sibling.tagName === "STYLE" || sibling.tagName === "LINK") continue;
        sibling.setAttribute("inert", "");
        inerted.push(sibling);
      }
    }

    const first = tabbablesIn(panel)[0];
    (first ?? panel).focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = tabbablesIn(panel);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === firstItem || !panel.contains(active))) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      for (const el of inerted) el.removeAttribute("inert");
      // Back to the trigger — if it is still in the document.
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open, panelRef, onClose]);
}
