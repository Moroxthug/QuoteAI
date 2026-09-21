// Phase 67 — visual + accessibility sweep of every route.
//
// Boots the real API (harness, ephemeral port, .env.staging), spawns the
// quote-ai Vite dev server proxied at it, seeds a showcase account
// (fixtures.ts) and drives the installed Chrome through playwright-core.
// For every route × language × viewport width it records:
//   • a full-page screenshot        → .qa/visual/<lang>/<width>/<route>.png
//   • horizontal overflow           (scrollWidth > clientWidth, with the widest offenders)
//   • axe-core violations           (serious/critical are the exit criterion; moderate listed)
//   • console errors + failed /api requests + React error-boundary text
// and writes .qa/visual/report.{json,md}. Nothing leaves the machine: email
// is captured at the fetch boundary, other vendors are stubbed, AI falls back.
//
//   pnpm --filter @workspace/api-server qa:visual                  # EN at 5 widths, FR at 1280/375
//   pnpm --filter @workspace/api-server qa:visual -- --lang=fr --widths=375 --routes=quotes,jobs
//   pnpm --filter @workspace/api-server qa:visual -- --keep        # leave the account + servers up and print the token
//   pnpm --filter @workspace/api-server qa:visual -- --screenshots=false --widths=1280,375   # axe-only pass
//   E2E_NO_PURGE=1 pnpm … qa:visual -- --port=5198 --out=visual-quick --routes=…            # alongside a running sweep
//
// Requires Google Chrome (playwright-core `channel: "chrome"`; set
// QA_CHROME_PATH to point at another Chromium build).

import { bootstrapQaEnv, captureResend } from "./qaEnv.js";

process.env.LOG_LEVEL ??= "warn";
bootstrapQaEnv("qa-visual");
process.env.NODE_ENV = "development";

import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve("axe-core/axe.min.js");
const ROOT = resolve(import.meta.dirname, "../../../..");

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args.set(m[1]!, m[2] ?? "true");
}
const LANGS = (args.get("lang") ?? "en,fr").split(",").filter(Boolean) as Array<"en" | "fr">;
const WIDTHS_EN = (args.get("widths") ?? "1280,980,768,640,375").split(",").map(Number);
const WIDTHS_FR = args.has("widths") ? WIDTHS_EN : [1280, 375];
const ROUTE_FILTER = (args.get("routes") ?? "").split(",").filter(Boolean);
const RUN_AXE = args.get("axe") !== "false";
const SCREENSHOTS = args.get("screenshots") !== "false";
const KEEP = args.has("keep");
const PROVINCE = (args.get("province") ?? "ON") as "ON" | "QC";
const VITE_PORT = Number(args.get("port") ?? 5197);
// A second run alongside a full sweep needs its own port AND its own output dir (the run starts by wiping it).
const OUT = resolve(import.meta.dirname, "../../.qa", args.get("out") ?? "visual");

// ── Routes ───────────────────────────────────────────────────────────────────
type RouteSpec = { path: string; auth: boolean; name?: string };
function routes(s: import("./fixtures.js").Showcase): RouteSpec[] {
  const pub = (path: string): RouteSpec => ({ path, auth: false });
  const dash = (path: string): RouteSpec => ({ path, auth: true });
  const list: RouteSpec[] = [
    pub("/"), pub("/fr"), pub("/whatsapp"), pub("/blog"), pub("/blog/categoria/advice"),
    pub("/blog/how-much-does-it-cost-to-paint-an-apartment-in-canada-2026"),
    pub("/quotes/painter"), pub("/quotes/painter/toronto"), pub("/fr/soumissions/peintre"), pub("/fr/soumissions/peintre/montreal"),
    pub("/chi-siamo"), pub("/contatti"), pub("/privacy-policy"), pub("/terms"), pub("/mappa-sito"),
    pub("/sign-in"), pub("/sign-up"), pub("/this-route-does-not-exist"),
    pub(`/p/${s.longQuoteId}`), pub(`/i/${s.invoiceToken}`),
    ...(s.signToken ? [pub(`/sign/${s.signToken}`)] : []),
    ...(s.workerToken ? [pub(`/t/${s.workerToken}`)] : []),
    ...(s.teamInviteToken ? [pub(`/team-invite/${s.teamInviteToken}`)] : []),
    dash("/onboarding"),
    dash("/dashboard"), dash("/dashboard/new"), dash("/dashboard/quotes"), dash(`/dashboard/quotes/${s.longQuoteId}`), dash(`/dashboard/quotes/${s.quoteId}`),
    dash("/dashboard/analytics"), dash("/dashboard/settings"), dash("/dashboard/settings/account"), dash("/dashboard/profile"), dash("/dashboard/billing"),
    dash("/dashboard/catalog"), dash("/dashboard/clients"), ...(s.clientId ? [dash(`/dashboard/clients/${s.clientId}`)] : []),
    dash("/dashboard/leads"), dash("/dashboard/imports"),
    dash("/dashboard/contracts"), dash(`/dashboard/contracts/${s.contractId}`), dash(`/dashboard/contracts/${s.pendingContractId}`),
    dash("/dashboard/invoices"), dash(`/dashboard/invoices/${s.invoiceId}`),
    dash("/dashboard/jobs"), dash(`/dashboard/jobs/${s.jobId}`), dash(`/dashboard/jobs/${s.jobId}/setup`),
    dash("/dashboard/assistant"), dash("/dashboard/team"), dash("/dashboard/documents"), dash("/dashboard/archive"), dash("/dashboard/notifications"),
  ];
  return list.filter((r) => ROUTE_FILTER.length === 0 || ROUTE_FILTER.some((f) => r.path.includes(f)));
}

