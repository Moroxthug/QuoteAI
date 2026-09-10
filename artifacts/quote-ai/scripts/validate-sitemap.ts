/**
 * Validate that every URL in the generated sitemap.xml resolves to a
 * prerendered index.html file in dist/public, or is in the explicit
 * SPA_ONLY_PATHS allowlist below.
 *
 * Resolution rules (in order):
 *   1. PRERENDERED — dist/public/<path>/index.html exists → OK
 *   2. SPA-ONLY   — path is listed in SPA_ONLY_PATHS → warn, pass
 *   3. Otherwise  → FAIL (non-zero exit)
 *
 * The allowlist is intentionally NOT derived from sitemap-routes.ts or any
 * other file used during sitemap generation. This means a typo added to
 * sitemap-routes.ts (or a SEO data file) produces a non-zero exit even if the
 * SPA shell dist/public/index.html is present.
 *
 * When to update SPA_ONLY_PATHS:
 *   Add a path here only if it:
 *     a) intentionally appears in the sitemap, AND
 *     b) has NO dedicated prerendered index.html (pure client-side rendering).
 *   Otherwise prerender the page instead.
 *
 * Usage:
 *   pnpm --filter @workspace/quote-ai run validate-sitemap
 *
 * Exits 1 with a detailed report if any URL is broken.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "../dist/public");
const sitemapPath = join(__dirname, "../public/sitemap.xml");
const BASE_URL = "https://quoteai.ca";

/**
 * Explicit allowlist of paths that are intentionally served by the SPA shell
 * rather than a dedicated prerendered HTML file.
 *
 * These paths must be valid React routes (i.e. the client-side app renders
 * real content for them), but have no static index.html in dist/public.
 *
 * This list is independent of sitemap-routes.ts so that typos in that file
 * are caught rather than silently accepted.
 */
const SPA_ONLY_PATHS = new Set<string>([]);

// ─── Guards ──────────────────────────────────────────────────────────────────

if (!existsSync(sitemapPath)) {
  console.error(`\n✗ sitemap.xml not found at: ${sitemapPath}`);
  console.error(
    "  Run the sitemap generator first: pnpm --filter @workspace/quote-ai run prebuild\n",
  );
  process.exit(1);
}

if (!existsSync(distDir)) {
  console.error(`\n✗ dist/public not found at: ${distDir}`);
  console.error(
    "  Run the build first: pnpm --filter @workspace/quote-ai run build\n",
  );
  process.exit(1);
}

// ─── Parse sitemap URLs ──────────────────────────────────────────────────────

const sitemapXml = readFileSync(sitemapPath, "utf-8");
const locMatches = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)];
const urls: string[] = locMatches.map((m) => m[1].trim());

if (urls.length === 0) {
  console.error("✗ No <loc> entries found in sitemap.xml");
  process.exit(1);
}

console.log(`\nValidating ${urls.length} sitemap URLs against ${distDir}…\n`);

// ─── Classify each URL ───────────────────────────────────────────────────────

interface Result {
  url: string;
  path: string;
  status: "prerendered" | "spa-only" | "missing";
}

const results: Result[] = [];

for (const rawUrl of urls) {
  if (!rawUrl.startsWith(BASE_URL)) {
    results.push({ url: rawUrl, path: "(unexpected origin)", status: "missing" });
    continue;
  }

  const urlPath = rawUrl.slice(BASE_URL.length) || "/";

  // 1. Does a dedicated prerendered file exist?
  //    Strip the leading "/" so path.join doesn't produce double slashes and
  //    the intent is explicit (we're appending a relative segment to distDir).
  const relPath = urlPath === "/" ? "" : urlPath.replace(/^\//, "");
  const fsPath = join(distDir, relPath, "index.html");

  if (existsSync(fsPath)) {
    results.push({ url: rawUrl, path: urlPath, status: "prerendered" });
    continue;
  }

  // 2. Is the path on the explicit SPA-only allowlist?
  //    This list is maintained independently of sitemap-routes.ts.
  if (SPA_ONLY_PATHS.has(urlPath)) {
    results.push({ url: rawUrl, path: urlPath, status: "spa-only" });
    continue;
  }

  // 3. No prerendered file, not in allowlist → broken sitemap entry.
  results.push({ url: rawUrl, path: urlPath, status: "missing" });
}

// ─── Report ──────────────────────────────────────────────────────────────────

const prerendered = results.filter((r) => r.status === "prerendered");
const spaOnly = results.filter((r) => r.status === "spa-only");
const missing = results.filter((r) => r.status === "missing");

if (spaOnly.length > 0) {
  console.log(
    `⚠  ${spaOnly.length} URL(s) are served by the SPA shell (no dedicated prerender):`,
  );
  for (const r of spaOnly) {
    console.log(`   ${r.path}`);
  }
  console.log();
}

if (missing.length > 0) {
  console.error(
    `✗ ${missing.length} sitemap URL(s) have no prerendered file and are not in SPA_ONLY_PATHS:\n`,
  );
  for (const r of missing) {
    console.error(`   ${r.url}`);
  }
  console.error(
    "\nTo fix:\n" +
    "  • Correct the path in sitemap-routes.ts or the relevant data file, OR\n" +
    "  • Prerender the page (add it to the prerender pipeline), OR\n" +
    "  • Add the path to SPA_ONLY_PATHS in this script if it is intentionally SPA-served.\n" +
    "Then rebuild before deploying.\n",
  );
  process.exit(1);
}

console.log(
  `✓ All ${urls.length} sitemap URLs are valid` +
    ` (${prerendered.length} prerendered, ${spaOnly.length} SPA-served).\n`,
);
process.exit(0);
