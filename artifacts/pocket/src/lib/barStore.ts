// Whether the tab bar is showing, so a page can leave room for it and a floating button can sit above it.
import { useSyncExternalStore } from "react";

let visible = false;
const subs = new Set<() => void>();
export function setBarVisible(v: boolean): void {
  if (v === visible) return;
  visible = v;
  subs.forEach((f) => f());
}
export const useBarVisible = (): boolean => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => visible, () => false);
