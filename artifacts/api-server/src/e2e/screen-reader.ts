// Phase 83 — the screen-reader pass a machine can run.
//
// `qa:visual` already runs axe on every route (244 pages at Phase 82: 0
// serious, 0 critical, 0 moderate). Axe is a *static* auditor: it reads the
// rendered tree and decides rules from it. What a screen reader or a keyboard
// actually does to a page — tab through it, land on something, be told where
// it is — is behaviour, and none of that is in axe's scope. This module asks
// those questions instead:
//
//   offscreen-focusable  a closed drawer is still in the tab order and still
//                        read out (the CSS moved it off-canvas, which is not
//                        `display:none`, so nothing in the tree says "gone")
//   skip-link            is there a way past the 25-link sidebar to the content
//   nav-current          does the navigation say which page you are on, or is
//                        "active" only a colour
//   focus-visible        does every tabbable thing show a focus ring
//   label-in-name        does the accessible name contain the visible label
//                        (WCAG 2.5.3 — what voice control needs said out loud)
//   positive-tabindex    tabindex > 0 reorders the whole page
//   landmarks            one <main>, one <h1>
//   table-headers        a data table whose header row is <td>
//   route-announcer      an SPA changes the page under a screen reader in
//                        total silence unless something announces it
//   modal-semantics      an open drawer/dialog: role, name, focus inside,
//                        Escape, and the page behind it out of reach
//
// Everything here is read-only apart from `.focus()` (restored afterwards) and
// the interaction check, which opens a menu and closes it again.

import type { Page } from "playwright-core";

export type SrRule =
  | "offscreen-focusable"
  | "skip-link"
  | "nav-current"
  | "focus-visible"
  | "label-in-name"
  | "positive-tabindex"
  | "landmarks"
  | "table-headers"
  | "route-announcer"
  | "modal-semantics";

export type SrFinding = { rule: SrRule; target: string; detail: string };

// tsx compiles this file with esbuild's `keepNames`, which wraps every named
// function expression — including the helpers inside the page.evaluate
// callbacks below — in a `__name(fn, "fn")` call that only exists in the
// bundle, never in the page. Evaluating a *string* is not transformed, so this
// installs the identity shim the injected calls land on.
const installNameShim = (page: Page) => page.evaluate("globalThis.__name = globalThis.__name || function (f) { return f }").then(() => undefined, () => undefined);

/** Rules that gate the run; the rest are reported to read, not to fail on. */
export const SR_BLOCKING: ReadonlySet<SrRule> = new Set<SrRule>([
  "offscreen-focusable",
  "skip-link",
  "nav-current",
  "focus-visible",
  "positive-tabindex",
  "modal-semantics",
]);

