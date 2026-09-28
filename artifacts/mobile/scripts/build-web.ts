// Phase 118: the phone app's files. Builds the quote-ai client in `native`
// mode (lib/native/env.ts: isNativeApp, API_ORIGIN) straight into www/, then
// drops what only the website needs (marketing images, the service worker,
// SEO files, stray " - Copy" files). VITE_API_ORIGIN picks the API (default
// the live site).
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const web = path.resolve(root, "../quote-ai");
const www = path.join(root, "www");

execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "vite", "build", "--config", "vite.config.ts", "--mode", "native"], {
  cwd: web,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, NATIVE_OUT_DIR: www },
});

const WEBSITE_ONLY = ["og", "blog", "sw.js", "sitemap.xml", "robots.txt", "llms.txt", "widget-test.html", "widget-test.js", "manifest.webmanifest", "opengraph.jpg", ".well-known"];
for (const name of WEBSITE_ONLY) rmSync(path.join(www, name), { recursive: true, force: true });

function prune(dir: string): void {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (/ - Copy(\.|$)/.test(name)) rmSync(p, { recursive: true, force: true });
    else if (statSync(p).isDirectory()) prune(p);
  }
}
prune(www);

if (!existsSync(path.join(www, "index.html"))) throw new Error("www/index.html missing: the native build failed");
let bytes = 0;
const walk = (d: string) => { for (const n of readdirSync(d)) { const p = path.join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p); else bytes += s.size; } };
walk(www);
console.log(`www/ ready: ${(bytes / 1024 / 1024).toFixed(1)} MB, API ${process.env.VITE_API_ORIGIN ?? "https://quoteai.ca"}`);
