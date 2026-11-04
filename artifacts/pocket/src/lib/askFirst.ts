// "Before the phone asks" (SystemStates): a sheet says why quoteAI wants the camera, the microphone or the location before the phone shows its own prompt,
// and only while that prompt would still come (lockRules.shouldAskFirst). One sheet for the whole app, in the root layout.
import { useSyncExternalStore } from "react";
import { shouldAskFirst } from "./lockRules";

export type Ask = "camera" | "mic" | "location" | "notifications";

let open: { kind: Ask; answer: (go: boolean) => void } | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const useAskFirst = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => open, () => open);

/** Shows the sheet; true for Continue, false for Not now or closing it. */
export function askFirst(kind: Ask): Promise<boolean> {
  open?.answer(false);
  return new Promise((resolve) => {
    open = { kind, answer: (go) => { open = null; emit(); resolve(go); } };
    emit();
  });
}

/** The sheet first when the phone would still ask; true when it is fine to go on to the phone's prompt. */
export async function primeFor(kind: Ask, current: () => Promise<{ status?: string; granted?: boolean; canAskAgain?: boolean }>): Promise<boolean> {
  try {
    if (!shouldAskFirst(await current())) return true;
  } catch {
    return true;
  }
  return askFirst(kind);
}
