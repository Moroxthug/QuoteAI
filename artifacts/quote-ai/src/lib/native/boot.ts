import { isNativeApp } from "./env";
import { installNativeFetch } from "./fetch";
import { isAppPath } from "./routes";
import { crewLink } from "./crew-link";

// Phase 118: the first thing main.tsx imports. In the phone app it puts the
// API fetch in place before any module captures window.fetch, opens on the
// app (never the marketing homepage) and starts the native shell. In the
// website's bundle isNativeApp is the constant false and all of this is gone.

if (isNativeApp) {
  installNativeFetch();
  // Phase 119: a crew member opens on their own Now screen (lib/native/crew-link.ts).
  if (!isAppPath(window.location.pathname)) window.history.replaceState(null, "", crewLink() ?? "/dashboard");
  document.documentElement.classList.add("native-app");
  void import("./shell").then((m) => m.startShell()).catch(() => {});
}
