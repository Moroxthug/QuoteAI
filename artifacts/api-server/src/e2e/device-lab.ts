// Phase 122 — the device lab, emulated (docs/APP-PLAN.md "Accessibility and
// the device lab pass").
//
// The ten core journeys, on four phones, against the real API and the
// production build (dist/public through server/serve.mjs — what a phone
// downloads, not Vite's unbundled dev modules). Each phone is Chrome told to
// be that phone: its screen, pixel ratio, touch, user agent, a CPU slowed to
// its class and its network. It is not the phone — Safari's engine, the real
// GPU, the keyboard and the fingers are not in it — so the owner's real-device
// pass (M-list) still comes after; what this catches is the rest: a journey
// that breaks at one size, a screen that overflows on a small phone, focus that
// doesn't follow the screen, and how long each step takes on a slow phone.
//
// For every device × journey × step it records the time from the tap to the
// next screen being ready, horizontal overflow, where focus landed after a
// screen change, console errors and failed /api calls, and long tasks; one
// screenshot per journey. Writes .qa/devices/report.{md,json}.
// Exit 1 when a journey fails, a screen overflows, focus is lost after a
// screen change, or (on the current-Android profile, `--budgets`) the plan's
// numbers are missed: open to content < 1.5 s (the everyday, warm opening),
// screen change < 300 ms to a screen seen before (a first visit waits on the
// lab's own API, which talks to a remote database — reported, not budgeted).
//
//   pnpm --filter @workspace/quote-ai build            # the build the lab serves
//   pnpm --filter @workspace/api-server qa:devices
//   pnpm --filter @workspace/api-server qa:devices -- --devices=iphone-se --journeys=send,payment
//   pnpm --filter @workspace/api-server qa:devices -- --dev          # against Vite instead of the build
//   pnpm --filter @workspace/api-server qa:devices -- --budgets=false

import { bootstrapQaEnv, captureResend } from "./qaEnv.js";

process.env.LOG_LEVEL ??= "warn";
bootstrapQaEnv("qa-devices");
process.env.NODE_ENV = "development";

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type CDPSession, type Page } from "playwright-core";
import { startVite, stopVite } from "./viteServer.js";

const ROOT = resolve(import.meta.dirname, "../../../..");
const WEB = resolve(ROOT, "artifacts/quote-ai");

const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args.set(m[1]!, m[2] ?? "true");
}
const DEV = args.has("dev");
const BUDGETS = args.get("budgets") !== "false";
const OUT = resolve(import.meta.dirname, "../../.qa", args.get("out") ?? "devices");
const DEVICE_FILTER = (args.get("devices") ?? "").split(",").filter(Boolean);
const JOURNEY_FILTER = (args.get("journeys") ?? "").split(",").filter(Boolean);

// ── The phones ───────────────────────────────────────────────────────────────
type Net = { latency: number; down: number; up: number; label: string };
const NET_4G: Net = { latency: 70, down: (9 * 1024 * 1024) / 8, up: (3 * 1024 * 1024) / 8, label: "4G (9 Mb/s, 70 ms)" };
const NET_SLOW_4G: Net = { latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8, label: "slow 4G (1.6 Mb/s, 150 ms)" };
const ANDROID_UA = (model: string) => `Mozilla/5.0 (Linux; Android 14; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36`;
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

type Device = { id: string; name: string; width: number; height: number; dpr: number; cpu: number; net: Net; ua: string; budgets: boolean };
const DEVICES: Device[] = [
  // A 2-3-year-old budget phone: a small screen, a slow CPU (Lighthouse's Moto G Power class is 4×; older is slower) and a weak signal.
  { id: "low-android", name: "Low-end Android (Moto G-class, 2022)", width: 360, height: 740, dpr: 2, cpu: 6, net: NET_SLOW_4G, ua: ANDROID_UA("moto g play"), budgets: false },
  // The plan's reference phone for the numbers: mid-range Android on 4G.
  { id: "android", name: "Current Android (Pixel 8-class)", width: 412, height: 915, dpr: 2.625, cpu: 2, net: NET_4G, ua: ANDROID_UA("Pixel 8"), budgets: true },
  { id: "iphone-se", name: "iPhone SE (small iPhone)", width: 375, height: 667, dpr: 2, cpu: 2, net: NET_4G, ua: IOS_UA, budgets: false },
  { id: "iphone-max", name: "Large iPhone (Pro Max)", width: 430, height: 932, dpr: 3, cpu: 1, net: NET_4G, ua: IOS_UA, budgets: false },
].filter((d) => !DEVICE_FILTER.length || DEVICE_FILTER.includes(d.id));

