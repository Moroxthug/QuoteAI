// Phase 118: true only in the phone app's bundle (`vite build --mode native`,
// artifacts/mobile). A build-time constant: in the website's bundle every
// `if (isNativeApp)` branch is removed by the minifier.
export const isNativeApp: boolean = import.meta.env.VITE_NATIVE === "1";

/** Where the phone app's API lives; the website calls its own origin. */
export const API_ORIGIN: string = import.meta.env.VITE_API_ORIGIN || "";

/**
 * Phase 119: the app was built with a Firebase config (google-services.json),
 * so it can register for push. Without it the Android push plugin cannot start,
 * and the app says notifications aren't set up instead of asking.
 */
export const appPushBuilt: boolean = isNativeApp && import.meta.env.VITE_APP_PUSH === "1";
