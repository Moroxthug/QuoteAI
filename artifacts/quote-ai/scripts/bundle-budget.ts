// Phase 115 (docs/APP-PLAN.md) — JavaScript budgets per screen, enforced in CI.
//
//   pnpm --filter @workspace/quote-ai build            # or just `vite build`
//   pnpm --filter @workspace/quote-ai qa:bundle        # exit 1 when a screen is over budget
//   pnpm --filter @workspace/quote-ai qa:bundle -- --json
//
// Reads the Vite manifest of dist/public and, for every screen in
// perf-budgets.json, adds up the gzipped JavaScript a cold visit downloads
// before the screen can render: the entry, the chunks it pulls in statically,
// and the lazy chunks the router always waits for on that route (the App, the
// dashboard layout, the page, the strings of one language). The app shell is
// everything a signed-in screen needs except the page itself.
//
// Sizes are gzip level 9 of the built files (Vercel serves brotli, which is
// smaller still), in kB of 1,000 bytes like Vite's own report. Writes
// .qa/bundle/report.{md,json}.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

type ManifestChunk = { file: string; src?: string; isEntry?: boolean; imports?: string[]; dynamicImports?: string[]; css?: string[] };
type Screen = { name: string; path: string; lang?: "en" | "fr"; roots: string[]; budget: number };
type Budgets = { shell: { en: number; fr: number }; chunk: number; screens: Screen[] };

const ROOT = resolve(import.meta.dirname, "..");
const DIST = resolve(ROOT, "dist/public");
const OUT = resolve(ROOT, ".qa/bundle");
const json = process.argv.includes("--json");

const manifestPath = resolve(DIST, ".vite/manifest.json");
if (!existsSync(manifestPath)) {
  console.error("qa:bundle: dist/public/.vite/manifest.json not found — run the client build first");
  process.exit(1);
}
const manifest: Record<string, ManifestChunk> = JSON.parse(readFileSync(manifestPath, "utf8"));
const budgets: Budgets = JSON.parse(readFileSync(resolve(ROOT, "perf-budgets.json"), "utf8"));
// Source path → chunk file (vite.config.ts chunkMapPlugin), then chunk file → manifest key.
const chunkMapPath = resolve(DIST, ".vite/chunk-map.json");
const chunkMap: Record<string, string> = existsSync(chunkMapPath) ? JSON.parse(readFileSync(chunkMapPath, "utf8")) : {};
const keyOfFile = new Map(Object.entries(manifest).map(([k, c]) => [c.file, k]));
const keyOf = (src: string) => (manifest[src] ? src : keyOfFile.get(chunkMap[src] ?? "") ?? src);

const gz = new Map<string, number>();
function gzipKb(file: string): number {
  let n = gz.get(file);
  if (n === undefined) {
    n = gzipSync(readFileSync(resolve(DIST, file)), { level: 9 }).length / 1000;
    gz.set(file, n);
  }
  return n;
}

// Manifest keys: source paths for real modules, `_<name>-<hash>.js` for shared
// chunks, the virtual id for the string packs. `@App` / `@layout` / `@strings`
// are shorthands so perf-budgets.json survives content hashes.
function resolveRoot(root: string, lang: "en" | "fr"): string[] {
  if (root === "@App") return Object.keys(manifest).filter((k) => /^_App-[\w-]+\.js$/.test(k));
  if (root === "@layout") return ["src/components/layout/dashboard-layout.tsx"];
  if (root === "@strings") return [`virtual:i18n/core/${lang}`];
  if (root === "@dashboard-strings") return [`virtual:i18n/dashboard/${lang}`];
  return [root];
}

function closure(keys: string[]): Set<string> {
  const files = new Set<string>();
  const seen = new Set<string>();
  const walk = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`qa:bundle: "${key}" is not in the Vite manifest — fix perf-budgets.json`);
    if (chunk.file.endsWith(".js")) files.add(chunk.file);
    for (const dep of chunk.imports ?? []) walk(dep);
  };
  keys.map(keyOf).forEach(walk);
  return files;
}

