// Phase 81 — carries the pilot promo code from the /pilot page to Checkout.
//
// The visitor reads about the pilot, clicks "Join the pilot", signs up,
// verifies their email, fills in the onboarding form and only then reaches
// the plan picker — several navigations and one email round trip later. The
// code has to survive all of that, so it is remembered in localStorage rather
// than passed through the URL.
//
// It is a hint, not an entitlement: the server only ever honours the one code
// it has configured (lib/billing.ts `isPilotPromoCode`), so a value forged
// here buys nothing.

const KEY = "quoteai:pilot-promo";

export function rememberPilotPromo(code: string): void {
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    // Private browsing / storage disabled — the visitor can still paste the
    // code into Stripe's own promo box at checkout.
  }
}

export function pilotPromo(): string | undefined {
  try {
    return window.localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Called once the subscription exists — the code has done its job. */
export function forgetPilotPromo(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to clean up
  }
}
