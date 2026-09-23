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
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { screenReaderAudit, modalAudit, SR_BLOCKING, type SrFinding } from "./screen-reader.js";

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve("axe-core/axe.min.js");
const ROOT = resolve(import.meta.dirname, "../../../..");

// Phase 68: the translation dictionary is split (core vs lazy dashboard chunk).
// A key that ends up in the wrong half renders as its raw id ("jobs.tab.costs"),
// so every page's text is scanned for known key ids.
const TRANSLATION_KEYS: Set<string> = new Set(
  ["translations.ts", "translations.dashboard.ts"].flatMap((name) =>
    [...readFileSync(resolve(ROOT, "artifacts/quote-ai/src/i18n", name), "utf8").matchAll(/^\s*"([a-zA-Z0-9_.-]+)":/gm)].map((m) => m[1]!),
  ),
);

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
// Phase 83: the behavioural half (tab order, focus rings, "you are here",
// off-canvas drawers, the modal trap). Static per page, so it runs once per
// route × language at each width that changes the layout answer — the drawer
// checks only exist below the mobile breakpoint.
const RUN_SR = args.get("sr") !== "false";
const SCREENSHOTS = args.get("screenshots") !== "false";
const KEEP = args.has("keep");
const PROVINCE = (args.get("province") ?? "ON") as "ON" | "QC";
const VITE_PORT = Number(args.get("port") ?? 5197);
// A second run alongside a full sweep needs its own port AND its own output dir (the run starts by wiping it).
const OUT = resolve(import.meta.dirname, "../../.qa", args.get("out") ?? "visual");

