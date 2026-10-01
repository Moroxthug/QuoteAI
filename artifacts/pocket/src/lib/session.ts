// The app talks to the existing API (artifacts/api-server) with better-auth's bearer token,
// kept in the phone's secure store. EXPO_PUBLIC_API_ORIGIN picks the server; in development
// the Android emulator reaches this computer at 10.0.2.2.
//
// Like the Capacitor app before it (quote-ai lib/native/fetch.ts), the app's fetch is wrapped once:
//  - every API call carries the bearer token and the acting company (X-Active-Org), never cookies;
//  - the token and company the server hands back (set-auth-token, x-active-org) are kept;
//  - sign-in calls say they come from the app (Origin https://localhost, the one the server's
//    native-app CORS and two-step cookie tunnel (api-server lib/nativeApp.ts) answer to), and the
//    language the emails follow (x-quoteai-lang).
import { Platform } from "react-native";
import { kvGet, kvSet } from "./kv";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

const TOKEN_KEY = "quoteai_session-token";
const ORG_KEY = "quoteai_active-org";

export const API_ORIGIN =
  process.env.EXPO_PUBLIC_API_ORIGIN ?? (__DEV__ ? (Platform.OS === "android" ? "http://10.0.2.2:5088" : "http://localhost:5088") : "https://quoteai.ca");

/** The origin the server's phone-app handling recognises (api-server auth.ts NATIVE_APP_ORIGINS). */
const APP_ORIGIN = "https://localhost";

const read = kvGet;
const write = kvSet;

let token: string | null | undefined;
let org: string | null | undefined;
const listeners = new Set<() => void>();

/** Subscribe to token / company changes (the session provider). */
export function onSessionChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export async function getToken(): Promise<string | null> {
  if (token === undefined) token = await read(TOKEN_KEY);
  return token;
}

export async function setToken(next: string | null): Promise<void> {
  if (next === token) return;
  token = next;
  await write(TOKEN_KEY, next);
  listeners.forEach((fn) => fn());
}

export async function getActiveOrg(): Promise<string | null> {
  if (org === undefined) org = await read(ORG_KEY);
  return org;
}

export async function setActiveOrg(next: string | null): Promise<void> {
  if (next === org) return;
  org = next;
  await write(ORG_KEY, next);
}

/** Signed out, or the account is gone: forget the token and the company. */
export async function clearSession(): Promise<void> {
  org = null;
  await write(ORG_KEY, null);
  await setToken(null);
}

/** The language the server's emails follow; set by the i18n layer. */
let language: "en" | "fr" = "en";
export function setRequestLanguage(next: "en" | "fr"): void {
  language = next;
}

/** The two-step cookie better-auth keeps between "password right" and "code right", for this run only. */
let twoStepCookie: string | null = null;
const TUNNELED = /^(__Secure-)?better-auth\.two_factor=/;

let installed = false;
function installFetch(): void {
  if (installed) return;
  installed = true;
  const original = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!raw.startsWith(API_ORIGIN)) return original(input, init);
    const path = raw.slice(API_ORIGIN.length);
    const headers = new Headers(init?.headers ?? (typeof input === "object" && "headers" in input ? input.headers : undefined));
    const [t, o] = await Promise.all([getToken(), getActiveOrg()]);
    if (t && !headers.has("authorization")) headers.set("authorization", `Bearer ${t}`);
    if (o && !headers.has("x-active-org")) headers.set("x-active-org", o);
    headers.set("x-quoteai-lang", language);
    const isAuth = path.startsWith("/api/auth/");
    if (isAuth && Platform.OS !== "web") {
      headers.set("origin", APP_ORIGIN);
      if (twoStepCookie) headers.set("x-auth-cookie", twoStepCookie);
    }
    const res = await original(raw, { ...init, headers, credentials: "omit" });
    const nextToken = res.headers.get("set-auth-token");
    if (nextToken) await setToken(nextToken);
    const nextOrg = res.headers.get("x-active-org");
    if (nextOrg !== null) await setActiveOrg(nextOrg || null);
    if (isAuth) {
      const cookie = res.headers.get("x-auth-cookie");
      if (cookie !== null) twoStepCookie = cookie.split(/;\s*/).filter((p) => TUNNELED.test(p)).join("; ") || null;
    }
    return res;
  };
}

setBaseUrl(API_ORIGIN);
setAuthTokenGetter(getToken);
installFetch();