const slug = (path: string) => (path === "/" ? "home" : path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "").slice(0, 60)) || "home";

// ── Vite ─────────────────────────────────────────────────────────────────────
let vite: ChildProcess | null = null;
async function startVite(apiBase: string): Promise<string> {
  const url = `http://localhost:${VITE_PORT}`;
  // A stale server from an aborted run would answer the health check below
  // and then vanish under us — refuse to share the port.
  const busy = await fetch(url, { signal: AbortSignal.timeout(1500) }).then(() => true, () => false);
  if (busy) throw new Error(`port ${VITE_PORT} is already in use (a previous run's vite? pass --port=<n>)`);
  vite = spawn("pnpm", ["--filter", "@workspace/quote-ai", "exec", "vite", "--port", String(VITE_PORT), "--strictPort", "--clearScreen", "false"], {
    cwd: ROOT,
    env: { ...process.env, API_PROXY_TARGET: apiBase, PORT: String(VITE_PORT), BROWSER: "none" },
    shell: process.platform === "win32", // pnpm is a .cmd here and node refuses those without a shell
    stdio: ["ignore", "pipe", "pipe"],
  });
  vite.stderr?.on("data", (d) => process.stderr.write(`[vite] ${d}`));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return url;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`vite did not come up on ${url}`);
}
async function stopVite(): Promise<void> {
  if (!vite?.pid) return;
  const child = vite;
  vite = null;
  if (process.platform === "win32") {
    // `shell: true` means the pid is cmd.exe → pnpm → node; /T takes the tree.
    await new Promise<void>((done) => spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }).on("exit", () => done()));
  } else {
    child.kill("SIGTERM");
    await new Promise<void>((done) => child.on("exit", () => done()));
  }
}

// ── Per-page checks ──────────────────────────────────────────────────────────
type AxeNode = { target: string[]; html: string; any: Array<{ data?: Record<string, unknown> }> };
type AxeViolation = { id: string; impact: "minor" | "moderate" | "serious" | "critical" | null; help: string; helpUrl: string; nodes: AxeNode[] };
type PageResult = {
  lang: string; width: number; path: string; auth: boolean;
  title: string; screenshot: string;
  overflow: { scrollWidth: number; clientWidth: number; offenders: string[] } | null;
  axe: Array<{ id: string; impact: string; help: string; count: number; targets: string[]; detail: string[] }>;
  consoleErrors: string[]; failedRequests: string[]; boundary: string | null; error?: string;
};

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  // Lazy routes + query loaders: wait for skeletons / spinners to clear.
  await page.waitForFunction(() => !document.querySelector(".skeleton, .animate-pulse, .animate-spin, [aria-busy='true']"), null, { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth + 1) return null;
    const cw = doc.clientWidth;
    const offenders: Array<[number, string]> = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= cw + 1) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.visibility === "hidden") continue;
      const id = el.id ? `#${el.id}` : "";
      const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
      offenders.push([r.right - cw, `${el.tagName.toLowerCase()}${id}${cls}`]);
    }
    offenders.sort((a, b) => b[0] - a[0]);
    return { scrollWidth: doc.scrollWidth, clientWidth: cw, offenders: offenders.slice(0, 4).map(([px, sel]) => `${sel} (+${Math.round(px)}px)`) };
  });
}

