// Phase 118: which requests of the phone app go to the API, and where.
// The bundled app runs at https://localhost (Android) or capacitor://localhost
// (iOS), so a relative "/api/…" — and better-auth's "<origin>/api/auth/…" —
// would ask the WebView itself. Pure so it is unit-tested (native.test.ts).

/** The API URL for a request the app makes, or null when it is not an API call. */
export function apiUrlFor(url: string, pageOrigin: string, apiOrigin: string): string | null {
  if (!apiOrigin) return null;
  if (url.startsWith("/api/") || url === "/api") return apiOrigin + url;
  if (url.startsWith("/")) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // Compared by scheme + host: a custom scheme (iOS capacitor://) has an opaque URL.origin.
  if (`${parsed.protocol}//${parsed.host}` !== pageOrigin) return null;
  if (!parsed.pathname.startsWith("/api/")) return null;
  return apiOrigin + parsed.pathname + parsed.search;
}

/** An /api path of the app, whichever way the request named it (for sign-out detection). */
export function apiPath(apiUrl: string, apiOrigin: string): string {
  const rest = apiUrl.slice(apiOrigin.length);
  const q = rest.search(/[?#]/);
  return q === -1 ? rest : rest.slice(0, q);
}

/** The X-Auth-Cookie to send back: null once the server has cleared every cookie in it. */
export function keptAuthCookie(header: string): string | null {
  const pairs = header.split(/;\s*/).filter((p) => /=./.test(p));
  return pairs.length ? pairs.join("; ") : null;
}
