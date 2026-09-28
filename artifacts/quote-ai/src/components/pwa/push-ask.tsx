import { lazy, Suspense, useEffect, useState } from "react";

// Phase 119: permission is asked when it explains itself — right after the
// first quote goes out ("Know the moment they accept?"), not at launch. Once
// per device, yes or no. This part is tiny and always there; the sheet
// (push-ask-sheet.tsx) loads the first time there is something to ask.

const ASKED_KEY = "quoteai.pushAsked";
const EVENT = "quoteai:push-ask";

function pushAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markPushAsked(): void {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Something happened that notifications would follow up on (a quote was sent). */
export function askForPushAfter(reason: "quote_sent"): void {
  if (pushAsked()) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: reason }));
}

const PushAskSheet = lazy(() => import("./push-ask-sheet"));

export function PushAsk() {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    const on = () => setAsking(true);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  if (!asking) return null;
  return <Suspense fallback={null}><PushAskSheet onDone={() => setAsking(false)} /></Suspense>;
}
