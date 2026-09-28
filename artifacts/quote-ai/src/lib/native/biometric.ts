import { NativeBiometric, BiometryType } from "@capgo/capacitor-native-biometric";

// Phase 121: fingerprint / face unlock, in the phone app only. Nothing is
// stored with the biometric: the session token stays in the Keystore /
// Keychain as before (session.ts); this only asks the phone "is it you?"
// before the app shows anything, on opening and after 5 minutes away.

export type BiometricKind = "face" | "fingerprint" | "other";

export async function biometricKind(): Promise<BiometricKind | null> {
  try {
    const r = await NativeBiometric.isAvailable({ useFallback: false });
    if (!r.isAvailable) return null;
    if (r.biometryType === BiometryType.FACE_ID || r.biometryType === BiometryType.FACE_AUTHENTICATION) return "face";
    if (r.biometryType === BiometryType.FINGERPRINT || r.biometryType === BiometryType.TOUCH_ID || r.biometryType === BiometryType.MULTIPLE) return "fingerprint";
    return "other";
  } catch {
    return null;
  }
}

/** True when the phone confirmed it is them; false when they cancelled or it failed. */
export async function confirmIdentity(texts: { title: string; reason: string; cancel: string }): Promise<boolean> {
  try {
    await NativeBiometric.verifyIdentity({ title: texts.title, reason: texts.reason, subtitle: texts.reason, negativeButtonText: texts.cancel, maxAttempts: 5 });
    return true;
  } catch {
    return false;
  }
}
