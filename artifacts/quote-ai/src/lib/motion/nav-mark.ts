import type { NavKind } from "./decide";

// Phase 120: how the next navigation should look, said by whoever starts it
// (the tab bar says "tab"; the edge swipe says "none" — it already moved the
// screen). Its own tiny module so the tab bar can say it without loading the
// page-motion code, which the website never needs. Good for 300 ms.

let marked: { kind: NavKind; at: number } | null = null;

export function markNextNav(kind: NavKind): void {
  marked = { kind, at: Date.now() };
}

export function takeMark(): NavKind | null {
  const m = marked;
  marked = null;
  return m && Date.now() - m.at < 300 ? m.kind : null;
}
