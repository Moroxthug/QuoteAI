import { useEffect, useRef } from "react";

// Phase 119: dictation with no signal. The recording waits in the outbox
// (kind `voice.dictation`, lib/offline/outbox.ts); once the phone is back
// online it is written out and the text is left here for the screen it was
// made on (the new-quote box), which takes it the next time it is open — right
// away if it still is.

const KEY = (target: string) => `quoteai.dictated.${target}`;
const EVENT = "quoteai:dictated";

export function deliverDictation(target: string, text: string): void {
  if (!text.trim()) return;
  try {
    const list = JSON.parse(localStorage.getItem(KEY(target)) ?? "[]") as string[];
    list.push(text.trim());
    localStorage.setItem(KEY(target), JSON.stringify(list));
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: target }));
}

function takeDictations(target: string): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY(target)) ?? "[]") as string[];
    localStorage.removeItem(KEY(target));
    return Array.isArray(list) ? list.filter((s) => typeof s === "string" && s.trim()) : [];
  } catch {
    return [];
  }
}

/** Hands every dictation written out for `target` to `onText`, now and whenever one arrives. */
export function useDictations(target: string | undefined, onText: (text: string) => void): void {
  const cb = useRef(onText);
  cb.current = onText;
  useEffect(() => {
    if (!target) return;
    const drain = () => { for (const text of takeDictations(target)) cb.current(text); };
    drain();
    const on = (e: Event) => { if ((e as CustomEvent).detail === target) drain(); };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [target]);
}