const sum = (files: Iterable<string>) => [...files].reduce((s, f) => s + gzipKb(f), 0);
const SHELL_ROOTS = ["index.html", "@App", "@strings", "@layout", "@dashboard-strings"];

type Row = { name: string; path: string; lang: string; kb: number; budget: number; pageKb: number; biggest: string; over: boolean };
const rows: Row[] = [];

for (const lang of ["en", "fr"] as const) {
  const files = closure(SHELL_ROOTS.flatMap((r) => resolveRoot(r, lang)));
  const kb = sum(files);
  rows.push({ name: `App shell (${lang.toUpperCase()})`, path: "/dashboard/*", lang, kb, budget: budgets.shell[lang], pageKb: 0, biggest: biggest(files), over: kb > budgets.shell[lang] });
}

for (const s of budgets.screens) {
  const lang = s.lang ?? "en";
  const files = closure(s.roots.flatMap((r) => resolveRoot(r, lang)));
  const own = closure(s.roots.filter((r) => !r.startsWith("@") && r !== "index.html"));
  const shared = closure(["index.html", ...s.roots.filter((r) => r.startsWith("@")).flatMap((r) => resolveRoot(r, lang))]);
  const kb = sum(files);
  rows.push({ name: s.name, path: s.path, lang, kb, budget: s.budget, pageKb: sum([...own].filter((f) => !shared.has(f))), biggest: biggest(files), over: kb > s.budget });
}

// Any single chunk a listed screen loads: one oversized chunk is what a split missed.
const loaded = new Set<string>();
for (const lang of ["en", "fr"] as const) for (const f of closure(SHELL_ROOTS.flatMap((r) => resolveRoot(r, lang)))) loaded.add(f);
for (const s of budgets.screens) for (const f of closure(s.roots.flatMap((r) => resolveRoot(r, s.lang ?? "en")))) loaded.add(f);
const bigChunks = [...loaded].filter((f) => gzipKb(f) > budgets.chunk).map((f) => ({ file: f, kb: gzipKb(f) }));

function biggest(files: Set<string>): string {
  const top = [...files].sort((a, b) => gzipKb(b) - gzipKb(a))[0];
  return top ? `${top.replace(/^assets\//, "").replace(/-[\w-]{8}\.js$/, "")} ${gzipKb(top).toFixed(0)}` : "";
}

const fmt = (n: number) => n.toFixed(1);
const over = rows.filter((r) => r.over);
const md = [
  "# JavaScript per screen — Phase 115",
  "",
  `gzip -9 of dist/public, kB · budgets in perf-budgets.json · ${new Date().toISOString()}`,
  "",
  "| screen | path | total | budget | page's own | biggest chunk |",
  "|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.name} | \`${r.path}\` | ${fmt(r.kb)} | ${r.budget}${r.over ? " ❌" : ""} | ${r.pageKb ? fmt(r.pageKb) : "—"} | ${r.biggest} |`),
  "",
  `Largest single chunk allowed on these screens: ${budgets.chunk} kB${bigChunks.length ? ` — over: ${bigChunks.map((c) => `${c.file} ${fmt(c.kb)}`).join(", ")} ❌` : " — none over"}.`,
  "",
];
mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, "report.md"), md.join("\n"));
writeFileSync(resolve(OUT, "report.json"), JSON.stringify({ rows, bigChunks }, null, 2));

if (json) console.log(JSON.stringify({ rows, bigChunks }, null, 2));
else {
  for (const r of rows) console.log(`${r.name.padEnd(28)} ${fmt(r.kb).padStart(7)} kB / ${String(r.budget).padStart(4)}${r.over ? "  OVER BUDGET" : ""}   (${r.biggest})`);
  for (const c of bigChunks) console.log(`chunk over ${budgets.chunk} kB: ${c.file} ${fmt(c.kb)} kB`);
  console.log(`\n[qa:bundle] ${rows.length} screens → ${resolve(OUT, "report.md")}${over.length || bigChunks.length ? ` — ${over.length} screen(s) and ${bigChunks.length} chunk(s) over budget` : " — all within budget"}`);
}
process.exit(over.length || bigChunks.length ? 1 : 0);
