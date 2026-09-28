import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { API_ORIGIN } from "./env";
import { appPathForLink, isRootScreen } from "./routes";

// Phase 118: the parts of the phone that are not the web page — the Android
// back button, links that open the app, the status bar, the keyboard and the
// launch screen. Loaded only by the phone app (boot.ts).

/** Hosts whose /dashboard links open the app (App Links / Universal Links). */
const SITE_HOSTS = ["quoteai.ca", "www.quoteai.ca", ...(API_ORIGIN ? [new URL(API_ORIGIN).host] : [])];

function go(path: string): void {
  // wouter follows pushState (it patches history), so this is an in-app navigation.
  window.history.pushState(null, "", path);
}

/** An open dialog, sheet or menu closes first — the same as pressing Escape. */
function closeTopLayer(): boolean {
  const open = document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"], [role="menu"], [data-modal-scrim]');
  if (!open) return false;
  const target = document.activeElement ?? document.body;
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
  return true;
}

/** A website page (Terms, Privacy, help, a client's link) in an in-app browser tab. */
export async function openOnWebsite(path: string): Promise<void> {
  await Browser.open({ url: new URL(path, API_ORIGIN).toString() });
}

let splashDown = false;

/** The first screen has drawn: take the launch screen down. */
export function hideSplash(): void {
  if (splashDown) return;
  splashDown = true;
  void SplashScreen.hide({ fadeOutDuration: 150 }).catch(() => {});
}

export async function startShell(): Promise<void> {
  // Never leave the launch screen up if the first render is slow or fails.
  setTimeout(hideSplash, 4000);

  void App.addListener("backButton", ({ canGoBack }) => {
    if (closeTopLayer()) return;
    if (canGoBack && !isRootScreen(window.location.pathname)) window.history.back();
    else void App.minimizeApp();
  });

  void App.addListener("appUrlOpen", ({ url }) => {
    const path = appPathForLink(url, SITE_HOSTS);
    if (path) go(path);
  });

  // A link that launched the app cold arrives here instead of appUrlOpen.
  const launch = await App.getLaunchUrl().catch(() => undefined);
  const launchPath = launch?.url ? appPathForLink(launch.url, SITE_HOSTS) : null;
  if (launchPath && launchPath !== window.location.pathname + window.location.search) go(launchPath);

  // Another site (a regulator's page, a review link, a provider's portal) opens
  // in a browser tab over the app, never inside the app's own WebView. (Only
  // on the phone: in a browser preview Browser.open is window.open itself.)
  if (Capacitor.isNativePlatform()) {
    document.addEventListener("click", (e) => {
      if (e.defaultPrevented || !(e.target instanceof Element)) return;
      const href = e.target.closest("a[href]")?.getAttribute("href") ?? "";
      if (!/^https?:\/\//i.test(href)) return;
      e.preventDefault();
      void Browser.open({ url: href });
    });
    const openWindow = window.open.bind(window);
    window.open = (url?: string | URL, target?: string, features?: string) => {
      const href = url ? String(url) : "";
      if (/^https?:\/\//i.test(href)) {
        void Browser.open({ url: href });
        return null;
      }
      return openWindow(url, target, features);
    };
  }

  // The app is light (dark mode comes with the app's own palette): dark status-bar icons.
  void StatusBar.setStyle({ style: Style.Light }).catch(() => {});

  // The focused field stays in view above the keyboard.
  void Keyboard.addListener("keyboardDidShow", () => {
    const el = document.activeElement;
    if (el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.scrollIntoView({ block: "center" });
  });

  // Pull down at the top of a screen to refetch what it shows.
  const [{ startPullToRefresh }, { queryClient }] = await Promise.all([import("./pull-to-refresh"), import("@/lib/query-client")]);
  startPullToRefresh(() => queryClient.refetchQueries({ type: "active" }));
}
