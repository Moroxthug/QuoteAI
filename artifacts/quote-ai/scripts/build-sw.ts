// Phase 77 (docs/PILOT-LAUNCH-PLAN.md): finalize the service worker after the
// client build.
//
// public/sw.js is copied verbatim into dist/public by Vite; this rewrites that
// copy with the release id (cache names) and the app-shell precache list —
// the chunk closure of the entry, the App, and the pages a contractor or
// worker needs with no signal — read off Vite's manifest so content hashes
// are always current. Runs from the `build` script after `vite build`.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(import.meta.dirname, "..", "dist", "public");
const swPath = resolve(distDir, "sw.js");
const manifestPath = resolve(distDir, ".vite", "manifest.json");

if (!existsSync(swPath)) {
  console.error("dist/public/sw.js not found — run vite build first");
  process.exit(1);
}

type ManifestChunk = { file: string; src?: string; isEntry?: boolean; imports?: string[]; css?: string[] };
const manifest: Record<string, ManifestChunk> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

// Pages whose chunks are precached (keys are Vite manifest keys = source paths).
const SHELL_ENTRIES = [
  "index.html",
  // The App is a dynamic import from main.tsx: Vite keys it by its output name.
  ...Object.keys(manifest).filter((k) => /^_App-[w-]+.js$/.test(k)),
  "src/pages/t/[token].tsx",
  "src/pages/dashboard/index.tsx",
  "src/pages/dashboard/jobs/index.tsx",
  "src/pages/dashboard/jobs/[id].tsx",
  "src/pages/dashboard/schedule.tsx",
  "src/pages/dashboard/notifications.tsx",
];

const files = new Set<string>();
const seen = new Set<string>();
function walk(key: string) {
  if (seen.has(key)) return;
  seen.add(key);
  const chunk = manifest[key];
  if (!chunk) return;
  files.add(`/${chunk.file}`);
  for (const css of chunk.css ?? []) files.add(`/${css}`);
  for (const dep of chunk.imports ?? []) walk(dep);
}
for (const entry of SHELL_ENTRIES) {
  if (!manifest[entry]) console.warn(`build-sw: ${entry} not in the Vite manifest (skipped)`);
  walk(entry);
}

const precache = [...files].filter((f) => f.startsWith("/assets/")).sort();
const version = (process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 12) || `local-${Date.now().toString(36)}`;

let sw = readFileSync(swPath, "utf8");
const VERSION_LINE = /const VERSION = "__SW_VERSION__";/;
if (!VERSION_LINE.test(sw) || !sw.includes("/* __PRECACHE__ */ []")) {
  console.error("build-sw: placeholders missing from dist/public/sw.js");
  process.exit(1);
}
sw = sw.replace(VERSION_LINE, `const VERSION = "${version}";`).replace("/* __PRECACHE__ */ []", JSON.stringify(precache));
writeFileSync(swPath, sw);
console.log(`build-sw: version ${version}, ${precache.length} shell assets precached`);