// ── Routes ───────────────────────────────────────────────────────────────────
/** `session`: who is signed in — nobody, the owner, or (Phase 86b) a foreman member of the same company. */
type Session = "public" | "owner" | "foreman";
type RouteSpec = { path: string; session: Session; name?: string };
function routes(s: import("./fixtures.js").Showcase): RouteSpec[] {
  const pub = (path: string): RouteSpec => ({ path, session: "public" });
  const dash = (path: string): RouteSpec => ({ path, session: "owner" });
  // Phase 86b: a foreman lands on a different /dashboard (the crew's day) and
  // sees the job and team pages with the owner-only parts gone — layouts no
  // owner sweep ever rendered.
  const foreman = (path: string): RouteSpec => ({ path, session: "foreman", name: `${path} (foreman)` });
  const list: RouteSpec[] = [
    pub("/"), pub("/fr"), pub("/whatsapp"), pub("/blog"), pub("/blog/categoria/advice"),
    pub("/blog/how-much-does-it-cost-to-paint-an-apartment-in-canada-2026"),
    pub("/quotes/painter"), pub("/quotes/painter/toronto"), pub("/fr/soumissions/peintre"), pub("/fr/soumissions/peintre/montreal"),
    pub("/chi-siamo"), pub("/contatti"), pub("/privacy-policy"), pub("/terms"), pub("/mappa-sito"),
    // Phase 82: the pages Phases 70/81 added were never in this sweep.
    pub("/pricing"), pub("/fr/tarifs"), pub("/pilot"), pub("/fr/pilote"),
    pub("/provinces/british-columbia"), pub("/provinces/quebec"), pub("/fr/provinces/quebec"),
    pub("/help"), pub("/help/getting-started"),
    pub("/sign-in"), pub("/sign-up"), pub("/this-route-does-not-exist"),
    pub(`/p/${s.longQuoteId}`), pub(`/i/${s.invoiceToken}`),
    ...(s.signToken ? [pub(`/sign/${s.signToken}`)] : []),
    ...(s.workerToken ? [pub(`/t/${s.workerToken}`)] : []),
    ...(s.teamInviteToken ? [pub(`/team-invite/${s.teamInviteToken}`)] : []),
    dash("/onboarding"),
    dash("/dashboard"), dash("/dashboard/new"), dash("/dashboard/quotes"), dash(`/dashboard/quotes/${s.longQuoteId}`), dash(`/dashboard/quotes/${s.quoteId}`),
    dash("/dashboard/analytics"), dash("/dashboard/settings"), dash("/dashboard/settings/account"),
    // Phase 85: the integrations tab is where the calendar connections, the
    // .ics subscriptions and the published feed live — a real page state with
    // its own forms, never swept before.
    dash("/dashboard/settings?tab=integrations"), dash("/dashboard/profile"), dash("/dashboard/billing"),
    dash("/dashboard/catalog"), dash("/dashboard/clients"), ...(s.clientId ? [dash(`/dashboard/clients/${s.clientId}`)] : []),
    dash("/dashboard/leads"), dash("/dashboard/imports"),
    dash("/dashboard/contracts"), dash(`/dashboard/contracts/${s.contractId}`), dash(`/dashboard/contracts/${s.pendingContractId}`),
    dash("/dashboard/invoices"), dash(`/dashboard/invoices/${s.invoiceId}`),
    dash("/dashboard/jobs"), dash(`/dashboard/jobs/${s.jobId}`), dash(`/dashboard/jobs/${s.jobId}/setup`),
    dash("/dashboard/schedule"), dash("/dashboard/assistant"), dash("/dashboard/team"), dash("/dashboard/documents"), dash("/dashboard/archive"), dash("/dashboard/notifications"),
    // Phase 87: every tab of the Compliance page is its own page state.
    dash("/dashboard/compliance"), dash("/dashboard/compliance?tab=salesTax"), dash("/dashboard/compliance?tab=t5018"), dash("/dashboard/compliance?tab=reminders"),
    // Phase 88: the three tabs of Books.
    dash("/dashboard/books"), dash("/dashboard/books?tab=bank"), dash("/dashboard/books?tab=claims"),
    // Phase 89: the three tabs of Pay.
    dash("/dashboard/pay"), dash("/dashboard/pay?tab=jobs"), dash("/dashboard/pay?tab=settings"),
    foreman("/dashboard"), foreman("/dashboard/jobs"), foreman(`/dashboard/jobs/${s.jobId}`), foreman("/dashboard/schedule"), foreman("/dashboard/team"), foreman("/dashboard/team?tab=time"), foreman("/dashboard/team?tab=equipment"), foreman("/dashboard/books"), foreman("/dashboard/pay"),
  ];
  // `--routes=jobs,pricing` is a substring match; `--routes==/,=/dashboard`
  // pins an exact path (there is no substring that means the homepage alone).
  return list.filter((r) => ROUTE_FILTER.length === 0 || ROUTE_FILTER.some((f) => (f.startsWith("=") ? r.path === f.slice(1) : r.path.includes(f))));
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
  lang: string; width: number; path: string; session: Session;
  title: string; screenshot: string;
  overflow: { scrollWidth: number; clientWidth: number; offenders: string[] } | null;
  gutter: { clientWidth: number; offenders: string[] } | null;
  axe: Array<{ id: string; impact: string; help: string; count: number; targets: string[]; detail: string[] }>;
  sr: SrFinding[];
  consoleErrors: string[]; failedRequests: string[]; boundary: string | null; rawKeys: string[]; error?: string;
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
      // Phase 82: an element inside a deliberate sideways scroller (a wide
      // comparison table in its .cmp-wrap) sticks out of the viewport without
      // widening the page — and, being the widest thing on the page, it used
      // to fill the whole offender list and hide whatever actually did.
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== "visible" && p.getBoundingClientRect().right <= cw + 1) { clipped = true; break; }
      }
      if (clipped) continue;
      const id = el.id ? `#${el.id}` : "";
      const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
      offenders.push([r.right - cw, `${el.tagName.toLowerCase()}${id}${cls}`]);
    }
    offenders.sort((a, b) => b[0] - a[0]);
    return { scrollWidth: doc.scrollWidth, clientWidth: cw, offenders: offenders.slice(0, 4).map(([px, sel]) => `${sel} (+${Math.round(px)}px)`) };
  });
}