const BUDGET_OPEN_MS = 1500;
const BUDGET_NAV_MS = 300;

// ── Recording ────────────────────────────────────────────────────────────────
type Step = { label: string; ms: number; kind: "open" | "nav" | "action"; focus?: string; overflow?: string; error?: string };
type Run = { device: string; journey: string; ok: boolean; error?: string; steps: Step[]; longTasksMs: number; consoleErrors: string[]; failedRequests: string[]; screenshot: string; findings: string[] };

/** The screen is ready: its heading is up and no skeleton is left in the page. */
async function ready(page: Page, timeout = 20_000) {
  await page.waitForFunction(() => {
    const main = document.querySelector("#main") ?? document.body;
    const h1 = main.querySelector("h1") ?? document.querySelector("h1");
    if (!h1 || !(h1 as HTMLElement).offsetParent) return false;
    return !main.querySelector("[class*='skel'], [aria-busy='true']");
  }, undefined, { timeout, polling: 50 });
}

async function checkOverflow(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const d = document.documentElement;
    if (d.scrollWidth <= d.clientWidth + 1) return undefined;
    const wide = Array.from(document.querySelectorAll("body *")).filter((el) => el.getBoundingClientRect().right > d.clientWidth + 1).slice(-3).map((el) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).split(" ")[0]}`);
    return `${d.scrollWidth}px in ${d.clientWidth}px (${wide.join(", ")})`;
  });
}

/** After a screen change focus belongs on the new screen's heading, a field it opened on, or an open sheet. */
async function focusAfterNav(page: Page): Promise<{ where: string; ok: boolean }> {
  // Up to 2.5 s for focus to reach the new screen (a throttled phone draws it late); then judge where it is.
  await page.waitForFunction(() => { const a = document.activeElement; return !!a && (a.tagName === "H1" || !!a.closest("[role='dialog']") || (a.matches("input, textarea, select") && !!a.closest("#main"))); }, undefined, { timeout: 2500, polling: 50 }).catch(() => {});
  return page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    const why = `[dialogs ${Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).map((d) => String((d as HTMLElement).className).slice(0, 40) + ":" + d.getAttribute("data-state")).join("/")}, skel ${Array.from(document.querySelectorAll("#main [class*='skel'], #main [aria-busy='true']")).map((e) => String((e as HTMLElement).className).slice(0, 30)).join("/")}, h1 ${document.querySelectorAll("#main h1").length}, said "${document.querySelector("[data-route-announcer]")?.textContent}"]`;
    if (!a || a === document.body) return { where: `body (lost) ${why}`, ok: false };
    const where = `${a.tagName.toLowerCase()}${a.id ? `#${a.id}` : ""} "${(a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${why}`;
    const ok = a.tagName === "H1" || !!a.closest("[role='dialog']") || (a.matches("input, textarea, select") && !!a.closest("#main"));
    return { where, ok };
  });
}

class JourneyCtx {
  steps: Step[] = [];
  constructor(public page: Page, public device: Device) {}
  /** A tap that changes the screen: timed to the new screen being ready, then overflow and focus. */
  async nav(label: string, tap: () => Promise<unknown>, urlPart?: RegExp) {
    const t0 = Date.now();
    await tap();
    if (urlPart) await this.page.waitForURL(urlPart, { timeout: 20_000 });
    await ready(this.page);
    const ms = Date.now() - t0;
    const focus = await focusAfterNav(this.page);
    this.steps.push({ label, ms, kind: "nav", focus: focus.ok ? undefined : focus.where, overflow: await checkOverflow(this.page) });
  }
  async open(label: string, path: string, base: string) {
    const t0 = Date.now();
    await this.page.goto(`${base}${path}`, { waitUntil: "commit" });
    await ready(this.page, 45_000);
    this.steps.push({ label, ms: Date.now() - t0, kind: "open", overflow: await checkOverflow(this.page) });
  }
  /** Something done on the screen (send, save, tick), timed to its visible answer. */
  async act(label: string, run: () => Promise<unknown>) {
    const t0 = Date.now();
    await run();
    this.steps.push({ label, ms: Date.now() - t0, kind: "action", overflow: await checkOverflow(this.page) });
  }
}

