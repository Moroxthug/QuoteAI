import { isNativeApp } from "./native/env";

// Phase 119: where the phone is, for a clock-in (checked against the job site,
// never tracked afterwards) or for setting a job's site location. In the phone
// app through the native location service — asked "while using the app" only,
// the moment it is needed; on the website through the browser. Never rejects:
// a clock-in must work without a location.

export type Position = { lat: number; lng: number; accuracy: number | null };
export type LocationPermission = "granted" | "denied" | "prompt";

const OPTIONS = { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 };

export async function locationPermission(): Promise<LocationPermission> {
  if (isNativeApp) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const { location } = await Geolocation.checkPermissions();
      return location === "granted" ? "granted" : location === "denied" ? "denied" : "prompt";
    } catch {
      return "prompt";
    }
  }
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    return status?.state === "granted" ? "granted" : status?.state === "denied" ? "denied" : "prompt";
  } catch {
    return "prompt";
  }
}

export async function currentPosition(): Promise<Position | null> {
  if (isNativeApp) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      let { location } = await Geolocation.checkPermissions();
      if (location !== "granted" && location !== "denied") location = (await Geolocation.requestPermissions({ permissions: ["location"] })).location;
      if (location !== "granted") return null;
      const pos = await Geolocation.getCurrentPosition(OPTIONS);
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null };
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null }),
      () => resolve(null),
      OPTIONS,
    );
  });
}
