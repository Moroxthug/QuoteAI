// App lock (SystemStates "App lock", SetSecurity "Sign in and unlock after 5 minutes away"). Pure, so the rules are tested (lockRules.test.ts).

/** Away this long, the app asks again. */
export const LOCK_AFTER_MS = 5 * 60_000;

/** Locked at a cold start, or on coming back after five minutes or more in the background. */
export function lockOnReturn(o: { enabled: boolean; signedIn: boolean; awaySince: number | null; now: number }): boolean {
  if (!o.enabled || !o.signedIn) return false;
  return o.awaySince != null && o.now - o.awaySince >= LOCK_AFTER_MS;
}
export const lockAtStart = (o: { enabled: boolean; signedIn: boolean }): boolean => o.enabled && o.signedIn;

/** The offer to turn it on comes once, to a signed-in person whose phone can do it and who hasn't turned it on. */
export const offerLock = (o: { signedIn: boolean; available: boolean; enabled: boolean; offered: boolean }): boolean => o.signedIn && o.available && !o.enabled && !o.offered;

export type Method = "faceId" | "touchId" | "face" | "fingerprint" | "device";
/** Which word the buttons use: Apple's names on iOS, plain words on Android. */
export function methodOf(platform: string, types: { face: boolean; fingerprint: boolean }): Method {
  if (platform === "ios") return types.face ? "faceId" : types.fingerprint ? "touchId" : "device";
  return types.fingerprint ? "fingerprint" : types.face ? "face" : "device";
}

/** Before the phone asks: the sheet comes first only while the phone would still show its own prompt. */
export const shouldAskFirst = (p: { status?: string; granted?: boolean; canAskAgain?: boolean }): boolean => !p.granted && p.status === "undetermined" && p.canAskAgain !== false;
