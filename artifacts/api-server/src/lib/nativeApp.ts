import type { RequestHandler } from "express";
import { NATIVE_APP_ORIGINS } from "./auth";

// Phase 118: the phone app (artifacts/mobile) is the website's bundle served
// from the phone itself — https://localhost on Android, capacitor://localhost
// on iOS — so every API call is cross-origin and no quoteai.ca cookie is ever
// sent. It signs in with better-auth's bearer plugin instead: the session token
// comes back in `set-auth-token` and goes out as `Authorization: Bearer`, and
// the acting company rides in X-Active-Org. Mounted before the better-auth
// handler (which answers before the general CORS middleware in app.ts).
//
// One cookie is still needed by a sign-in: with two-step verification on,
// better-auth keeps "password was right, waiting for the code" in a short-lived
// signed cookie. For the app only, that cookie travels in X-Auth-Cookie both
// ways. Only the two-factor cookie is let through; the session never is.

const AUTH_COOKIE_HEADER = "x-auth-cookie";
const NATIVE_EXPOSED_HEADERS = ["set-auth-token", "x-active-org", AUTH_COOKIE_HEADER, "content-disposition"];
const TUNNELED_COOKIE = /^(__Secure-)?better-auth\.two_factor$/;

export function isNativeAppOrigin(origin: string | undefined): origin is string {
  return !!origin && NATIVE_APP_ORIGINS.includes(origin);
}

/** `name=value` pairs of the tunneled cookies in a Cookie header or Set-Cookie list. */
function tunneledPairs(cookies: string[]): string[] {
  const out: string[] = [];
  for (const c of cookies) {
    for (const part of c.split(/;\s*/)) {
      const eq = part.indexOf("=");
      if (eq <= 0) continue;
      if (TUNNELED_COOKIE.test(part.slice(0, eq).trim())) out.push(part.trim());
    }
  }
  return out;
}

/** The first `name=value` of each Set-Cookie line (attributes dropped), tunneled ones only. */
function setCookiePairs(value: number | string | readonly string[]): string[] {
  const lines = Array.isArray(value) ? (value as string[]) : [String(value)];
  return tunneledPairs(lines.map((l) => l.split(";")[0] ?? ""));
}

export function nativeAppCors(): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!isNativeAppOrigin(origin) || !req.path.startsWith("/api") || req.path.startsWith("/api/public")) {
      next();
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Expose-Headers", NATIVE_EXPOSED_HEADERS.join(", "));
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
      const asked = req.headers["access-control-request-headers"];
      if (typeof asked === "string") res.setHeader("Access-Control-Allow-Headers", asked);
      res.setHeader("Access-Control-Max-Age", "600");
      res.statusCode = 204;
      res.setHeader("Content-Length", "0");
      res.end();
      return;
    }
    // A cookie the app never has: drop whatever the WebView may have attached.
    delete req.headers.cookie;
    if (req.path.startsWith("/api/auth/")) {
      const carried = req.headers[AUTH_COOKIE_HEADER];
      const pairs = typeof carried === "string" ? tunneledPairs([carried]) : [];
      if (pairs.length) req.headers.cookie = pairs.join("; ");
      const setHeader = res.setHeader.bind(res);
      res.setHeader = (name: string, value: number | string | readonly string[]) => {
        const lower = name.toLowerCase();
        if (lower === "set-cookie") {
          const out = setCookiePairs(value);
          if (out.length) setHeader(AUTH_COOKIE_HEADER, out.join("; "));
        }
        // better-auth's bearer plugin sets its own expose list; keep ours in it.
        if (lower === "access-control-expose-headers") {
          const merged = new Set([...String(value).split(",").map((h) => h.trim()).filter(Boolean), ...NATIVE_EXPOSED_HEADERS]);
          return setHeader(name, [...merged].join(", "));
        }
        return setHeader(name, value);
      };
    }
    next();
  };
}
