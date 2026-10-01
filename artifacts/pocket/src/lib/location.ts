// Where the phone is, only when the worker clocks in or out (and, if they allow it, while they are on the clock: LiveLocation). The permission is "while in
// use"; nothing runs in the background. expo-location is a native module the installed dev client may not have yet, so it is loaded on its own and the
// screen gets a plain "unavailable" instead of a crash. On the web the browser's own geolocation is used.
import { Platform } from "react-native";
import { kvGet, kvSet } from "./kv";

export type Fix = { lat: number; lng: number };
export type FixResult = { ok: true; fix: Fix } | { ok: false; problem: "denied" | "unavailable" | "failed" };

export async function currentFix(timeoutMs = 8000): Promise<FixResult> {
  if (Platform.OS === "web") {
    const g = (globalThis as { navigator?: Navigator }).navigator?.geolocation;
    if (!g) return { ok: false, problem: "unavailable" };
    return new Promise<FixResult>((resolve) => {
      g.getCurrentPosition(
        (p) => resolve({ ok: true, fix: { lat: p.coords.latitude, lng: p.coords.longitude } }),
        (e) => resolve({ ok: false, problem: e.code === 1 ? "denied" : "failed" }),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
      );
    });
  }
  let loc: typeof import("expo-location");
  try {
    loc = await import("expo-location");
  } catch {
    return { ok: false, problem: "unavailable" };
  }
  try {
    const perm = await loc.requestForegroundPermissionsAsync();
    if (!perm.granted) return { ok: false, problem: "denied" };
    const p = await loc.getCurrentPositionAsync({ accuracy: loc.Accuracy.Balanced });
    return { ok: true, fix: { lat: p.coords.latitude, lng: p.coords.longitude } };
  } catch {
    return { ok: false, problem: "failed" };
  }
}

export async function locationPermission(): Promise<"granted" | "denied" | "ask" | "unavailable"> {
  if (Platform.OS === "web") return (globalThis as { navigator?: Navigator }).navigator?.geolocation ? "ask" : "unavailable";
  try {
    const loc = await import("expo-location");
    const p = await loc.getForegroundPermissionsAsync();
    return p.granted ? "granted" : p.canAskAgain ? "ask" : "denied";
  } catch {
    return "unavailable";
  }
}

const SHARE_KEY = "quoteai_crew_share_location";
/** The worker's choice on LiveLocation: share where they are while on the clock (on), or not (off). Never asked yet: null. */
export async function getSharing(): Promise<"on" | "off" | null> {
  const v = await kvGet(SHARE_KEY);
  return v === "on" || v === "off" ? v : null;
}
export const setSharing = (v: "on" | "off") => kvSet(SHARE_KEY, v);
