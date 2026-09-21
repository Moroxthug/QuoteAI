// Phase 68 — Lighthouse (mobile) over the production build.
//
//   pnpm --filter @workspace/quote-ai build
//   pnpm --filter @workspace/quote-ai qa:lighthouse                 # default URL set, serves dist/public itself
//   pnpm --filter @workspace/quote-ai qa:lighthouse -- --urls=/,/fr/ --runs=3
//   pnpm --filter @workspace/quote-ai qa:lighthouse -- --api=http://127.0.0.1:5123 --urls=/p/<id>/
//   pnpm --filter @workspace/quote-ai qa:lighthouse -- --base=https://quoteai.ca
//
// Serves dist/public through server/serve.mjs (same headers/compression as
// the old Node host; Vercel's CDN is only faster), optionally proxying /api
// to a running API (`--api`, for the public quote page — pair it with
// `pnpm --filter @workspace/api-server qa:visual -- --keep`). Runs Lighthouse
// with its default mobile profile (Moto G Power, slow 4G, 4× CPU) `--runs`
// times per URL (default 3) and reports the median run. Writes
// .qa/lighthouse/report.{md,json} plus one HTML report per URL.
// Exit 1 when any median is under the Phase 68 targets: Performance ≥ 90,
// SEO = 100, CLS ≤ 0.1 (the targets are the plan's, not Lighthouse's).
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import lighthouse, { type Flags, type RunnerResult } from "lighthouse";
import { launch } from "chrome-launcher";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, ".qa/lighthouse");

const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args.set(m[1]!, m[2] ?? "true");
}
const RUNS = Number(args.get("runs") ?? 3);
const API = args.get("api");
const BASE = args.get("base");
const DEFAULT_URLS = [
  "/",
  "/fr/",
  "/whatsapp/",
  "/blog/how-much-does-it-cost-to-paint-an-apartment-in-canada-2026/",
  "/quotes/painter/",
  "/quotes/painter/toronto/",
  "/fr/soumissions/peintre/montreal/",
];
// Paths may be given without the leading slash (Git Bash rewrites "/x" into a Windows path).
const URLS = (args.get("urls") ?? DEFAULT_URLS.join(",")).split(",").filter(Boolean).map((p) => (p === "home" ? "/" : p.startsWith("/") ? p : `/${p}`));
const TARGETS = { performance: 90, seo: 100, cls: 0.1 };

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

