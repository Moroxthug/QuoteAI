// App lock: Face ID / fingerprint before quoteAI opens, at a cold start and after five minutes away (SystemStates "App lock", SetSecurity's switch).
// The setting is kept on the phone. expo-local-authentication is loaded on its own so an older dev client or the web gets "not available", not a crash.
import { useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import { kvGet, kvSet } from "./kv";
import { lockAtStart, lockOnReturn, methodOf, type Method } from "./lockRules";

const ON_KEY = "quoteai_app_lock";
const OFFERED_KEY = "quoteai_app_lock_offered";

type State = { ready: boolean; enabled: boolean; offered: boolean; available: boolean; method: Method; locked: boolean };
let state: State = { ready: false, enabled: false, offered: false, available: false, method: "device", locked: false };
const subs = new Set<() => void>();
const set = (next: Partial<State>) => { state = { ...state, ...next }; subs.forEach((f) => f()); };

export const useAppLock = (): State => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state, () => state);

async function auth() {
  if (Platform.OS === "web") return null;
  try { return await import("expo-local-authentication"); } catch { return null; }
}

let signedIn = false;
let awaySince: number | null = null;
let started = false;

/** Once, from the root layout: read the setting and whether the phone can do it, and watch the app go to the background and come back. */
export async function startAppLock(): Promise<void> {
  if (started) return;
  started = true;
  const [on, offered, a] = await Promise.all([kvGet(ON_KEY), kvGet(OFFERED_KEY), auth()]);
  let available = false;
  let method: Method = "device";
  if (a) {
    try {
      available = (await a.hasHardwareAsync()) && (await a.isEnrolledAsync());
      const types = await a.supportedAuthenticationTypesAsync();
      method = methodOf(Platform.OS, { face: types.includes(a.AuthenticationType.FACIAL_RECOGNITION), fingerprint: types.includes(a.AuthenticationType.FINGERPRINT) });
    } catch { available = false; }
  }
  const enabled = on === "1" && available;
  set({ ready: true, enabled, offered: offered === "1", available, method, locked: lockAtStart({ enabled, signedIn }) });
  AppState.addEventListener("change", (s) => {
    if (s === "background") awaySince = Date.now();
    else if (s === "active") {
      if (lockOnReturn({ enabled: state.enabled, signedIn, awaySince, now: Date.now() })) set({ locked: true });
      awaySince = null;
    }
  });
}

/** The session tells the lock who is signed in; signing in fresh (a password just typed) never locks. */
export function setLockSession(isIn: boolean, fresh: boolean): void {
  const was = signedIn;
  signedIn = isIn;
  if (!isIn) set({ locked: false });
  else if (!was && !fresh && state.ready) set({ locked: lockAtStart({ enabled: state.enabled, signedIn }) });
}

/** Face ID / fingerprint. True when it worked. */
export async function unlock(prompt: string, cancel: string): Promise<boolean> {
  const a = await auth();
  if (!a) return false;
  try {
    const r = await a.authenticateAsync({ promptMessage: prompt, cancelLabel: cancel, disableDeviceFallback: false });
    if (r.success) set({ locked: false });
    return r.success;
  } catch {
    return false;
  }
}

/** Turning it on asks once, so a phone whose owner can't pass it isn't locked out. */
export async function setAppLock(on: boolean, prompt: string, cancel: string): Promise<boolean> {
  if (on) {
    const a = await auth();
    if (!a || !state.available) return false;
    const r = await a.authenticateAsync({ promptMessage: prompt, cancelLabel: cancel }).catch(() => ({ success: false }));
    if (!r.success) return false;
  }
  await kvSet(ON_KEY, on ? "1" : null);
  await markOffered();
  set({ enabled: on });
  return true;
}

export async function markOffered(): Promise<void> {
  await kvSet(OFFERED_KEY, "1");
  set({ offered: true });
}
