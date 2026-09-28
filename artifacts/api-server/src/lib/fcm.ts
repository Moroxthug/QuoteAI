import { createSign } from "node:crypto";

// ── Phase 119: push to the phone app through Firebase Cloud Messaging ────────
// FCM's HTTP v1 API without the Admin SDK, like lib/webPush.ts: a service
// account signs a short RS256 JWT, Google's token endpoint swaps it for an
// access token (cached until a minute before it runs out), and each message is
// one POST to fcm.googleapis.com. FCM relays to Apple's APNs for iPhones (the
// APNs key is uploaded to the Firebase project, owner item M-6), so one token
// kind covers both platforms. Plain `fetch`, so the e2e vendor stub answers for
// both hosts.
// Config: FIREBASE_SERVICE_ACCOUNT = the service account JSON (as downloaded
// from Firebase → Project settings → Service accounts), raw or base64.

export type FcmCredentials = { projectId: string; clientEmail: string; privateKey: string; tokenUri: string };

/** Phase 120: `category` (signatures, payments, …) lets an open app mark the good news with a haptic. */
export type FcmMessage = { title: string; body: string; link?: string | null; tag?: string | null; category?: string | null };

export type FcmDelivery = { ok: true; status: number } | { ok: false; status: number; gone: boolean; error: string };

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

/** Reads the service account from the environment; null when app push is not set up. */
export function readFcmCredentials(): FcmCredentials | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const j = JSON.parse(text) as { project_id?: string; client_email?: string; private_key?: string; token_uri?: string };
    if (!j.project_id || !j.client_email || !j.private_key) return null;
    return { projectId: j.project_id, clientEmail: j.client_email, privateKey: j.private_key.replace(/\\n/g, "\n"), tokenUri: j.token_uri || TOKEN_URI };
  } catch {
    return null;
  }
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** The signed assertion Google swaps for an access token (RFC 7523, valid 1 h). */
function serviceAccountAssertion(creds: FcmCredentials, now: number = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: creds.clientEmail, scope: SCOPE, aud: creds.tokenUri, iat, exp: iat + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(creds.privateKey))}`;
}

let cached: { key: string; token: string; expiresAt: number } | null = null;

/** Test hook: forget the cached access token. */
export function resetFcmTokenCache(): void {
  cached = null;
}

async function accessToken(creds: FcmCredentials): Promise<string> {
  const key = `${creds.projectId}:${creds.clientEmail}`;
  if (cached && cached.key === key && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const res = await fetch(creds.tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: serviceAccountAssertion(creds) }).toString(),
  });
  if (!res.ok) throw new Error(`token endpoint ${res.status}`);
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error("token endpoint gave no access_token");
  cached = { key, token: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

/** The v1 message: a visible notification plus the in-app path in `data.link`, which the app opens when the notification is tapped. */
function fcmPayload(token: string, message: FcmMessage) {
  const tag = message.tag ? message.tag.slice(0, 64) : undefined;
  return {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      data: { link: message.link ?? "/dashboard/notifications", ...(tag ? { tag } : {}), ...(message.category ? { category: message.category } : {}) },
      android: { priority: "HIGH", notification: { channel_id: "default", ...(tag ? { tag } : {}) } },
      apns: { headers: { "apns-priority": "10", ...(tag ? { "apns-collapse-id": tag } : {}) }, payload: { aps: { sound: "default" } } },
    },
  };
}

/** Sends one message to one device token. Never throws — the caller decides what a failure means for the row. */
export async function sendFcm(creds: FcmCredentials, token: string, message: FcmMessage): Promise<FcmDelivery> {
  let bearer: string;
  try {
    bearer = await accessToken(creds);
  } catch (err) {
    return { ok: false, status: 0, gone: false, error: (err as Error).message };
  }
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(creds.projectId)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify(fcmPayload(token, message)),
    });
    if (res.ok) return { ok: true, status: res.status };
    const text = await res.text().catch(() => "");
    if (res.status === 401) cached = null;
    // 404 UNREGISTERED: the app was uninstalled or the token rotated. 400 with
    // INVALID_ARGUMENT on the token field: the token is not one FCM knows.
    const gone = res.status === 404 || /UNREGISTERED/.test(text) || (res.status === 400 && /registration token/i.test(text));
    return { ok: false, status: res.status, gone, error: `fcm ${res.status}` };
  } catch (err) {
    return { ok: false, status: 0, gone: false, error: (err as Error).message };
  }
}
