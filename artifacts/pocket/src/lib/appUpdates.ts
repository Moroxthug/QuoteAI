// Over-the-air updates (D-6) and SystemStates' "A new version is ready. Reload". When the app comes to the front it asks expo-updates for a newer
// JavaScript bundle of the same runtime version and downloads it; once downloaded the banner shows, and Reload restarts into it. Off (nothing shows)
// until the Expo project exists: `eas init` writes the project id and the updates URL into app.json (docs/POCKET-APP-PLAN.md 129.9).
import { useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";

let ready = false;
const subs = new Set<() => void>();
export const useUpdateReady = (): boolean => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => ready, () => ready);

async function updates() {
  if (Platform.OS === "web" || __DEV__) return null;
  try {
    const U = await import("expo-updates");
    return U.isEnabled ? U : null;
  } catch {
    return null;
  }
}

let checking = false;
async function check(): Promise<void> {
  if (checking || ready) return;
  checking = true;
  try {
    const U = await updates();
    if (!U) return;
    const r = await U.checkForUpdateAsync();
    if (!r.isAvailable) return;
    const f = await U.fetchUpdateAsync();
    if (f.isNew) { ready = true; subs.forEach((s) => s()); }
  } catch { /* no signal or no update server: try again next time */ } finally {
    checking = false;
  }
}

let started = false;
/** Once, from the root layout: at start and each time the app comes back to the front. */
export function startUpdates(): void {
  if (started) return;
  started = true;
  void check();
  AppState.addEventListener("change", (s) => { if (s === "active") void check(); });
}

export async function reloadNow(): Promise<void> {
  const U = await updates();
  if (U) await U.reloadAsync();
}