// Phase 82 — the phone gutter. `.wrap` gives every public page a
// clamp(20px, 4vw, 40px) side gutter, but any later rule using the `padding`
// shorthand with a `0` horizontal component on the same element silently wins
// and the copy ends up flush against the glass. Nothing else here sees it: the
// page does not overflow, axe does not care, and a full-page screenshot at
// 375 px looks plausible until you hold a phone. So below GUTTER_WIDTH every
// element with its own visible text must keep GUTTER_MIN px from both edges.
// Opt out with `data-bleed` on the element or an ancestor (marquees and other
// deliberately full-bleed strips).
const GUTTER_WIDTH = 640;
const GUTTER_MIN = 12;

async function gutter(page: Page, width: number): Promise<PageResult["gutter"]> {
  if (width > GUTTER_WIDTH) return null;
  return page.evaluate((min) => {
    const cw = document.documentElement.clientWidth;
    const offenders: Array<[number, string]> = [];
    const range = document.createRange();
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? "").join("").trim();
      if (!own) continue;
      if (el.closest("[data-bleed]")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.position === "fixed" || Number(cs.opacity) === 0) continue;
      // Measure the glyphs, not the box: a full-bleed band whose text is inset
      // by its own padding is exactly what we want, and the box says otherwise.
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType !== Node.TEXT_NODE || !(n.textContent ?? "").trim()) continue;
        range.selectNodeContents(n);
        for (const rect of Array.from(range.getClientRects())) {
          if (rect.width === 0 || rect.height === 0) continue;
          left = Math.min(left, rect.left);
          right = Math.max(right, rect.right);
          top = Math.min(top, rect.top + window.scrollY);
        }
      }
      if (left === Infinity) continue;
      if (top < -1000) continue; // recharts' hidden measurement span and friends
      // …and only where it is actually painted: the element itself or an
      // ancestor that clips or scrolls sideways (a `truncate` row, a wide
      // table, a chip rail) hides the overhang, so intersect with every such
      // box — starting with the element's own, which is what puts the ellipsis
      // on a long job name.
      for (let p: HTMLElement | null = el; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflowX === "visible") continue;
        const pr = p.getBoundingClientRect();
        left = Math.max(left, pr.left);
        right = Math.min(right, pr.right);
      }
      if (right - left <= 0) continue; // clipped away entirely
      if (right <= 0 || left >= cw) continue; // off-canvas drawer, closed menu
      const worst = Math.min(left, cw - right);
      if (worst >= min) continue;
      const id = el.id ? `#${el.id}` : "";
      const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
      offenders.push([worst, `${el.tagName.toLowerCase()}${id}${cls} ${Math.round(worst)}px — ${JSON.stringify(own.slice(0, 40))}`]);
    }
    if (!offenders.length) return null;
    offenders.sort((a, b) => a[0] - b[0]);
    return { clientWidth: cw, offenders: offenders.slice(0, 5).map(([, sel]) => sel) };
  }, GUTTER_MIN);
}

