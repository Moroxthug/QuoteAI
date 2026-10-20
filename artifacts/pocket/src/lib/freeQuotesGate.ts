// The "free quotes used" state is one sheet for the whole app. Whatever creates a quote (New quote, the Home bar, the first quote, duplicate) can be answered
// with HTTP 402 FREE_QUOTES_USED; the app's fetch (lib/session.ts) announces it here and the sheet in the root layout opens.
import { useSyncExternalStore } from "react";

type Gate = { open: boolean; limit: number | null; used: number | null };
let gate: Gate = { open: false, limit: null, used: null };
const subs = new Set<() => void>();
const set = (g: Gate) => { gate = g; subs.forEach((f) => f()); };

export function announceFreeQuotesUsed(info: { limit: number | null; used: number | null }): void {
  set({ open: true, ...info });
}
export function closeFreeQuotesGate(): void {
  if (gate.open) set({ ...gate, open: false });
}
export const useFreeQuotesGate = (): Gate => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => gate, () => gate);