// ── The static half: one pass inside the page ────────────────────────────────
export async function screenReaderAudit(page: Page, opts: { width: number }): Promise<SrFinding[]> {
  // Chrome only paints a ring for a programmatic .focus() when the last input
  // modality was the keyboard, and :focus-visible follows the same heuristic —
  // so press Tab once before measuring, or every control looks ringless.
  await installNameShim(page);
  await page.keyboard.press("Tab").catch(() => {});
  return page.evaluate((width) => {
    const findings: Array<{ rule: string; target: string; detail: string }> = [];
    const add = (rule: string, target: string, detail: string) => findings.push({ rule, target, detail });

    const sel = (el: Element): string => {
      const id = el.id ? `#${el.id}` : "";
      const raw = (el as HTMLElement).className;
      const cls = typeof raw === "string" && raw.trim() ? "." + raw.trim().split(/\s+/).slice(0, 2).join(".") : "";
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const nameOf = (el: Element): string => {
      const by = el.getAttribute("aria-labelledby");
      if (by) {
        const txt = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
        if (txt) return txt;
      }
      const label = el.getAttribute("aria-label");
      if (label && label.trim()) return label.trim();
      const text = (el as HTMLElement).innerText?.trim();
      if (text) return text;
      const alt = el.querySelector("img[alt]")?.getAttribute("alt");
      if (alt && alt.trim()) return alt.trim();
      return (el.getAttribute("title") ?? "").trim();
    };

    const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable=""], [contenteditable="true"]';
    const tabbables = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;
      if ((el.getAttribute("tabindex") ?? "0") === "-1") return false;
      if (el.closest("[inert]")) return false;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      // Anything under aria-hidden is out of the accessibility tree already and
      // axe's aria-hidden-focus reports it; not this module's business.
      if (el.closest('[aria-hidden="true"]')) return false;
      return true;
    });

    // ── positive-tabindex ────────────────────────────────────────────────────
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[tabindex]"))) {
      const n = Number(el.getAttribute("tabindex"));
      if (Number.isFinite(n) && n > 0) add("positive-tabindex", sel(el), `tabindex="${n}" reorders the whole page`);
    }

    // ── offscreen-focusable ──────────────────────────────────────────────────
    // A drawer parked at translateX(-100%) is invisible, fully tabbable and
    // fully readable. Only count it when the page itself does not scroll
    // sideways (otherwise the thing is merely past the fold) and no ancestor
    // scrolls horizontally to reach it (a chip rail).
    const cw = document.documentElement.clientWidth;
    const pageScrollsX = document.documentElement.scrollWidth > cw + 1;
    if (!pageScrollsX) {
      const groups = new Map<Element, HTMLElement[]>();
      for (const el of tabbables) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || (r.right > 1 && r.left < cw - 1)) continue;
        let reachable = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && p.scrollWidth > p.clientWidth + 1) {
            reachable = true;
            break;
          }
        }
        if (reachable) continue;
        // A marquee is off-canvas by design and by the second: its items pass
        // through the viewport. Judging a moving rail by where it happens to
        // be when the screenshot is taken says nothing — what matters there is
        // that the duplicate copy is hidden and the animation pauses on focus,
        // which is a different check (and a fix in the page, Phase 83).
        let animated = false;
        for (let p: HTMLElement | null = el; p && p !== document.body; p = p.parentElement) {
          if (getComputedStyle(p).animationName !== "none") { animated = true; break; }
        }
        if (animated) continue;
        // Blame the outermost ancestor that is itself off-canvas: the drawer,
        // not each of its 27 links.
        let owner: Element = el;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const pr = p.getBoundingClientRect();
          if (pr.width > 0 && (pr.right <= 1 || pr.left >= cw - 1)) owner = p;
        }
        groups.set(owner, [...(groups.get(owner) ?? []), el]);
      }
      for (const [owner, els] of Array.from(groups)) {
        const first = JSON.stringify(nameOf(els[0]!).slice(0, 40));
        add(
          "offscreen-focusable",
          sel(owner),
          `${els.length} tabbable element${els.length === 1 ? "" : "s"} parked off-canvas at ${width}px (first: ${first}) — still in the tab order and still read out`,
        );
      }
    }

    // ── skip-link ────────────────────────────────────────────────────────────
    const main = document.querySelector("main, [role='main']");
    if (main && tabbables.length > 6) {
      const skips = tabbables.slice(0, 3).some((el) => {
        const href = el.getAttribute("href") ?? "";
        if (!href.startsWith("#") || href.length < 2) return false;
        const target = document.getElementById(href.slice(1));
        return !!target && (target === main || main.contains(target) || target.contains(main));
      });
      const before = tabbables.filter((el) => main.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING).length;
      if (!skips && before >= 5) add("skip-link", "body", `no skip link: ${before} tabbable elements come before <main> on every page`);
    }

    // ── nav-current ──────────────────────────────────────────────────────────
    const here = location.pathname.replace(/\/+$/, "") || "/";
    for (const nav of Array.from(document.querySelectorAll<HTMLElement>("nav, [role='navigation'], aside.sidebar"))) {
      const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>("a[href]"));
      if (links.length < 3) continue;
      const active = links.filter((a) => {
        try {
          const url = new URL(a.href, location.href);
          // `/#trades` in the nav and `#section` in an article's table of
          // contents point *into* this page, not at it: `aria-current="page"`
          // would be a lie, and "location" would need scroll tracking.
          if (url.hash) return false;
          return url.pathname.replace(/\/+$/, "") === here;
        } catch {
          return false;
        }
      });
      if (!active.length) continue;
      if (active.some((a) => a.hasAttribute("aria-current"))) continue;
      add(
        "nav-current",
        sel(nav),
        `the link to the current page (${JSON.stringify(nameOf(active[0]!).slice(0, 30))}) carries no aria-current — "you are here" is colour only`,
      );
    }

    // ── focus-visible ────────────────────────────────────────────────────────
    const ring = (cs: CSSStyleDeclaration) =>
      [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow, cs.borderColor, cs.backgroundColor, cs.color].join("|");
    const previously = document.activeElement as HTMLElement | null;
    const sx = window.scrollX;
    const sy = window.scrollY;
    const ringless: string[] = [];
    // Focus styles are usually transitioned (`transition: border-color .2s`),
    // and a computed style read in the same tick as .focus() returns the value
    // the transition starts *from* — i.e. every focus ring in the app looks
    // absent. Kill transitions for the duration of the loop.
    const freeze = document.createElement("style");
    freeze.textContent = "*,*::before,*::after{transition:none !important;animation:none !important}";
    document.head.appendChild(freeze);
    for (const el of tabbables.slice(0, 120)) {
      // The indicator is not always on the focused element: a search field
      // inside a pill draws the ring on the pill (`:focus-within`), which is
      // perfectly good — so measure the element and its first few ancestors.
      const chain: HTMLElement[] = [];
      for (let p: HTMLElement | null = el; p && p !== document.body && chain.length < 4; p = p.parentElement) chain.push(p);
      const before = chain.map((n) => ring(getComputedStyle(n)));
      try {
        el.focus({ preventScroll: true });
      } catch {
        continue;
      }
      if (document.activeElement !== el) continue;
      if (chain.some((n, i) => ring(getComputedStyle(n)) !== before[i])) continue;
      if (chain.some((n) => { const cs = getComputedStyle(n); return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0; })) continue;
      ringless.push(`${sel(el)} ${JSON.stringify(nameOf(el).slice(0, 30))}`);
    }
    freeze.remove();
    if (previously && typeof previously.focus === "function") previously.focus({ preventScroll: true });
    window.scrollTo(sx, sy);
    if (ringless.length) {
      add("focus-visible", ringless[0]!.split(" ")[0]!, `${ringless.length} tabbable element(s) with no visible focus state: ${ringless.slice(0, 4).join(", ")}`);
    }

    // ── label-in-name ────────────────────────────────────────────────────────
    for (const el of tabbables) {
      const label = el.getAttribute("aria-label");
      if (!label) continue;
      // A <select>'s "visible text" is its option list, which is not a label a
      // voice-control user would say — 2.5.3 is about the words on the control.
      if (el.tagName === "SELECT") continue;
      const visible = (el as HTMLElement).innerText?.trim() ?? "";
      if (!visible || visible.length > 60) continue;
      if (norm(label).includes(norm(visible))) continue;
      add("label-in-name", sel(el), `visible ${JSON.stringify(visible.slice(0, 30))} is not inside aria-label ${JSON.stringify(label.slice(0, 40))}`);
    }

    // ── landmarks ────────────────────────────────────────────────────────────
    const mains = document.querySelectorAll("main, [role='main']").length;
    if (mains !== 1) add("landmarks", "body", `${mains} <main> landmarks (expected 1)`);
    const h1s = Array.from(document.querySelectorAll<HTMLElement>("h1")).filter((h) => h.innerText.trim());
    if (h1s.length !== 1) {
      const which = h1s.length > 1 ? `: ${h1s.slice(0, 3).map((h) => JSON.stringify(h.innerText.trim().slice(0, 24))).join(", ")}` : "";
      add("landmarks", "body", `${h1s.length} non-empty <h1> (expected 1)${which}`);
    }

    // ── table-headers ────────────────────────────────────────────────────────
    for (const table of Array.from(document.querySelectorAll("table"))) {
      const rows = table.querySelectorAll("tr").length;
      if (rows < 3) continue;
      if (!table.querySelector("th")) add("table-headers", sel(table), `${rows}-row data table with no <th>`);
    }

    // ── route-announcer ──────────────────────────────────────────────────────
    const announcer = document.querySelector("[data-route-announcer]");
    if (!announcer) add("route-announcer", "body", "no polite live region announcing the page after a client-side navigation");
    else if (announcer.getAttribute("aria-live") !== "polite") {
      add("route-announcer", "[data-route-announcer]", `aria-live="${announcer.getAttribute("aria-live")}" (expected polite)`);
    }

    return findings;
  }, opts.width) as Promise<SrFinding[]>;
}