type Fixture = { base: string; showcase: import("./fixtures.js").Showcase; ownerEmail: string };
type Journey = { id: string; name: string; who: "owner" | "worker"; run: (j: JourneyCtx, f: Fixture) => Promise<void> };

const tab = (page: Page, href: string) => page.locator(`.tabbar a[href="${href}"]`).first();
/** A tiny valid JPEG (1×1), for the photo journey. */
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");

const ALL_JOURNEYS: Journey[] = [
  {
    id: "open", name: "Open the app to Today", who: "owner",
    run: async (j, f) => {
      await j.open("cold start → Today", "/dashboard", f.base);
      // The second opening is the everyday one: the saved data draws first (Phase 116).
      await j.open("warm start → Today", "/dashboard", f.base);
    },
  },
  {
    id: "quotes", name: "Find a quote", who: "owner",
    run: async (j, f) => {
      await j.open("Today", "/dashboard", f.base);
      await j.nav("tab → Quotes", () => tab(j.page, "/dashboard/quotes").click(), /\/dashboard\/quotes$/);
      await j.nav("row → the quote", () => j.page.locator(`#main a[href^="/dashboard/quotes/"]`).first().click(), /\/dashboard\/quotes\/[0-9a-f-]{36}/);
      // The everyday case: screens already seen once, their code and data on the phone (Phase 116).
      await j.nav("tab → Quotes (again)", () => tab(j.page, "/dashboard/quotes").click(), /\/dashboard\/quotes$/);
      await j.nav("row → the quote (again)", () => j.page.locator(`#main a[href^="/dashboard/quotes/"]`).first().click(), /\/dashboard\/quotes\/[0-9a-f-]{36}/);
      await j.nav("tab → Today (again)", () => tab(j.page, "/dashboard").click(), /\/dashboard$/);
    },
  },
  {
    id: "new-quote", name: "Build a quote by hand", who: "owner",
    // By hand: the lab's server has no AI key, so "Write my quote" would take the error path on purpose.
    run: async (j, f) => {
      await j.open("New quote", "/dashboard/new", f.base);
      await j.act("Manual", async () => {
        await j.page.locator("#main button").filter({ hasText: /^Manual$/ }).first().click();
        await j.page.locator("#main input[placeholder='e.g. Bathroom renovation']").waitFor({ timeout: 10_000 });
      });
      await j.page.locator("#main input[placeholder='e.g. Bathroom renovation']").fill("Bedroom repaint");
      await j.act("a line → its sheet", async () => {
        await j.page.locator("#main button").filter({ hasText: /^Edit line/ }).first().click();
        await j.page.getByRole("dialog").filter({ hasText: /Edit line/ }).waitFor();
      });
      const sheet = j.page.getByRole("dialog").filter({ hasText: /Edit line/ });
      await sheet.locator("textarea").first().fill("Walls and ceiling, two coats");
      await sheet.locator("input[placeholder='0.00']").fill("850");
      await sheet.getByRole("button", { name: /^Done$/ }).click();
      await sheet.waitFor({ state: "detached" });
      await j.nav("Create Quote → the quote", () => j.page.getByRole("button", { name: /^Create Quote$/ }).click(), /\/dashboard\/quotes\/[0-9a-f-]{36}/);
    },
  },
  {
    id: "send", name: "Send a quote", who: "owner",
    run: async (j, f) => {
      await j.open("the quote", `/dashboard/quotes/${f.showcase.longQuoteId}`, f.base);
      await j.act("Send → the sheet", async () => {
        await j.page.getByRole("button", { name: /^Send/ }).first().click();
        await j.page.getByRole("dialog").waitFor();
      });
      const dialog = j.page.getByRole("dialog");
      const to = dialog.locator("input[type='email']").first();
      if (await to.count() && !(await to.inputValue())) await to.fill(f.ownerEmail);
      await j.act("Send → sent", async () => {
        await dialog.getByRole("button", { name: /^Send/ }).last().click();
        await dialog.waitFor({ state: "detached", timeout: 20_000 });
      });
    },
  },
  {
    id: "job", name: "Tick a task on a job", who: "owner",
    run: async (j, f) => {
      await j.open("Today", "/dashboard", f.base);
      await j.nav("tab → Jobs", () => tab(j.page, "/dashboard/jobs").click(), /\/dashboard\/jobs$/);
      await j.nav("row → the job", () => j.page.locator(`#main a[href="/dashboard/jobs/${f.showcase.jobId}"]`).first().click(), new RegExp(`/dashboard/jobs/${f.showcase.jobId}`));
      await j.act("tab → Schedule", () => j.page.locator("#main [role='tab'], #main button").filter({ hasText: /^Schedule/ }).first().click());
      const task = j.page.locator("#main button.chk").first();
      await j.act("tick a task", async () => {
        const before = await task.getAttribute("aria-pressed");
        await task.click();
        await j.page.waitForFunction((b) => document.querySelector("#main button.chk")?.getAttribute("aria-pressed") !== b, before, { timeout: 5_000 });
      });
    },
  },
  {
    id: "photo", name: "Add a job photo", who: "owner",
    run: async (j, f) => {
      await j.open("the job", `/dashboard/jobs/${f.showcase.jobId}`, f.base);
      await j.act("tab → Photos", () => j.page.locator("#main [role='tab'], #main button").filter({ hasText: /^Photos/ }).first().click());
      const panel = j.page.locator("#main");
      const before = await panel.locator("img").count();
      await j.act("pick a photo → on the job", async () => {
        await panel.locator("input[type='file'][multiple]").first().setInputFiles({ name: "site.jpg", mimeType: "image/jpeg", buffer: JPEG });
        await j.page.waitForFunction((n) => document.querySelectorAll("#main img").length > n, before, { timeout: 20_000 });
      });
    },
  },
  {
    // Phase 122: "Upload photos on Wi-Fi only" on a phone that is on its data plan (the setting lives in
    // More → This app in the phone app; the hold itself is the outbox's, the same in the website bundle).
    id: "wifi", name: "Photos wait for Wi-Fi", who: "owner",
    run: async (j, f) => {
      await j.page.addInitScript(() => {
        try { localStorage.setItem("quoteai.photosOnWifiOnly", "1"); } catch { /* */ }
        Object.defineProperty(navigator, "connection", { configurable: true, value: { type: "cellular", addEventListener() {}, removeEventListener() {} } });
      });
      await j.open("the job", `/dashboard/jobs/${f.showcase.jobId}`, f.base);
      await j.act("tab → Photos", () => j.page.locator("#main [role='tab'], #main button").filter({ hasText: /^Photos/ }).first().click());
      const status = j.page.locator("[role='status']").filter({ hasText: /waiting for Wi-Fi/ }).first();
      await j.act("pick a photo → held for Wi-Fi", async () => {
        await j.page.locator("#main input[type='file'][multiple]").first().setInputFiles({ name: "site.jpg", mimeType: "image/jpeg", buffer: JPEG });
        await status.waitFor({ timeout: 10_000 });
      });
      await j.act("Send now → sent over data", async () => {
        await status.getByRole("button", { name: "Details" }).click();
        await status.getByRole("button", { name: /^Send now$/ }).last().click();
        await status.waitFor({ state: "detached", timeout: 20_000 });
      });
    },
  },
  {
    id: "clock-in", name: "Crew: clock in", who: "worker",
    run: async (j, f) => {
      if (!f.showcase.workerToken) throw new Error("no worker link in the showcase");
      await j.open("Now", `/t/${f.showcase.workerToken}`, f.base);
      await j.act("Clock in → on the clock", async () => {
        await j.page.getByRole("button", { name: /^Clock in/ }).first().click();
        await j.page.getByRole("button", { name: /^Clock out/ }).first().waitFor({ timeout: 20_000 });
      });
      await j.act("Clock out", async () => {
        await j.page.getByRole("button", { name: /^Clock out/ }).first().click();
        await j.page.getByRole("button", { name: /^Clock in/ }).first().waitFor({ timeout: 20_000 });
      });
    },
  },
  {
    id: "schedule", name: "See the week", who: "owner",
    run: async (j, f) => {
      await j.open("Today", "/dashboard", f.base);
      await j.nav("More → Schedule", async () => {
        await j.page.locator(".tabbar button.tabbar-link").last().click();
        await j.page.getByRole("dialog").locator(`a[href="/dashboard/schedule"]`).click();
      }, /\/dashboard\/schedule/);
    },
  },
  {
    id: "payment", name: "Record a payment", who: "owner",
    run: async (j, f) => {
      await j.open("the invoice", `/dashboard/invoices/${f.showcase.invoiceId}`, f.base);
      await j.act("Record payment → the sheet", async () => {
        await j.page.getByRole("button", { name: /^Record( a)? payment/ }).first().click();
        await j.page.getByRole("dialog").waitFor();
      });
      const dialog = j.page.getByRole("dialog");
      await j.act("Save → recorded", async () => {
        await dialog.getByRole("button", { name: /^(Record|Save)/ }).last().click();
        await dialog.waitFor({ state: "detached", timeout: 20_000 });
      });
    },
  },
  {
    id: "offline", name: "No signal, then back", who: "owner",
    run: async (j, f) => {
      await j.open("the job", `/dashboard/jobs/${f.showcase.jobId}`, f.base);
      const note = j.page.getByTestId("note-input");
      await note.scrollIntoViewIfNeeded();
      await j.page.context().setOffline(true);
      await j.act("offline: write a note → kept", async () => {
        await note.fill("Checked the drywall delivery — offline note");
        await note.press("Enter");
        await j.page.locator("[role='status']").filter({ hasText: /waiting to send|Offline/ }).first().waitFor({ timeout: 10_000 });
      });
      await j.act("signal back → sent", async () => {
        await j.page.context().setOffline(false);
        await j.page.waitForFunction(() => !Array.from(document.querySelectorAll("[role='status']")).some((s) => /waiting to send|Sending|Offline/.test((s as HTMLElement).innerText)), undefined, { timeout: 30_000 });
      });
    },
  },
];
const JOURNEYS = ALL_JOURNEYS.filter((jn) => !JOURNEY_FILTER.length || JOURNEY_FILTER.includes(jn.id));