// [route, trigger selector, label] — the overlays a keyboard user meets.
const MODAL_TRIGGERS: Array<[string, string, string]> = [
  ["/", ".menu-btn", "public mobile menu"],
  ["/dashboard", ".tb-menu", "dashboard mobile sidebar"],
];

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
  const file = resolve(dir, `${slug(r.name ?? r.path)}.png`);
  const result: PageResult = { lang, width, path: r.name ?? r.path, session: r.session, title: "", screenshot: file, overflow: null, gutter: null, axe: [], sr: [], consoleErrors, failedRequests, boundary: null, rawKeys: [] };
  try {
    await page.goto(`${base}${r.path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await settle(page);
    result.title = await page.title();
    result.boundary = await page.evaluate(() => {
      const t = document.body.innerText;
      const m = /Something went wrong|Une erreur est survenue|Can't reach QuoteAI|Impossible de joindre/i.exec(t);
      return m ? m[0] : null;
    });
    const tokens: string[] = await page.evaluate(() => Array.from(new Set((document.body.innerText.match(/\b[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_-]+){1,6}\b/g) ?? []))));
    result.rawKeys = tokens.filter((t) => TRANSLATION_KEYS.has(t));
    result.overflow = await overflow(page);
    result.gutter = await gutter(page, width);
    if (SCREENSHOTS) await page.screenshot({ path: file, fullPage: true });
    if (RUN_AXE) result.axe = await runAxe(page);
    if (RUN_SR) {
      result.sr = await screenReaderAudit(page, { width });
      // The two off-canvas menus are the same component on every page of their
      // half of the app, and the check clicks — so ask once per half, on the
      // narrow viewport where the drawer exists at all.
      if (width <= GUTTER_WIDTH) {
        for (const [route, trigger, label] of MODAL_TRIGGERS) {
          if (r.path !== route) continue;
          result.sr.push(...(await modalAudit(page, trigger, label)));
        }
      }
    }
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

  lines.push("## Summary", "", "| route | overflow (lang@width) | gutter | axe serious/critical | screen reader | console errors | failed /api | boundary/error |", "|---|---|---|---|---|---|---|---|");
  for (const [path, rs] of byPath) {
    const ov = rs.filter((r) => r.overflow).map((r) => `${r.lang}@${r.width}`).join(", ") || "—";
    const gu = rs.filter((r) => r.gutter).map((r) => `${r.lang}@${r.width}`).join(", ") || "—";
    const ax = rs.reduce((s, r) => s + sev(r), 0);
    const ce = rs.reduce((s, r) => s + r.consoleErrors.length, 0);
    const fr = rs.reduce((s, r) => s + r.failedRequests.length, 0);
    const be = rs.filter((r) => r.boundary || r.error).map((r) => `${r.lang}@${r.width}: ${r.boundary ?? r.error}`).join("; ") || "—";
    const srRules = [...new Set(rs.flatMap((r) => r.sr.map((f) => f.rule)))];
    lines.push(`| \`${path}\` | ${ov} | ${gu} | ${ax || "—"} | ${srRules.join(", ") || "—"} | ${ce || "—"} | ${fr || "—"} | ${be} |`);
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

  lines.push("## Screen-reader / keyboard findings, by rule", "");
  const bySrRule = new Map<string, string[]>();
  for (const r of results) for (const f of r.sr) {
    bySrRule.set(f.rule, [...(bySrRule.get(f.rule) ?? []), `${r.path} ${r.lang}@${r.width} — \`${f.target}\`: ${f.detail}`]);
  }
  for (const [rule, where] of [...bySrRule].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`### ${rule} — ${SR_BLOCKING.has(rule as SrFinding["rule"]) ? "blocking" : "report"} — ${where.length} occurrence(s)`, "");
    for (const w of where.slice(0, 30)) lines.push(`- ${w}`);
    if (where.length > 30) lines.push(`- … ${where.length - 30} more`);
    lines.push("");
  }

  lines.push("## Overflow details", "");
  for (const r of results) if (r.overflow) lines.push(`- \`${r.path}\` ${r.lang}@${r.width}: ${r.overflow.scrollWidth}/${r.overflow.clientWidth} — ${r.overflow.offenders.join(", ")}`);
  lines.push("", `## Phone gutter (< ${GUTTER_MIN}px from an edge at ≤ ${GUTTER_WIDTH}px)`, "");
  for (const r of results) if (r.gutter) lines.push(`- \`${r.path}\` ${r.lang}@${r.width}: ${r.gutter.offenders.join(" · ")}`);
  lines.push("", "## Raw translation keys on the page", "");
  for (const r of results) if (r.rawKeys.length) lines.push(`- \`${r.path}\` ${r.lang}@${r.width}: ${r.rawKeys.join(", ")}`);
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
const { startServer, stopServer, createOrg, createUser, cleanupAll } = await import("./harness.js");
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
  // Phase 86b: a foreman member of the showcase company (a second invite — the
  // seeded one must stay unaccepted for the /team-invite page).
  let foremanToken: string | null = null;
  const foremanEmail = `foreman-sweep-${org.userId}@example.invalid`;
  const foremanInvite = await org.api("/api/team/members/invite", { body: { email: foremanEmail, role: "foreman", send: false } });
  if (foremanInvite.status === 201) {
    const foremanUser = await createUser({ email: foremanEmail, name: "Jordan Foreman" });
    const accepted = await foremanUser.api(`/api/team/invite/${String(foremanInvite.body.url).split("/team-invite/")[1]}/accept`, { method: "POST" });
    if (accepted.status === 200) foremanToken = foremanUser.token;
  }
  if (!foremanToken) console.warn("[qa-visual] could not set up the foreman session — its routes are skipped");
  console.log(`[qa-visual] showcase seeded for ${org.email}:`, { ...showcase, invoiceToken: "…", signToken: showcase.signToken ? "…" : null, workerToken: showcase.workerToken ? "…" : null, teamInviteToken: showcase.teamInviteToken ? "…" : null });

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  browser = await chromium.launch({ channel: process.env.QA_CHROME_PATH ? undefined : "chrome", executablePath: process.env.QA_CHROME_PATH, headless: true });
  const results: PageResult[] = [];
  const all = routes(showcase);
  for (const lang of LANGS) {
    const widths = lang === "fr" ? WIDTHS_FR : WIDTHS_EN;
    for (const session of ["public", "owner", "foreman"] as const) {
      const rs = all.filter((r) => r.session === session);
      const bearer = session === "owner" ? org.token : session === "foreman" ? foremanToken : null;
      if (!rs.length || (session !== "public" && !bearer)) continue;
      const ctx = await browser.newContext({
        locale: lang === "fr" ? "fr-CA" : "en-CA",
        extraHTTPHeaders: bearer ? { authorization: `Bearer ${bearer}` } : {},
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });
      await ctx.addInitScript((l: string) => { try { localStorage.setItem("quoteai-lang", l); } catch {} }, lang);
      for (const width of widths) {
        for (const r of rs) {
          const res = await checkPage(ctx, frontend, r, lang, width);
          results.push(res);
          const flags = [res.overflow && "OVERFLOW", res.gutter && `GUTTER:${res.gutter.offenders.length}`, res.sr.length && `SR:${[...new Set(res.sr.map((f) => f.rule))].join(",")}`, res.axe.some((a) => a.impact !== "moderate") && `AXE:${res.axe.filter((a) => a.impact !== "moderate").map((a) => a.id).join(",")}`, res.consoleErrors.length && `CONSOLE:${res.consoleErrors.length}`, res.failedRequests.length && `API:${res.failedRequests.length}`, res.boundary && `BOUNDARY:${res.boundary}`, res.rawKeys.length && `RAWKEY:${res.rawKeys.join(",")}`, res.error && `ERROR:${res.error}`].filter(Boolean);
          console.log(`${lang}@${String(width).padStart(4)} ${(r.name ?? r.path).padEnd(60)} ${flags.join(" ") || "ok"}`);
        }
      }
      await ctx.close();
    }
  }
  writeReport(results, { langs: LANGS, widthsEn: WIDTHS_EN, widthsFr: WIDTHS_FR, province: PROVINCE, routes: all.length, pages: results.length, seconds: Math.round((Date.now() - t0) / 1000) });
  const serious = results.reduce((s, r) => s + r.axe.filter((a) => a.impact !== "moderate").reduce((x, a) => x + a.count, 0), 0);
  const overflows = results.filter((r) => r.overflow).length;
  const gutters = results.filter((r) => r.gutter).length;
  const rawKeyPages = results.filter((r) => r.rawKeys.length).length;
  const srBlocking = results.reduce((s, r) => s + r.sr.filter((f) => SR_BLOCKING.has(f.rule)).length, 0);
  const srOther = results.reduce((s, r) => s + r.sr.length, 0) - srBlocking;
  console.log(`\n[qa-visual] ${results.length} pages in ${Math.round((Date.now() - t0) / 1000)}s — overflow on ${overflows}, gutter on ${gutters}, axe serious/critical nodes ${serious}, screen-reader ${srBlocking} blocking + ${srOther} to read, raw i18n keys on ${rawKeyPages} → ${resolve(OUT, "report.md")}`);
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
