import { isNativeApp } from "./env";

// Phase 121: the small, always-loaded half of the fingerprint / face unlock
// (the plugin itself is in biometric.ts, loaded only in the app). Sign-in marks
// that the offer is due; the app lock (components/native/app-lock.tsx) makes it
// once, on the next screen, if the phone can do it.

const OFFER_KEY = "quoteai.biometricOffer";
const ON_KEY = "quoteai.biometric";

export function offerBiometricAfterSignIn(): void {
  if (!isNativeApp) return;
  try {
    if (localStorage.getItem(OFFER_KEY) !== "done") localStorage.setItem(OFFER_KEY, "due");
  } catch {
    /* ignore */
  }
}

export function biometricOfferDue(): boolean {
  try {
    return localStorage.getItem(OFFER_KEY) === "due";
  } catch {
    return false;
  }
}

/** Offered (yes or no): never offered again on this phone; More → This app keeps the switch. */
export function biometricOfferDone(): void {
  try {
    localStorage.setItem(OFFER_KEY, "done");
  } catch {
    /* ignore */
  }
}

export function biometricOn(): boolean {
  try {
    return localStorage.getItem(ON_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBiometricOn(on: boolean): void {
  try {
    if (on) localStorage.setItem(ON_KEY, "1");
    else localStorage.removeItem(ON_KEY);
  } catch {
    /* ignore */
  }
}