async function runAxe(page: Page): Promise<PageResult["axe"]> {
  await page.addScriptTag({ path: AXE_PATH });
  const res = await page.evaluate(async () => {
    const axe = (window as any).axe;
    const r = await axe.run(document, { resultTypes: ["violations"], rules: { "region": { enabled: false } } });
    return r.violations as AxeViolation[];
  });
  return res
    .filter((v) => v.impact === "moderate" || v.impact === "serious" || v.impact === "critical")
    .map((v) => ({
      id: v.id, impact: v.impact!, help: v.help, count: v.nodes.length,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
      // color-contrast carries fg/bg/ratio; other rules a snippet of the element.
      detail: v.nodes.slice(0, 3).map((n) => {
        const d = n.any?.[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number; expectedContrastRatio?: string } | undefined;
        return d?.fgColor ? `${d.fgColor} on ${d.bgColor} = ${d.contrastRatio} (need ${d.expectedContrastRatio})` : n.html.slice(0, 120);
      }),
    }));
}

async function checkPage(ctx: BrowserContext, base: string, r: RouteSpec, lang: string, width: number): Promise<PageResult> {
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on("response", (res) => { if (res.status() >= 400 && res.url().includes("/api/")) failedRequests.push(`${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}`); });
  await page.setViewportSize({ width, height: width <= 640 ? 812 : 800 });
  const dir = resolve(OUT, lang, String(width));
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${slug(r.path)}.png`);
  const result: PageResult = { lang, width, path: r.path, auth: r.auth, title: "", screenshot: file, overflow: null, axe: [], consoleErrors, failedRequests, boundary: null };
  try {
    await page.goto(`${base}${r.path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await settle(page);
    result.title = await page.title();
    result.boundary = await page.evaluate(() => {
      const t = document.body.innerText;
      const m = /Something went wrong|Une erreur est survenue|Can't reach QuoteAI|Impossible de joindre/i.exec(t);
      return m ? m[0] : null;
    });
    result.overflow = await overflow(page);
    if (SCREENSHOTS) await page.screenshot({ path: file, fullPage: true });
    if (RUN_AXE) result.axe = await runAxe(page);
  } catch (e) {
    result.error = (e as Error).message.slice(0, 300);
  } finally {
    await page.close();
  }
  return result;
}

