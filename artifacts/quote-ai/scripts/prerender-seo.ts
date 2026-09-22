// Build-time prerender of every public page (Phase 68, rewritten in Phase 80).
//
// Each route in listPrerenderRoutes() is rendered by the real React tree
// (dist/server/entry-server.js, built with `vite build --ssr`) and written to
// dist/public/<route>/index.html: the page's own <SeoHead> supplies the whole
// <head> (title, description, canonical, hreflang, Open Graph, JSON-LD) and
// the render supplies <div id="root">, which main.tsx hydrates. Until Phase 80
// the 233 sector/city/blog pages were hand-written HTML templates in this
// file — a second copy of every page that had drifted to the pre-redesign
// layout and a second copy of every head that had drifted from the page.
//
// Critical CSS (Phase 80): the site stylesheet is ~200 kB and render-blocking.
// Beasties inlines the rules each page actually uses above the fold into a
// <style> and moves the full stylesheet <link> to the end of <body>, so the
// first paint no longer waits on it. No inline event handlers or scripts are
// emitted (the CSP allows neither).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Beasties from "beasties";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "../dist/public");
const templatePath = join(distDir, "index.html");

if (!existsSync(templatePath)) {
  console.error("dist/public/index.html not found — run vite build first");
  process.exit(1);
}
const ssrEntry = join(__dirname, "../dist/server/entry-server.js");
if (!existsSync(ssrEntry)) {
  console.error("dist/server/entry-server.js not found — run `vite build --ssr src/entry-server.tsx --outDir dist/server` first");
  process.exit(1);
}

type Lang = "en" | "fr";
interface RenderedPage { body: string; head: string; htmlLang: string }
const { renderPage, listPrerenderRoutes } = (await import(pathToFileURL(ssrEntry).href)) as {
  renderPage: (path: string, lang: Lang) => Promise<RenderedPage>;
  listPrerenderRoutes: () => Array<{ path: string; lang: Lang }>;
};

// ─── Template surgery ──────────────────────────────────────────────────────

/**
 * Strip dashboard and charts chunk modulepreloads so public pages don't
 * eagerly fetch code that is only needed inside the authenticated dashboard.
 * Since Phase 61 the Vite config no longer emits a "dashboard" manual chunk
 * (the entry no longer statically reaches it), so this is a no-op guard kept
 * in case a manual chunk is reintroduced.
 */
function pruneModulepreload(html: string): string {
  return html.replace(/<link\s+rel="modulepreload"\s+crossorigin\s+href="\/assets\/(dashboard|charts)-[^"]*\.js"[^>]*>/gi, "");
}

/** Replace the template's default head (index.html is the dev shell) with the page's own. */
function injectHead(template: string, page: RenderedPage): string {
  let html = template;
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${page.htmlLang}"`);
  html = html.replace(/<title>[^<]*<\/title>/, "");
  html = html.replace(/<meta\s+name="description"[^>]*\/?>/i, "");
  html = html.replace(/<link\b[^>]*\brel=["']canonical["'][^>]*\/?>/gi, "");
  html = html.replace(/<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+name="keywords"[^>]*\/?>/gi, "");
  html = html.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
  // After <meta charset> + viewport: the charset declaration must stay within
  // the first 1024 bytes of the document, and a <title> with an en dash was
  // landing in front of it (Phase 68).
  const viewport = /<meta\s+name="viewport"[^>]*>/i.exec(html);
  const headBlock = page.head
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
  html = viewport
    ? html.slice(0, viewport.index + viewport[0].length) + `\n${headBlock}` + html.slice(viewport.index + viewport[0].length)
    : html.replace("<head>", `<head>\n${headBlock}`);
  return html;
}

/**
 * The rendered markup, plus the route it was rendered for as `data-ssr`:
 * main.tsx hydrates only when that matches the URL (the Vercel rewrite
 * serves index.html — the homepage — for every route without its own file,
 * so a bare marker would make /dashboard hydrate against the homepage).
 */
function injectBody(html: string, routePath: string, bodyHtml: string): string {
  return html.replace(/<div id="root"><\/div>/, `<div id="root" data-ssr="${routePath}">${bodyHtml}</div>`);
}

// main.tsx imports the App on demand; the prerendered pages hydrate with it,
// so they preload the chunk — and the chunks it statically pulls in — to
// avoid a second round trip before hydration. The names carry content
// hashes, so they are read off dist/.
const APP_PRELOADS: string[] = (() => {
  const assets = join(distDir, "assets");
  const app = readdirSync(assets).find((f) => /^App-[\w-]+\.js$/.test(f));
  if (!app) return [];
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(join(assets, file), "utf8");
    for (const m of src.matchAll(/(?:^|[^.\w])import\s*["']\.\/([\w-]+\.js)["']|from\s*["']\.\/([\w-]+\.js)["']/g)) walk((m[1] ?? m[2])!);
  };
  walk(app);
  return [...seen];
})();
function injectAppPreload(html: string): string {
  const links = APP_PRELOADS.map((f) => `<link rel="modulepreload" crossorigin href="/assets/${f}">`).join("\n    ");
  return links ? html.replace("</head>", `    ${links}\n  </head>`) : html;
}

function writeRoute(routePath: string, html: string): void {
  const outDir = routePath === "/" ? distDir : join(distDir, routePath.replace(/^\//, ""));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html, "utf-8");
}

// ─── Critical CSS ──────────────────────────────────────────────────────────

const beasties = new Beasties({
  path: distDir,
  publicPath: "/",
  // The full stylesheet <link> moves to the end of <body>: no onload handler,
  // no injected script (both are blocked by the CSP), and the page keeps
  // working with JavaScript off. `pruneSource` stays off so the external
  // sheet remains the single complete stylesheet the SPA needs after hydration.
  preload: "body",
  pruneSource: false,
  inlineFonts: false,
  preloadFonts: false,
  reduceInlineStyles: false,
  // The design tokens live on :root; keep them and the keyframes the hero uses.
  keyframes: "critical",
  compress: true,
  logLevel: "warn",
});

async function inlineCriticalCss(html: string): Promise<string> {
  const out = await beasties.process(html);
  if (/\son(?:load|error)=/i.test(out) || /<script(?![^>]*type="application\/ld\+json")[^>]*>[^<]*beasties/i.test(out)) {
    throw new Error("Beasties emitted an inline handler or script — the CSP would block it");
  }
  return out;
}

// ─── Main ──────────────────────────────────────────────────────────────────

const template = pruneModulepreload(readFileSync(templatePath, "utf-8"));
const routes = listPrerenderRoutes();
console.log(`Prerendering ${routes.length} pages...`);

const t0 = Date.now();
let count = 0;
for (const route of routes) {
  const page = await renderPage(route.path, route.lang);
  let html = injectAppPreload(injectBody(injectHead(template, page), route.path, page.body));
  html = await inlineCriticalCss(html);
  writeRoute(route.path, html);
  count++;
  if (count % 50 === 0) console.log(`  … ${count}/${routes.length}`);
}
console.log(`Prerendered ${count} pages in ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
