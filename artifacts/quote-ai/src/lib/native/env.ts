// Phase 118: true only in the phone app's bundle (`vite build --mode native`,
// artifacts/mobile). A build-time constant: in the website's bundle every
// `if (isNativeApp)` branch is removed by the minifier.
export const isNativeApp: boolean = import.meta.env.VITE_NATIVE === "1";

/** Where the phone app's API lives; the website calls its own origin. */
export const API_ORIGIN: string = import.meta.env.VITE_API_ORIGIN || "";
