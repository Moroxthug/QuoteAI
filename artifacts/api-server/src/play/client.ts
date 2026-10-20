// Phase 135: a small Google Play Developer API client (androidpublisher v3) with no SDK: a service account signs an RS256 JWT, trades it for an OAuth token, and fetch does the rest. Same approach as weather/weatherkit.ts.
import { createSign } from "node:crypto";
import type { SubscriptionPurchaseV2 } from "./purchase.js";
import { playPackageName } from "./products.js";

const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

export type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

/** Our error codes. The routes map them: PLAY_NOT_CONFIGURED (503), PURCHASE_NOT_VALID (400), PLAY_UNAVAILABLE (502). */
export type PlayErrorCode = "PLAY_NOT_CONFIGURED" | "PURCHASE_NOT_VALID" | "PLAY_UNAVAILABLE";

export class PlayError extends Error {
  constructor(readonly code: PlayErrorCode, message: string, readonly status?: number) {
    super(message);
    this.name = "PlayError";
  }
}

/** The key as the env holds it: raw JSON, or the same JSON in base64. Null when it is missing or unusable. */
export function parseServiceAccount(raw: string | undefined | null): ServiceAccount | null {
  const text = raw?.trim();
  if (!text) return null;
  try {
    const json = text.startsWith("{") ? text : Buffer.from(text, "base64").toString("utf8");
    const j = JSON.parse(json) as Partial<ServiceAccount>;
    if (typeof j.client_email !== "string" || typeof j.private_key !== "string" || !j.client_email || !j.private_key) return null;
    return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, "\n"), token_uri: typeof j.token_uri === "string" ? j.token_uri : undefined };
  } catch {
    return null;
  }
}

const b64url = (b: Buffer | string): string => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** The signed request for an OAuth token: RS256, valid for an hour. */
export function serviceAccountAssertion(sa: ServiceAccount, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iss: sa.client_email, scope: SCOPE, aud: sa.token_uri ?? DEFAULT_TOKEN_URI, iat: nowSec, exp: nowSec + 3600 };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return `${data}.${b64url(createSign("RSA-SHA256").update(data).sign(sa.private_key))}`;
}

export type PlayClientOptions = { serviceAccount: ServiceAccount; packageName: string; fetcher?: typeof fetch; now?: () => number };

export class PlayClient {
  private token: { value: string; expiresAtMs: number } | null = null;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  readonly packageName: string;

  constructor(private readonly opts: PlayClientOptions) {
    this.fetcher = opts.fetcher ?? fetch;
    this.now = opts.now ?? Date.now;
    this.packageName = opts.packageName;
  }

  /** An OAuth access token, cached until a minute before it runs out. */
  async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAtMs - 60_000 > this.now()) return this.token.value;
    const sa = this.opts.serviceAccount;
    let res: Response;
    try {
      res = await this.fetcher(sa.token_uri ?? DEFAULT_TOKEN_URI, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: serviceAccountAssertion(sa, Math.floor(this.now() / 1000)) }).toString(),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      if (err instanceof PlayError) throw err;
      throw new PlayError("PLAY_UNAVAILABLE", "Could not reach Google to sign in");
    }
    if (!res.ok) {
      // Google refuses the key (revoked, wrong account): that is our configuration, not the customer's purchase.
      if (res.status >= 400 && res.status < 500) throw new PlayError("PLAY_NOT_CONFIGURED", `Google refused the service account (${res.status})`, res.status);
      throw new PlayError("PLAY_UNAVAILABLE", `Google sign-in failed (${res.status})`, res.status);
    }
    const j = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
    if (!j?.access_token) throw new PlayError("PLAY_UNAVAILABLE", "Google sign-in returned no token");
    this.token = { value: j.access_token, expiresAtMs: this.now() + Math.max(60, j.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }

  private async call(method: "GET" | "POST", path: string, body?: unknown): Promise<Response> {
    const token = await this.accessToken();
    let res: Response;
    try {
      res = await this.fetcher(`${API}/${encodeURIComponent(this.packageName)}/${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new PlayError("PLAY_UNAVAILABLE", "Could not reach Google Play");
    }
    if (res.ok) return res;
    // 401/403: our service account may not read this app (Play Console permissions). 400/404/410: the token is not a purchase of this app, or too old.
    if (res.status === 401 || res.status === 403) {
      this.token = null;
      throw new PlayError("PLAY_NOT_CONFIGURED", `Google Play did not authorise the service account (${res.status})`, res.status);
    }
    if (res.status === 400 || res.status === 404 || res.status === 410) throw new PlayError("PURCHASE_NOT_VALID", `Google Play does not know this purchase (${res.status})`, res.status);
    throw new PlayError("PLAY_UNAVAILABLE", `Google Play answered ${res.status}`, res.status);
  }

  /** purchases.subscriptionsv2.get */
  async getSubscription(purchaseToken: string): Promise<SubscriptionPurchaseV2> {
    const res = await this.call("GET", `purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);
    return (await res.json()) as SubscriptionPurchaseV2;
  }

  /** purchases.subscriptions.acknowledge (the v1 method; v2 has none). Google refunds an unacknowledged purchase after 3 days. */
  async acknowledge(subscriptionId: string, purchaseToken: string): Promise<void> {
    await this.call("POST", `purchases/subscriptions/${encodeURIComponent(subscriptionId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {});
  }
}

/** The client for this deployment, or null when the key is not set (the routes answer PLAY_NOT_CONFIGURED). Read by literal env names for env:inventory. */
let shared: { raw: string; client: PlayClient } | null = null;
export function playClientFromEnv(): PlayClient | null {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const sa = parseServiceAccount(raw);
  if (!raw || !sa) return null;
  if (shared && shared.raw === raw) return shared.client;
  shared = { raw, client: new PlayClient({ serviceAccount: sa, packageName: playPackageName() }) };
  return shared.client;
}