// ── Report ───────────────────────────────────────────────────────────────────
function writeReport(results: PageResult[], meta: Record<string, unknown>) {
  writeFileSync(resolve(OUT, "report.json"), JSON.stringify({ meta, results }, null, 2));
  const lines: string[] = [`# Visual + a11y sweep — ${new Date().toISOString()}`, "", "```json", JSON.stringify(meta), "```", ""];
  const sev = (r: PageResult) => r.axe.filter((a) => a.impact === "serious" || a.impact === "critical").reduce((s, a) => s + a.count, 0);
  const byPath = new Map<string, PageResult[]>();
  for (const r of results) byPath.set(r.path, [...(byPath.get(r.path) ?? []), r]);

  lines.push("## Summary", "", "| route | overflow (lang@width) | axe serious/critical | console errors | failed /api | boundary/error |", "|---|---|---|---|---|---|");
  for (const [path, rs] of byPath) {
    const ov = rs.filter((r) => r.overflow).map((r) => `${r.lang}@${r.width}`).join(", ") || "—";
    const ax = rs.reduce((s, r) => s + sev(r), 0);
    const ce = rs.reduce((s, r) => s + r.consoleErrors.length, 0);
    const fr = rs.reduce((s, r) => s + r.failedRequests.length, 0);
    const be = rs.filter((r) => r.boundary || r.error).map((r) => `${r.lang}@${r.width}: ${r.boundary ?? r.error}`).join("; ") || "—";
    lines.push(`| \`${path}\` | ${ov} | ${ax || "—"} | ${ce || "—"} | ${fr || "—"} | ${be} |`);
  }

  lines.push("", "## axe violations (moderate+), by rule", "");
  const byRule = new Map<string, { impact: string; help: string; where: string[] }>();
  for (const r of results) for (const a of r.axe) {
    const e = byRule.get(a.id) ?? { impact: a.impact, help: a.help, where: [] };
    e.where.push(`${r.path} ${r.lang}@${r.width} ×${a.count}: ${a.targets.map((t, i) => `${t} — ${a.detail[i] ?? ""}`).join(" | ")}`);
    byRule.set(a.id, e);
  }
  for (const [id, e] of [...byRule].sort((a, b) => b[1].where.length - a[1].where.length)) {
    lines.push(`### ${id} — ${e.impact} — ${e.help}`, "");
    for (const w of e.where.slice(0, 40)) lines.push(`- ${w}`);
    if (e.where.length > 40) lines.push(`- … ${e.where.length - 40} more`);
    lines.push("");
  }

  lines.push("## Overflow details", "");
  for (const r of results) if (r.overflow) lines.push(`- \`${r.path}\` ${r.lang}@${r.width}: ${r.overflow.scrollWidth}/${r.overflow.clientWidth} — ${r.overflow.offenders.join(", ")}`);
  lines.push("", "## Console errors / failed requests", "");
  for (const r of results) {
    if (!r.consoleErrors.length && !r.failedRequests.length) continue;
    lines.push(`- \`${r.path}\` ${r.lang}@${r.width}:`);
    for (const c of [...new Set(r.consoleErrors)]) lines.push(`  - console: ${c}`);
    for (const f of [...new Set(r.failedRequests)]) lines.push(`  - request: ${f}`);
  }
  writeFileSync(resolve(OUT, "report.md"), lines.join("\n") + "\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────
const mailbox = await captureResend();
const { installVendorStubs } = await import("./vendorStub.js");
installVendorStubs();
const { startServer, stopServer, createOrg, cleanupAll } = await import("./harness.js");
const { seedShowcase, setSignTokenCapture } = await import("./fixtures.js");
setSignTokenCapture(() => {
  for (let i = mailbox.length - 1; i >= 0; i--) {
    const l = mailbox[i]!.links.find((x) => x.includes("/sign/"));
    if (l) return l.split("/sign/")[1]!.split(/[/?#]/)[0]!;
  }
  return null;
});

let browser: Browser | null = null;
const t0 = Date.now();
try {
  const apiBase = await startServer();
  process.env.QUOTEAI_BASE_URL = `http://localhost:${VITE_PORT}`;
  const frontend = await startVite(apiBase);
  console.log(`[qa-visual] api ${apiBase} · frontend ${frontend}`);

  const org = await createOrg({ province: PROVINCE, companyName: PROVINCE === "QC" ? "Rénovations Tremblay inc." : "Northside Renovations Ltd." });
  const showcase = await seedShowcase(org, { withLogo: true });
  console.log(`[qa-visual] showcase seeded for ${org.email}:`, { ...showcase, invoiceToken: "…", signToken: showcase.signToken ? "…" : null, workerToken: showcase.workerToken ? "…" : null, teamInviteToken: showcase.teamInviteToken ? "…" : null });

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  browser = await chromium.launch({ channel: process.env.QA_CHROME_PATH ? undefined : "chrome", executablePath: process.env.QA_CHROME_PATH, headless: true });
  const results: PageResult[] = [];
  const all = routes(showcase);
  for (const lang of LANGS) {
    const widths = lang === "fr" ? WIDTHS_FR : WIDTHS_EN;
    for (const auth of [false, true]) {
      const rs = all.filter((r) => r.auth === auth);
      if (!rs.length) continue;
      const ctx = await browser.newContext({
        locale: lang === "fr" ? "fr-CA" : "en-CA",
        extraHTTPHeaders: auth ? { authorization: `Bearer ${org.token}` } : {},
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });
      await ctx.addInitScript((l: string) => { try { localStorage.setItem("quoteai-lang", l); } catch {} }, lang);
      for (const width of widths) {
        for (const r of rs) {
          const res = await checkPage(ctx, frontend, r, lang, width);
          results.push(res);
          const flags = [res.overflow && "OVERFLOW", res.axe.some((a) => a.impact !== "moderate") && `AXE:${res.axe.filter((a) => a.impact !== "moderate").map((a) => a.id).join(",")}`, res.consoleErrors.length && `CONSOLE:${res.consoleErrors.length}`, res.failedRequests.length && `API:${res.failedRequests.length}`, res.boundary && `BOUNDARY:${res.boundary}`, res.error && `ERROR:${res.error}`].filter(Boolean);
          console.log(`${lang}@${String(width).padStart(4)} ${r.path.padEnd(60)} ${flags.join(" ") || "ok"}`);
        }
      }
      await ctx.close();
    }
  }
  writeReport(results, { langs: LANGS, widthsEn: WIDTHS_EN, widthsFr: WIDTHS_FR, province: PROVINCE, routes: all.length, pages: results.length, seconds: Math.round((Date.now() - t0) / 1000) });
  const serious = results.reduce((s, r) => s + r.axe.filter((a) => a.impact !== "moderate").reduce((x, a) => x + a.count, 0), 0);
  const overflows = results.filter((r) => r.overflow).length;
  console.log(`\n[qa-visual] ${results.length} pages in ${Math.round((Date.now() - t0) / 1000)}s — overflow on ${overflows}, axe serious/critical nodes ${serious} → ${resolve(OUT, "report.md")}`);
  if (KEEP) {
    console.log(`[qa-visual] --keep: account ${org.email} left in place; bearer ${org.token}; frontend ${frontend} (API ${apiBase}). Ctrl-C to stop.`);
    await new Promise(() => {});
  }
} finally {
  await browser?.close().catch(() => {});
  if (!KEEP) {
    await cleanupAll().catch((e) => console.error("[qa-visual] cleanup failed", e));
    await stopVite();
    await stopServer();
  }
}
process.exit(0);
