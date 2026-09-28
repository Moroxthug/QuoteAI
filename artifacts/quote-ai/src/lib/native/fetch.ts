import { API_ORIGIN } from "./env";
import { apiPath, apiUrlFor, keptAuthCookie } from "./rewrite";
import { activeOrgId, clearSession, sessionReady, sessionToken, setActiveOrgId, setSessionToken } from "./session";

// Phase 118: the phone app's window.fetch. Installed before anything else
// captures fetch (main.tsx starts with lib/native/boot), so the sync layer, the
// outbox replay, the live feed and better-auth all go through it: API calls go
// to API_ORIGIN with the bearer token and the acting company and never with
// cookies, and the token / company the server hands back are kept. Everything
// else (the bundled files) is untouched. Server side: api-server lib/nativeApp.ts.

const SIGN_OUT = /^\/api\/auth\/(sign-out|delete-user)$/;
/** better-auth's two-step sign-in cookie, carried in a header for this run only. */
let authCookie: string | null = null;

export function installNativeFetch(): void {
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const raw = input instanceof Request ? input.url : String(input);
    const target = apiUrlFor(raw, `${window.location.protocol}//${window.location.host}`, API_ORIGIN);
    if (!target) return original(input, init);
    await sessionReady();
    const path = apiPath(target, API_ORIGIN);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const token = sessionToken();
    if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
    const org = activeOrgId();
    if (org && !headers.has("x-active-org")) headers.set("x-active-org", org);
    if (authCookie && path.startsWith("/api/auth/")) headers.set("x-auth-cookie", authCookie);
    // Phase 119: the next person on this phone must not get this company's notifications.
    if (SIGN_OUT.test(path) && token) await import("./push").then((p) => p.forgetDeviceBeforeSignOut()).catch(() => undefined);
    const request = input instanceof Request ? new Request(target, input) : target;
    const res = await original(request, { ...init, headers, credentials: "omit" });
    const next = res.headers.get("set-auth-token");
    if (next) setSessionToken(next);
    const nextOrg = res.headers.get("x-active-org");
    if (nextOrg !== null) setActiveOrgId(nextOrg || null);
    const cookie = res.headers.get("x-auth-cookie");
    if (cookie !== null) authCookie = keptAuthCookie(cookie);
    if (res.ok && SIGN_OUT.test(path)) {
      authCookie = null;
      clearSession();
    }
    return res;
  };
}
