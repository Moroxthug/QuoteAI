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

// The fixture's test names → people a contractor would have as clients and crew.
const NAMES: Record<"en" | "fr", Array<[string, string]>> = {
  en: [
    ["Jordan Client", "Sarah Chen"], ["Casey Pending", "Mike Thompson"], ["Morgan Longlist", "Priya Patel"],
    ["Alex Morin", "David Wilson"], ["Pat Worker", "Luis Martinez"], ["Pay Client", "Emily Roberts"], ["Client Ave", "Maple Ave"], ["Longlist Rd", "Birchwood Rd"],
    ["client@e2e-test.invalid", "sarah.chen@example.com"], ["pending@e2e-test.invalid", "mike.thompson@example.com"],
    ["longlist@e2e-test.invalid", "priya.patel@example.com"], ["alex@e2e-test.invalid", "d.wilson@example.com"],
    ["e2e-test.invalid", "example.com"], ["example.invalid", "example.com"],
  ],
  fr: [
    ["Jordan Client", "Isabelle Gagnon"], ["Casey Pending", "Marc Pelletier"], ["Robin Tremblay", "Sophie Bélanger"], ["Morgan Longlist", "Julie Lavoie"],
    ["Alex Morin", "Alexandre Roy"], ["Pat Worker", "Kevin Bouchard"], ["Pay Client", "Nathalie Bergeron"], ["Client Ave", "rue des Érables"], ["Kitchen renovation", "Rénovation de cuisine"], ["K1A 0B1", "H2V 1B7"], ["Longlist Rd", "boul. des Laurentides"],
    ["client@e2e-test.invalid", "isabelle.gagnon@example.com"], ["pending@e2e-test.invalid", "marc.pelletier@example.com"],
    ["longlist@e2e-test.invalid", "julie.lavoie@example.com"], ["alex@e2e-test.invalid", "alexandre.roy@example.com"],
    ["e2e-test.invalid", "example.com"], ["example.invalid", "example.com"],
  ],
};
const COMPANY = { en: "Northside Renovations Ltd.", fr: "Rénovations Tremblay inc." };
// Each sample quote its own job, as a real list would have (was the generic default title on all of them).
const JOBS: Record<"en" | "fr", Record<string, string>> = {
  en: { "Sarah Chen": "Kitchen renovation", "Mike Thompson": "Basement finishing", "Priya Patel": "Bathroom remodel", "David Wilson": "Deck and fence" },
  fr: { "Isabelle Gagnon": "Rénovation de cuisine", "Marc Pelletier": "Finition du sous-sol", "Julie Lavoie": "Rénovation de salle de bain", "Alexandre Roy": "Terrasse et clôture" },
};
const OWNER = { en: "Alex Martin", fr: "Mathieu Côté" };

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

/** Swap the fixture's test names in every row this account owns (text and JSON columns). */
async function realNames(userId: string, lang: "en" | "fr") {
  const { db } = await import("@workspace/db");
  const { sql } = await import("drizzle-orm");
  const cols = (await db.execute<{ table_name: string; column_name: string; data_type: string }>(sql`
    select c.table_name, c.column_name, c.data_type from information_schema.columns c
    where c.table_schema = 'public' and c.data_type in ('text', 'character varying', 'jsonb', 'json')
      and exists (select 1 from information_schema.columns u where u.table_schema = 'public' and u.table_name = c.table_name and u.column_name = 'user_id')
      and c.column_name <> 'user_id'`)).rows;
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  for (const [from, to] of NAMES[lang]) {
    for (const c of cols) {
      const cast = c.data_type === "jsonb" ? "::jsonb" : c.data_type === "json" ? "::json" : "";
      // JSON strings escape nothing in these values, so a plain text replace keeps the JSON valid.
      await db.execute(sql.raw(`update ${q(c.table_name)} set ${q(c.column_name)} = replace(${q(c.column_name)}::text, '${from.replace(/'/g, "''")}', '${to.replace(/'/g, "''")}')${cast} where user_id = '${userId.replace(/'/g, "''")}' and ${q(c.column_name)}::text like '%${from.replace(/'/g, "''")}%'`));
    }
  }
  await db.execute(sql`update auth_user set name = ${OWNER[lang]} where id = ${userId}`);
  for (const [client, job] of Object.entries(JOBS[lang])) {
    await db.execute(sql`update quotes set titolo_preventivo_riga1 = ${job}, descrizione_generale = ${job} where user_id = ${userId} and client_data->>'nome' = ${client}`);
  }
  // The crew's shift today: a normal working day (the fixture seeds it around the current time), and
  // nothing else booked over it for the same person (the board would flag a double booking).
  const moved = (await db.execute<{ id: string }>(sql`update schedule_blocks set starts_at = (date_trunc('day', now() at time zone 'America/Toronto') + interval '7 hours 30 minutes') at time zone 'America/Toronto', ends_at = (date_trunc('day', now() at time zone 'America/Toronto') + interval '16 hours') at time zone 'America/Toronto' where user_id = ${userId} and starts_at < now() and ends_at > now() returning id`)).rows;
  for (const m of moved) {
    await db.execute(sql`delete from schedule_blocks b using schedule_blocks m where m.id = ${m.id} and b.user_id = m.user_id and b.id <> m.id and b.collaborator_id = m.collaborator_id and b.starts_at < m.ends_at and b.ends_at > m.starts_at`);
  }
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