// ── Serving the build ────────────────────────────────────────────────────────
async function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => res(port));
    });
    s.on("error", rej);
  });
}

let served: ChildProcess | null = null;
async function serveBuild(apiBase: string): Promise<string> {
  if (!existsSync(resolve(WEB, "dist/public/app.html"))) throw new Error("dist/public missing — run `pnpm --filter @workspace/quote-ai build` first (or pass --dev)");
  const port = await freePort();
  served = spawn(process.execPath, [resolve(WEB, "server/serve.mjs")], { env: { ...process.env, PORT: String(port), API_PROXY_TARGET: apiBase }, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise<void>((res, rej) => {
    served!.stdout!.on("data", (d: Buffer) => { if (d.toString().includes("listening")) res(); });
    served!.on("exit", (code) => rej(new Error(`serve.mjs exited with ${code}`)));
    setTimeout(() => rej(new Error("serve.mjs did not start")), 15_000);
  });
  return `http://localhost:${port}`;
}

async function emulate(page: Page, d: Device): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: d.cpu });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: d.net.latency, downloadThroughput: d.net.down, uploadThroughput: d.net.up });
  // Long tasks (> 50 ms on the main thread) — what makes a tap feel late.
  await page.addInitScript(() => {
    (window as unknown as { __long: number }).__long = 0;
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) (window as unknown as { __long: number }).__long += e.duration; }).observe({ type: "longtask", buffered: true });
    } catch { /* not supported */ }
  });
  return cdp;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const mailbox = await captureResend();
