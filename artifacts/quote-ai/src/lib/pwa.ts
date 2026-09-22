import { useSyncExternalStore } from "react";

// Phase 77 (docs/PILOT-LAUNCH-PLAN.md): the browser side of the PWA.
// Registers public/sw.js, keeps one small store the UI can subscribe to
// (online/offline, an install prompt when the browser offers one, an update
// waiting to activate) and exposes the three actions around it. Imported once
// from main.tsx so `beforeinstallprompt` — which fires before React mounts —
// is never missed.

type BeforeInstallPromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export type PwaState = {
  online: boolean;
  /** True when running from the home screen (standalone display mode). */
  standalone: boolean;
  /** Chrome/Edge/Android: the deferred install prompt, when the app qualifies and is not installed. */
  canPrompt: boolean;
  /** Safari on iOS/iPadOS has no prompt — the UI shows the Share → Add to Home Screen steps instead. */
  ios: boolean;
  /** A new service worker is installed and waiting; `applyUpdate()` activates it and reloads. */
  updateReady: boolean;
  /** Service workers exist in this browser and the page is a secure context. */
  supported: boolean;
};

const listeners = new Set<() => void>();
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let registration: ServiceWorkerRegistration | null = null;
let state: PwaState = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  standalone: false,
  canPrompt: false,
  ios: false,
  updateReady: false,
  supported: typeof navigator !== "undefined" && "serviceWorker" in navigator && (typeof window === "undefined" || window.isSecureContext),
};

function set(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

let initialized = false;

/** Idempotent; safe to call from main.tsx before React mounts. */
export function initPwa(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  set({ standalone: isStandalone(), ios: isIos() });
  window.addEventListener("online", () => set({ online: true }));
  window.addEventListener("offline", () => set({ online: false }));
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    set({ canPrompt: true });
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    set({ canPrompt: false, standalone: true });
  });

  // The worker is registered on the production build (and when a dev
  // explicitly opts in): in dev it would cache Vite's transformed modules and
  // fight HMR.
  if (!state.supported || !(import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW === "1")) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) set({ updateReady: true });
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // "installed" with an existing controller = an update is waiting; on a first install there is nothing to swap.
            if (installing.state === "installed" && navigator.serviceWorker.controller) set({ updateReady: true });
          });
        });
        // Look for a new build whenever the app comes back to the foreground.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => undefined);
        });
      })
      .catch(() => undefined);
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

export function usePwa(): PwaState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** Shows the browser's install dialog. Resolves to whether the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const p = deferredPrompt;
  if (!p) return false;
  await p.prompt();
  const { outcome } = await p.userChoice;
  deferredPrompt = null;
  set({ canPrompt: false });
  return outcome === "accepted";
}

/** Activates the waiting service worker; the page reloads on controllerchange. */
export function applyUpdate(): void {
  registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
}

/** On sign-out: drop the cached API reads so the next person on this browser never sees them. */
export async function clearOfflineCaches(): Promise<void> {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_API_CACHE" });
    if ("caches" in window) await caches.delete("qai-api");
  } catch {
    /* no service worker */
  }
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (registration) return registration;
  if (!state.supported) return null;
  try {
    return (await navigator.serviceWorker.getRegistration("/")) ?? null;
  } catch {
    return null;
  }
}
