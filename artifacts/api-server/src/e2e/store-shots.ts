// Phase 123/126 — Google Play (and later App Store) screenshots from the real app.
//
// Builds the phone app's own bundle (`vite build --mode native`, what the APK
// carries) and serves it the way a phone runs it: same-origin files, /api
// forwarded to the real API as the app's origin (https://localhost), the
// session as the app keeps it (a bearer token in storage). A sample company
// per language is seeded (fixtures.ts) and its test names are swapped for
// realistic ones, then every screen is captured at 360 × 640 × 3 = 1080 × 1920
// (9:16 — inside Play's 2:1 limit). Nothing is mocked or drawn over.
//
//   pnpm --filter @workspace/api-server store:shots                # EN (Ontario) + FR (Québec)
//   pnpm --filter @workspace/api-server store:shots -- --lang=fr
//
// Writes artifacts/mobile/store/play/<lang>/NN-<screen>.png. The data is
// removed afterwards like every QA run's.

import { bootstrapQaEnv, captureResend } from "./qaEnv.js";

process.env.LOG_LEVEL ??= "warn";
bootstrapQaEnv("store-shots");
process.env.NODE_ENV = "development";

import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import http from "node:http";
import { createServer as netServer } from "node:net";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { COMPANY, realNames } from "./showcase-names.js";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const WEB = path.join(ROOT, "artifacts/quote-ai");
const OUT = path.join(ROOT, "artifacts/mobile/store/play");
const WWW = path.resolve(import.meta.dirname, "../../.qa/store-www");

const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args.set(m[1]!, m[2] ?? "true");
}
const LANGS = (args.get("lang") ?? "en,fr").split(",").filter(Boolean) as Array<"en" | "fr">;

async function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = netServer();
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => res(port));
    });
    s.on("error", rej);
  });
}

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

/** The app's files, plus /api forwarded to the API as the phone app's origin. */
function serveApp(port: number, apiBase: string): http.Server {
  const api = new URL(apiBase);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname.startsWith("/api/")) {
      const headers = { ...req.headers, host: api.host, origin: "https://localhost" };
      delete headers.cookie;
      const up = http.request({ host: api.hostname, port: api.port, method: req.method, path: req.url, headers }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      });
      up.on("error", () => { res.writeHead(502); res.end(); });
      req.pipe(up);
      return;
    }
    let file = path.join(WWW, decodeURIComponent(url.pathname));
    if (!file.startsWith(WWW) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(WWW, "index.html");
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  server.listen(port, "127.0.0.1");
  return server;
}

/** The screen is drawn: its heading is up and no skeleton is left. */
async function ready(page: Page) {
  await page.waitForFunction(() => {
    const main = document.querySelector("#main") ?? document.body;
    const h1 = main.querySelector("h1") ?? document.querySelector("h1");
    return !!h1 && !main.querySelector("[class*='skel'], [aria-busy='true']");
  }, undefined, { timeout: 30_000, polling: 100 });
  await page.waitForTimeout(900); // fonts, images, the list's last row
}

const mailbox = await captureResend();
void mailbox;
const { installVendorStubs } = await import("./vendorStub.js");
installVendorStubs();
const { startServer, stopServer, createOrg, cleanupAll } = await import("./harness.js");
const { seedShowcase } = await import("./fixtures.js");

let app: http.Server | null = null;
let browser: import("playwright-core").Browser | null = null;
try {
  const apiBase = await startServer();
  const port = await freePort();
  const origin = `http://localhost:${port}`;
  console.log("[store-shots] building the phone app's bundle…");
  rmSync(WWW, { recursive: true, force: true });
  execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "vite", "build", "--config", "vite.config.ts", "--mode", "native", "--logLevel", "error"], {
    cwd: WEB, stdio: "inherit", shell: process.platform === "win32",
    env: { ...process.env, NATIVE_OUT_DIR: WWW, VITE_API_ORIGIN: origin, VITE_APP_PUSH: "1" },
  });
  app = serveApp(port, apiBase);
  browser = await chromium.launch({ channel: process.env.QA_CHROME_PATH ? undefined : "chrome", executablePath: process.env.QA_CHROME_PATH, headless: true });

  for (const lang of LANGS) {
    const org = await createOrg({ province: lang === "fr" ? "QC" : "ON", companyName: COMPANY[lang] });
    const showcase = await seedShowcase(org, { withLogo: false });
    await realNames(org.userId, lang);
    const dir = path.join(OUT, lang);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });

    const ctx = await browser.newContext({
      viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
      locale: lang === "fr" ? "fr-CA" : "en-CA", timezoneId: "America/Toronto", reducedMotion: "reduce",
      geolocation: { latitude: 43.6532, longitude: -79.3832 }, permissions: ["geolocation"],
    });
    await ctx.addInitScript(({ token, lang }) => {
      try {
        localStorage.setItem("quoteai_session-token", token);
        localStorage.setItem("quoteai-lang", lang);
        localStorage.setItem("quoteai.welcomeSeen", "1");
      } catch { /* */ }
    }, { token: org.token, lang });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.warn(`[store-shots] ${lang} page error: ${e.message.slice(0, 160)}`));

    const shots: Array<{ name: string; path: string; then?: (p: Page) => Promise<void> }> = [
      { name: "today", path: "/dashboard" },
      {
        name: "new-quote", path: "/dashboard/new",
        then: async (p) => {
          await p.locator("#main textarea").first().fill(lang === "fr"
            ? "Repeindre une chambre de 12 par 14, murs et plafond, deux couches, réparer deux trous de clou. Client : Isabelle Gagnon, Laval."
            : "Paint a 12 by 14 bedroom, walls and ceiling, two coats, patch two nail holes. Client: Sarah Chen, Ottawa.");
          await p.locator("#main textarea").first().blur();
        },
      },
      { name: "quote", path: `/dashboard/quotes/${showcase.quoteId}` },
      { name: "job", path: `/dashboard/jobs/${showcase.jobId}` },
      { name: "schedule", path: "/dashboard/schedule" },
      { name: "money", path: "/dashboard/invoices" },
      { name: "quotes", path: "/dashboard/quotes" },
      ...(showcase.workerToken ? [{ name: "crew", path: `/t/${showcase.workerToken}` }] : []),
    ];
    let n = 0;
    for (const s of shots) {
      n++;
      await page.goto(`${origin}${s.path}`, { waitUntil: "domcontentloaded" });
      await ready(page);
      if (s.then) { await s.then(page); await page.waitForTimeout(400); }
      await page.evaluate(() => window.scrollTo(0, 0));
      const file = path.join(dir, `${String(n).padStart(2, "0")}-${s.name}.png`);
      await page.screenshot({ path: file });
      console.log(`[store-shots] ${lang} ${path.relative(ROOT, file)}`);
    }
    await ctx.close();
  }
} finally {
  await browser?.close().catch(() => {});
  app?.close();
  await cleanupAll().catch((e) => console.error("[store-shots] cleanup failed", e));
  await stopServer();
}
process.exit(0);