void mailbox;
const { installVendorStubs } = await import("./vendorStub.js");
installVendorStubs();
const { startServer, stopServer, createOrg, cleanupAll } = await import("./harness.js");
const { seedShowcase } = await import("./fixtures.js");

let browser: Browser | null = null;
let exitCode = 0;
const t0 = Date.now();
try {
  const apiBase = await startServer();
  const vitePort = Number(args.get("port") ?? 5196);
  const base = DEV ? await startVite(vitePort, apiBase) : await serveBuild(apiBase);
  process.env.QUOTEAI_BASE_URL = base;
  console.log(`[qa-devices] api ${apiBase} · app ${base} (${DEV ? "vite dev" : "production build"})`);

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  browser = await chromium.launch({ channel: process.env.QA_CHROME_PATH ? undefined : "chrome", executablePath: process.env.QA_CHROME_PATH, headless: true });

  const runs: Run[] = [];
  for (const d of DEVICES) {
    // A company per phone: one phone's sent quote or recorded payment is not the next one's starting point.
    const org = await createOrg({ province: "ON", companyName: "Northside Renovations Ltd." });
    const showcase = await seedShowcase(org, { withLogo: true });
    const fixture: Fixture = { base, showcase, ownerEmail: org.email };
    for (const jn of JOURNEYS) {
      // A fresh context per journey: a cold phone (no saved data, no service worker) unless the journey reopens.
      const ctx: BrowserContext = await browser.newContext({
        viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.dpr, isMobile: true, hasTouch: true, userAgent: d.ua,
        locale: "en-CA", timezoneId: "America/Toronto",
        extraHTTPHeaders: jn.who === "owner" ? { authorization: `Bearer ${org.token}` } : {},
        geolocation: { latitude: 43.6532, longitude: -79.3832 }, permissions: ["geolocation"],
      });
      await ctx.addInitScript(() => { try { localStorage.setItem("quoteai-lang", "en"); } catch { /* */ } });
      const page = await ctx.newPage();
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
      page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 200)}`));
      page.on("response", (r) => { if (r.status() >= 500 && r.url().includes("/api/")) failedRequests.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
      await emulate(page, d);
      const j = new JourneyCtx(page, d);
      const dir = resolve(OUT, d.id);
      mkdirSync(dir, { recursive: true });
      const shot = resolve(dir, `${jn.id}.png`);
      const run: Run = { device: d.id, journey: jn.id, ok: true, steps: j.steps, longTasksMs: 0, consoleErrors, failedRequests, screenshot: shot, findings: [] };
      try {
        await jn.run(j, fixture);
      } catch (e) {
        run.ok = false;
        run.error = `${(e as Error).message.split("\n")[0]!.slice(0, 200)} (at ${new URL(page.url()).pathname})`;
      }
      run.longTasksMs = Math.round(await page.evaluate(() => (window as unknown as { __long?: number }).__long ?? 0).catch(() => 0));
      await page.screenshot({ path: shot }).catch(() => {});
      for (const s of run.steps) {
        if (s.overflow) run.findings.push(`overflow after "${s.label}": ${s.overflow}`);
        if (s.focus) run.findings.push(`focus after "${s.label}" landed on ${s.focus}`);
        if (BUDGETS && d.budgets && s.kind === "open" && s.label.startsWith("warm") && s.ms > BUDGET_OPEN_MS) run.findings.push(`"${s.label}" took ${s.ms} ms (budget ${BUDGET_OPEN_MS})`);
        if (BUDGETS && d.budgets && s.kind === "nav" && s.label.endsWith("(again)") && s.ms > BUDGET_NAV_MS) run.findings.push(`"${s.label}" took ${s.ms} ms (budget ${BUDGET_NAV_MS})`);
      }
      if (!run.ok) run.findings.unshift(`failed: ${run.error}`);
      runs.push(run);
      console.log(`${d.id.padEnd(12)} ${jn.id.padEnd(10)} ${run.ok ? "ok  " : "FAIL"} ${run.steps.map((s) => `${s.label} ${s.ms}ms`).join(" · ")}${run.findings.length ? `  ⚠ ${run.findings.join(" | ")}` : ""}`);
      await ctx.close();
    }
  }

  writeReport(runs);
  const bad = runs.filter((r) => r.findings.length).length;
  console.log(`\n[qa-devices] ${runs.length} runs (${DEVICES.length} phones × ${JOURNEYS.length} journeys) in ${Math.round((Date.now() - t0) / 1000)}s — ${bad} with findings → ${resolve(OUT, "report.md")}`);
  if (bad) exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  (served as ChildProcess | null)?.kill();
  if (DEV) await stopVite();
  await cleanupAll().catch((e) => console.error("[qa-devices] cleanup failed", e));
  await stopServer();
}
process.exit(exitCode);

function writeReport(runs: Run[]) {
  writeFileSync(resolve(OUT, "report.json"), JSON.stringify({ devices: DEVICES, runs }, null, 2));
  const lines = [`# Device lab (emulated) — ${new Date().toISOString()}`, "", `Build: ${DEV ? "vite dev server" : "production (dist/public)"}. Chrome emulating each phone (screen, pixel ratio, touch, CPU slowdown, network) — not Safari, not the real hardware.`, ""];
  lines.push("| phone | screen | CPU | network |", "|---|---|---|---|");
  for (const d of DEVICES) lines.push(`| ${d.name} | ${d.width}×${d.height} @${d.dpr} | ${d.cpu}× slower | ${d.net.label} |`);
  lines.push("", "## Journeys", "", `| journey | ${DEVICES.map((d) => d.id).join(" | ")} |`, `|---|${DEVICES.map(() => "---").join("|")}|`);
  for (const jn of JOURNEYS) {
    const cells = DEVICES.map((d) => {
      const r = runs.find((x) => x.device === d.id && x.journey === jn.id);
      if (!r) return "—";
      const total = r.steps.reduce((s, x) => s + x.ms, 0);
      return `${r.ok ? (r.findings.length ? "⚠" : "ok") : "**fail**"} ${(total / 1000).toFixed(1)} s`;
    });
    lines.push(`| ${jn.name} | ${cells.join(" | ")} |`);
  }
  lines.push("", "## Steps (ms from the tap to the next screen ready)", "");
  for (const jn of JOURNEYS) {
    lines.push(`### ${jn.name}`, "", `| step | ${DEVICES.map((d) => d.id).join(" | ")} |`, `|---|${DEVICES.map(() => "---:").join("|")}|`);
    const labels = [...new Set(runs.filter((r) => r.journey === jn.id).flatMap((r) => r.steps.map((s) => s.label)))];
    for (const l of labels) lines.push(`| ${l} | ${DEVICES.map((d) => runs.find((r) => r.device === d.id && r.journey === jn.id)?.steps.find((s) => s.label === l)?.ms ?? "—").join(" | ")} |`);
    lines.push("");
  }
  lines.push("## Long tasks (main thread blocked > 50 ms, summed per journey)", "", `| journey | ${DEVICES.map((d) => d.id).join(" | ")} |`, `|---|${DEVICES.map(() => "---:").join("|")}|`);
  for (const jn of JOURNEYS) lines.push(`| ${jn.id} | ${DEVICES.map((d) => runs.find((r) => r.device === d.id && r.journey === jn.id)?.longTasksMs ?? "—").join(" | ")} |`);
  lines.push("", "## Findings", "");
  for (const r of runs) for (const f of r.findings) lines.push(`- ${r.device} · ${r.journey}: ${f}`);
  lines.push("", "## Console errors / failed /api (5xx)", "");
  for (const r of runs) for (const c of [...new Set([...r.consoleErrors, ...r.failedRequests])]) lines.push(`- ${r.device} · ${r.journey}: ${c}`);
  writeFileSync(resolve(OUT, "report.md"), lines.join("\n") + "\n");
}