async function startStatic(): Promise<{ base: string; stop: () => void }> {
  if (!existsSync(resolve(ROOT, "dist/public/index.html"))) throw new Error("dist/public missing — run `pnpm --filter @workspace/quote-ai build` first");
  const port = await freePort();
  const child: ChildProcess = spawn(process.execPath, [resolve(ROOT, "server/serve.mjs")], {
    env: { ...process.env, PORT: String(port), ...(API ? { API_PROXY_TARGET: API } : {}) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise<void>((res, rej) => {
    child.stdout!.on("data", (d: Buffer) => { if (d.toString().includes("listening")) res(); });
    child.on("exit", (code) => rej(new Error(`serve.mjs exited with ${code}`)));
    setTimeout(() => rej(new Error("serve.mjs did not start")), 10_000);
  });
  return { base: `http://127.0.0.1:${port}`, stop: () => child.kill() };
}

type Row = {
  url: string;
  performance: number; accessibility: number; bestPractices: number; seo: number;
  fcp: number; lcp: number; tbt: number; cls: number; si: number; ttfb: number;
  transferKb: number; scriptKb: number;
  failing: string[];
};

function summarize(url: string, r: RunnerResult["lhr"]): Row {
  const cat = (k: string) => Math.round((r.categories[k]?.score ?? 0) * 100);
  const num = (k: string) => Number(r.audits[k]?.numericValue ?? 0);
  const items = (r.audits["network-requests"]?.details as { items?: Array<{ transferSize?: number; resourceType?: string }> } | undefined)?.items ?? [];
  const transfer = items.reduce((s, i) => s + (i.transferSize ?? 0), 0);
  const script = items.filter((i) => i.resourceType === "Script").reduce((s, i) => s + (i.transferSize ?? 0), 0);
  const failing = Object.values(r.audits)
    .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "notApplicable" && a.scoreDisplayMode !== "manual")
    .map((a) => `${a.id} (${Math.round((a.score ?? 0) * 100)})`);
  return {
    url,
    performance: cat("performance"), accessibility: cat("accessibility"), bestPractices: cat("best-practices"), seo: cat("seo"),
    fcp: num("first-contentful-paint"), lcp: num("largest-contentful-paint"), tbt: num("total-blocking-time"), cls: num("cumulative-layout-shift"), si: num("speed-index"), ttfb: num("server-response-time"),
    transferKb: Math.round(transfer / 1024), scriptKb: Math.round(script / 1024),
    failing,
  };
}

const ms = (n: number) => `${(n / 1000).toFixed(1)} s`;

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const served = BASE ? null : await startStatic();
  const base = BASE ?? served!.base;
  const chrome = await launch({ chromeFlags: ["--headless=new", "--no-first-run", "--disable-gpu"] });
  const rows: Row[] = [];
  try {
    for (const path of URLS) {
      const url = `${base}${path}`;
      const runs: Array<{ row: Row; report: string }> = [];
      for (let i = 0; i < RUNS; i++) {
        const flags: Flags = { port: chrome.port, output: "html", logLevel: "error" };
        const res = await lighthouse(url, flags);
        if (!res) throw new Error(`lighthouse returned nothing for ${url}`);
        runs.push({ row: summarize(path, res.lhr), report: Array.isArray(res.report) ? res.report[0]! : (res.report as string) });
      }
      runs.sort((a, b) => a.row.performance - b.row.performance);
      const median = runs[Math.floor(runs.length / 2)]!;
      rows.push(median.row);
      const name = path === "/" ? "home" : path.replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-");
      writeFileSync(resolve(OUT, `${name}.html`), median.report);
      console.log(`${path.padEnd(58)} perf ${String(median.row.performance).padStart(3)}  a11y ${median.row.accessibility}  bp ${median.row.bestPractices}  seo ${median.row.seo}  LCP ${ms(median.row.lcp)}  TBT ${Math.round(median.row.tbt)} ms  CLS ${median.row.cls.toFixed(3)}  js ${median.row.scriptKb} kB  (${runs.map((r) => r.row.performance).join("/")})`);
    }
  } finally {
    // chrome-launcher can throw EPERM removing its temp profile on Windows; the process is gone either way.
    try { await chrome.kill(); } catch { /* ignore */ }
    served?.stop();
  }

  const lines = [
    "# Lighthouse (mobile) — Phase 68",
    "",
    `Base: ${base} · runs per URL: ${RUNS} (median by performance) · Lighthouse default mobile profile · ${new Date().toISOString()}`,
    "",
    "| URL | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | SI | JS kB | total kB |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| \`${r.url}\` | ${r.performance} | ${r.accessibility} | ${r.bestPractices} | ${r.seo} | ${ms(r.fcp)} | ${ms(r.lcp)} | ${Math.round(r.tbt)} ms | ${r.cls.toFixed(3)} | ${ms(r.si)} | ${r.scriptKb} | ${r.transferKb} |`),
    "",
    "## Audits under 90, per URL",
    "",
    ...rows.flatMap((r) => [`- \`${r.url}\`: ${r.failing.length ? r.failing.join(", ") : "none"}`]),
    "",
  ];
  writeFileSync(resolve(OUT, "report.md"), lines.join("\n"));
  writeFileSync(resolve(OUT, "report.json"), JSON.stringify(rows, null, 2));
  const misses = rows.filter((r) => r.performance < TARGETS.performance || r.seo < TARGETS.seo || r.cls > TARGETS.cls);
  console.log(`\n[lighthouse] ${rows.length} URLs → ${resolve(OUT, "report.md")}${misses.length ? ` — ${misses.length} under target (perf ≥ ${TARGETS.performance}, SEO ${TARGETS.seo}, CLS ≤ ${TARGETS.cls})` : " — all targets met"}`);
  process.exit(misses.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
