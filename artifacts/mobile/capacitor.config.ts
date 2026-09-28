import type { CapacitorConfig } from "@capacitor/cli";

// Phase 118 (docs/APP-PLAN.md): QuoteAI for phones. The app is the website's
// signed-in app built for the phone (`vite build --mode native`, copied into
// www/ by scripts/build-web.ts) and bundled — it opens from the phone, not
// from quoteai.ca — and it talks to the API at VITE_API_ORIGIN.
//
// CAP_DEV=1 is for a build that talks to a dev API over plain http (an
// emulator reaching the computer at 10.0.2.2): it allows cleartext and mixed
// content. Never set for a build that leaves this computer.
const dev = process.env.CAP_DEV === "1";

const config: CapacitorConfig = {
  appId: "ca.quoteai.app",
  appName: "QuoteAI",
  webDir: "www",
  // The WebView's origin is https://localhost (Android) / capacitor://localhost
  // (iOS); the API trusts exactly these (api-server lib/auth.ts NATIVE_APP_ORIGINS).
  server: { androidScheme: "https", ...(dev ? { cleartext: true } : {}) },
  android: { allowMixedContent: dev },
  plugins: {
    // Taken down by the app once its first screen has drawn (lib/native/shell.ts).
    SplashScreen: { launchAutoHide: false, backgroundColor: "#ffffff", androidScaleType: "CENTER_INSIDE", showSpinner: false },
    // The page resizes above the keyboard, so the focused field and a docked save bar stay visible.
    Keyboard: { resize: "native", resizeOnFullScreen: true },
    // Edge to edge; the real insets reach the CSS as --safe-area-inset-* (mockup-system.css --safe-*).
    SystemBars: { insetsHandling: "css", initialViewportFitValueHint: "cover", style: "LIGHT" },
  },
};

export default config;
