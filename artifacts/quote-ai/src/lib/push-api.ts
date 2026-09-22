// Phase 77: Web Push — the browser subscribes with the server's VAPID key and
// hands the subscription to the API (see api-server/src/routes/push.ts).
import { apiRequest as req, apiJson as json } from "./jobs-api";
import { getServiceWorkerRegistration } from "./pwa";

export type PushConfigDto = { configured: boolean; publicKey: string | null; subscribed: boolean };

export const pushApi = {
  config: (endpoint?: string | null) => req<PushConfigDto>(`/api/push/config${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ""}`),
  subscribe: (sub: PushSubscriptionJSON, language: "en" | "fr") => req<{ id: string }>("/api/push/subscriptions", { method: "POST", body: json({ endpoint: sub.endpoint, keys: sub.keys, language }) }),
  unsubscribe: (endpoint: string) => req<{ success: true; removed: boolean }>("/api/push/subscriptions", { method: "DELETE", body: json({ endpoint }) }),
  test: (language: "en" | "fr") => req<{ sent: number; failed: number; removed: number; skipped: string | null }>("/api/push/test", { method: "POST", body: json({ language }) }),
};

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
}

/** The browser's current subscription for this origin, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await getServiceWorkerRegistration();
  if (!reg) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

function keyBytes(base64url: string): Uint8Array {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type EnableResult = "enabled" | "denied" | "unsupported" | "no_worker";

/** Asks for permission, subscribes with the server's key, registers the subscription. */
export async function enablePush(publicKey: string, language: "en" | "fr"): Promise<EnableResult> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await getServiceWorkerRegistration();
  if (!reg) return "no_worker";
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource }));
  await pushApi.subscribe(sub.toJSON(), language);
  return "enabled";
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await pushApi.unsubscribe(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}