// ── The interaction half: open a thing, check the trap ───────────────────────
/**
 * Opens `trigger`, then asks the four questions a keyboard user asks of
 * anything that covers the page: is it a dialog with a name, did focus go
 * inside it, is what is behind it out of reach, and does Escape close it and
 * hand focus back.
 */
export async function modalAudit(page: Page, trigger: string, label: string): Promise<SrFinding[]> {
  const out: SrFinding[] = [];
  await installNameShim(page);
  const el = page.locator(trigger).first();
  if ((await el.count()) === 0 || !(await el.isVisible().catch(() => false))) return out;
  await el.focus().catch(() => {});
  await el.click({ timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(450);

  const state = await page.evaluate((triggerSel) => {
    const cw = document.documentElement.clientWidth;
    const ch = document.documentElement.clientHeight;
    // The panel: the last fixed/absolute box covering a serious part of the
    // viewport that holds something focusable.
    const candidates = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter((e) => {
      const cs = getComputedStyle(e);
      if (cs.position !== "fixed" && cs.position !== "absolute") return false;
      if (cs.visibility === "hidden" || cs.display === "none") return false;
      const r = e.getBoundingClientRect();
      return r.width * r.height > cw * ch * 0.15 && r.right > 0 && r.left < cw && !!e.querySelector("a[href], button, input, select, textarea");
    });
    if (!candidates.length) return null;
    const panel = candidates[candidates.length - 1]!;
    const roleEl = panel.getAttribute("role") ? panel : panel.closest("[role]");
    const role = roleEl?.getAttribute("role") ?? null;
    const named = !!(panel.getAttribute("aria-label") || panel.getAttribute("aria-labelledby") || panel.closest("[aria-label],[aria-labelledby]"));
    const active = document.activeElement as HTMLElement | null;
    const focusInside = !!active && panel.contains(active);
    const activeIsTrigger = !!active && active.matches(triggerSel);
    const sel = (e: Element) => {
      const raw = (e as HTMLElement).className;
      const cls = typeof raw === "string" && raw.trim() ? "." + raw.trim().split(/\s+/).slice(0, 2).join(".") : "";
      return `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}${cls}`;
    };
    const outside = Array.from(document.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]")).filter((e) => {
      if (panel.contains(e)) return false;
      if ((e.getAttribute("tabindex") ?? "0") === "-1") return false;
      if (e.closest("[inert]") || e.closest('[aria-hidden="true"]')) return false;
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.right > 0 && r.left < cw;
    });
    return { panel: sel(panel), role, named, focusInside, activeIsTrigger, outside: outside.length, outsideFirst: outside.slice(0, 3).map(sel) };
  }, trigger);

  if (!state) {
    out.push({ rule: "modal-semantics", target: trigger, detail: `${label}: the trigger opened no overlay` });
    return out;
  }
  if (state.role !== "dialog" && state.role !== "alertdialog") {
    out.push({ rule: "modal-semantics", target: state.panel, detail: `${label}: role="${state.role ?? "none"}" — a screen reader is never told this is a dialog` });
  }
  if (!state.named) out.push({ rule: "modal-semantics", target: state.panel, detail: `${label}: the panel has no accessible name` });
  if (!state.focusInside) {
    out.push({
      rule: "modal-semantics",
      target: state.panel,
      detail: `${label}: focus stayed ${state.activeIsTrigger ? "on the trigger" : "outside the panel"} — the next Tab goes behind the overlay`,
    });
  }
  if (state.outside > 0) {
    out.push({ rule: "modal-semantics", target: state.panel, detail: `${label}: ${state.outside} focusable element(s) behind the overlay are still reachable (${state.outsideFirst.join(", ")})` });
  }

  await page.keyboard.press("Escape");
  await page.waitForTimeout(350);
  const after = await page.evaluate((triggerSel) => {
    const trig = document.querySelector(triggerSel);
    return {
      closed: !document.querySelector("[role='dialog'], .mnav.open, .sidebar.open"),
      restored: !!trig && document.activeElement === trig,
    };
  }, trigger);
  if (!after.closed) out.push({ rule: "modal-semantics", target: state.panel, detail: `${label}: Escape did not close it` });
  else if (!after.restored) out.push({ rule: "modal-semantics", target: state.panel, detail: `${label}: closing did not return focus to the trigger` });
  return out;
}
