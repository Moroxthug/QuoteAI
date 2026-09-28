import { Capacitor } from "@capacitor/core";
import { PushNotifications, type PushNotificationSchema } from "@capacitor/push-notifications";
import { appPushBuilt } from "./env";
import { installId } from "./install";
import { isAppPath } from "./routes";

// Phase 119: notifications on the phone app. The app registers with Firebase
// Cloud Messaging (FCM relays to Apple for iPhones) and hands the token to the
// API (POST /api/push/devices, api-server lib/push.ts), which then sends every
// notification that goes out as a web push to the app too. Tapping one opens
// the exact screen its link names. Permission is asked only from a screen that
// says why (the notifications page, or the "Know the moment they accept?" card
// after a quote is sent), never at launch.

export type AppPushPermission = "granted" | "denied" | "prompt" | "unavailable";
export type AppPushResult = "enabled" | "denied" | "unavailable" | "error";

const ON_KEY = "quoteai.appPush";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private storage off: the switch shows off next start */
  }
}

function available(): boolean {
  return appPushBuilt && Capacitor.isNativePlatform();
}

/** The person turned app notifications on (and has not turned them off or signed out). */
export function appPushOn(): boolean {
  return read(ON_KEY) === "1";
}

export async function appPushPermission(): Promise<AppPushPermission> {
  if (!available()) return "unavailable";
  try {
    const { receive } = await PushNotifications.checkPermissions();
    return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt";
  } catch {
    return "unavailable";
  }
}

let tokenWaiters: ((token: string | null) => void)[] = [];
let lastToken: string | null = null;

function platform(): "android" | "ios" {
  return Capacitor.getPlatform() === "ios" ? "ios" : "android";
}

function language(): "en" | "fr" {
  return document.documentElement.lang?.startsWith("fr") ? "fr" : "en";
}

async function sendToken(token: string, lang: "en" | "fr"): Promise<boolean> {
  const res = await fetch("/api/push/devices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, installId: installId(), platform: platform(), appVersion: import.meta.env.VITE_RELEASE || undefined, language: lang }),
  });
  return res.ok;
}

/** Registers with FCM and waits for the token (or gives up after 20 s). */
function registerForToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => done(null), 20_000);
    const done = (t: string | null) => {
      clearTimeout(timer);
      tokenWaiters = tokenWaiters.filter((w) => w !== done);
      resolve(t);
    };
    tokenWaiters.push(done);
    void PushNotifications.register().catch(() => done(null));
  });
}

/** Asks the phone for permission (the system's own dialog), registers, and tells the API. */
export async function enableAppPush(lang: "en" | "fr"): Promise<AppPushResult> {
  if (!available()) return "unavailable";
  try {
    let { receive } = await PushNotifications.checkPermissions();
    if (receive !== "granted") receive = (await PushNotifications.requestPermissions()).receive;
    if (receive !== "granted") return "denied";
    const token = lastToken ?? (await registerForToken());
    if (!token) return "error";
    if (!(await sendToken(token, lang))) return "error";
    write(ON_KEY, "1");
    return "enabled";
  } catch {
    return "error";
  }
}

/** This app stops getting notifications (the phone's permission stays as it is). */
export async function disableAppPush(): Promise<void> {
  write(ON_KEY, null);
  await fetch("/api/push/devices", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ installId: installId() }) }).catch(() => undefined);
}

/** Before signing out: the next person on this phone must not get this company's notifications. Waits at most 2 s. */
export async function forgetDeviceBeforeSignOut(): Promise<void> {
  if (!appPushOn()) return;
  write(ON_KEY, null);
  await Promise.race([
    fetch("/api/push/devices", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ installId: installId() }) }).catch(() => undefined),
    new Promise((r) => setTimeout(r, 2000)),
  ]);
}

/** A notification that arrives while the app is open: shown as a toast with a way to the screen. */
export type ForegroundPush = { title: string; body: string; link: string | null };

function linkOf(n: Pick<PushNotificationSchema, "data">): string | null {
  const link = (n.data as { link?: unknown } | undefined)?.link;
  return typeof link === "string" && link.startsWith("/") && isAppPath(link.split(/[?#]/)[0]!) ? link : null;
}

export async function startAppPush(opts: { go: (path: string) => void; onForeground: (p: ForegroundPush) => void }): Promise<void> {
  if (!available()) return;
  await PushNotifications.addListener("registration", ({ value }) => {
    const refreshed = value !== lastToken;
    lastToken = value;
    for (const w of [...tokenWaiters]) w(value);
    // FCM rotates tokens now and then: a new one on an app that is on goes to the API.
    if (refreshed && appPushOn()) void sendToken(value, language()).catch(() => undefined);
  });
  await PushNotifications.addListener("registrationError", () => {
    for (const w of [...tokenWaiters]) w(null);
  });
  // Tapped in the tray (also when it launched the app): open what it is about.
  await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    opts.go(linkOf(notification) ?? "/dashboard/notifications");
  });
  await PushNotifications.addListener("pushNotificationReceived", (n) => {
    opts.onForeground({ title: n.title ?? "", body: n.body ?? "", link: linkOf(n) });
  });
  if (Capacitor.getPlatform() === "android") {
    await PushNotifications.createChannel({ id: "default", name: language() === "fr" ? "Notifications" : "Notifications", description: "QuoteAI", importance: 4, visibility: 0 }).catch(() => undefined);
  }
  // On at the last start and still allowed: register again so a rotated token is sent.
  if (appPushOn() && (await appPushPermission()) === "granted") void PushNotifications.register().catch(() => undefined);
}
