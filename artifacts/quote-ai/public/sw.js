/* eslint-disable no-undef */
// Phase 77 (docs/PILOT-LAUNCH-PLAN.md): the QuoteAI service worker.
//
// Hand-written on purpose (no workbox): four caches and three rules.
//   • App shell — /index.html plus the JavaScript/CSS the dashboard, the job
//     page and the worker /t page need, precached at install so the app opens
//     with no signal. The list is injected at build time by
//     scripts/build-sw.ts from Vite's manifest (the `__PRECACHE__` marker), and the cache
//     name carries the release (`__SW_VERSION__`) so a deploy swaps the shell
//     atomically on activate. In dev the placeholders stay and only the runtime
//     rules apply.
//   • /assets/* — content-hashed and immutable: cache-first.
//   • Reads the field needs offline (the worker page, jobs, photos lists,
//     schedule, session, profile, notifications) — network-first, the last good
//     JSON kept in `qai-api` and served with `X-Served-From: sw-cache` when the
//     network is gone. Everything else under /api is never cached. Writes are
//     never intercepted: the page's outbox (src/lib/offline) owns retries.
//   • Navigations — network-first, falling back to the cached shell, then to a
//     tiny inline "offline" page.
// Push: shows the notification the API encrypted (src/lib/push.ts on the
// server) and focuses/opens the linked page on click.

const VERSION = "__SW_VERSION__";
const PRECACHE = /* __PRECACHE__ */ [];

const SHELL_CACHE = `qai-shell-${VERSION}`;
const ASSET_CACHE = `qai-assets-${VERSION}`;
const STATIC_CACHE = `qai-static-${VERSION}`;
const API_CACHE = "qai-api";
const KEEP = new Set([SHELL_CACHE, ASSET_CACHE, STATIC_CACHE, API_CACHE]);

const SHELL_URL = "/index.html";
const STATIC_PRECACHE = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/quoteai-logo.png", "/fonts/figtree-latin-wght-normal.woff2"];

/** API reads kept for offline use (pathname only; the query string is part of the cache key). */
const OFFLINE_API = /^\/api\/(t\/[^/]+|jobs(\/[^/]+(\/photos)?)?|notifications|auth\/get-session|business-profile|schedule|team\/workers|push\/config)$/;

const OFFLINE_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QuoteAI — offline</title>
<style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;color:#1f2544}main{max-width:22rem;padding:2rem;text-align:center}h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:0 0 1.25rem;color:#5b6180}button{border:0;border-radius:999px;padding:.7rem 1.4rem;background:#1f2544;color:#fff;font-size:1rem}</style></head>
<body><main><h1>You're offline</h1><p>This page hasn't been saved on this device yet. Reconnect and try again.</p><button onclick="location.reload()">Retry</button></main></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      // The shell must be there; a missing chunk is not fatal (it is fetched on demand).
      await shell.add(new Request(SHELL_URL, { cache: "reload" }));
      const assets = await caches.open(ASSET_CACHE);
      await Promise.all(PRECACHE.map((u) => assets.add(u).catch(() => undefined)));
      const statics = await caches.open(STATIC_CACHE);
      await Promise.all(STATIC_PRECACHE.map((u) => statics.add(u).catch(() => undefined)));
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (!KEEP.has(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  else if (data.type === "CLEAR_API_CACHE") event.waitUntil(caches.delete(API_CACHE));
  else if (data.type === "GET_VERSION" && event.source) event.source.postMessage({ type: "VERSION", version: VERSION });
});

function withHeader(res, name, value) {
  const headers = new Headers(res.headers);
  headers.set(name, value);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function networkFirstApi(req) {
  const cache = await caches.open(API_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone()).catch(() => undefined);
    else if (res.status === 401 || res.status === 404) cache.delete(req).catch(() => undefined);
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return withHeader(cached, "X-Served-From", "sw-cache");
    return new Response(JSON.stringify({ error: "OFFLINE", message: "You're offline and this hasn't been saved on this device yet." }), { status: 503, headers: { "Content-Type": "application/json", "X-Served-From": "sw-offline" } });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone()).catch(() => undefined);
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone()).catch(() => undefined);
      return res;
    })
    .catch(() => undefined);
  return cached || (await refresh) || new Response("", { status: 503 });
}

async function navigate(req) {
  try {
    return await fetch(req);
  } catch {
    const shell = await caches.match(SHELL_URL);
    if (shell) return shell;
    return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) {
    if (OFFLINE_API.test(url.pathname)) event.respondWith(networkFirstApi(req));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(navigate(req));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(req, ASSET_CACHE));
    return;
  }
  if (/\.(png|jpe?g|webp|svg|ico|woff2?|webmanifest)$/.test(url.pathname)) event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "QuoteAI";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      lang: data.lang || "en",
      data: { link: data.link || "/dashboard/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/dashboard/notifications";
  const url = new URL(link, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          if ("navigate" in client) client.navigate(url).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
