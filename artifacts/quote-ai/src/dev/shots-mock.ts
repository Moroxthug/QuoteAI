// Dev only (main.tsx loads it when localStorage "qa-shots" is set): answers the
// API from fixed sample data so the real signed-in screens can be opened and
// photographed for the marketing feature pages (SEO plan S4), with no database.
// Unknown /api/ calls return 404 and are listed in window.__shotsUnmatched.
import { SHOTS_ROUTES } from "./shots-data";

type Handler = (url: URL, init?: RequestInit) => unknown;

const unmatched: string[] = [];
(window as unknown as { __shotsUnmatched: string[] }).__shotsUnmatched = unmatched;

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return realFetch(input, init);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  for (const [pattern, handler] of SHOTS_ROUTES as Array<[RegExp, Handler]>) {
    if (pattern.test(`${method} ${url.pathname}`)) {
      const body = handler(url, init);
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }
  }
  unmatched.push(`${method} ${url.pathname}${url.search}`);
  return new Response(JSON.stringify({ error: "shots: no sample data" }), { status: 404, headers: { "content-type": "application/json" } });
};
