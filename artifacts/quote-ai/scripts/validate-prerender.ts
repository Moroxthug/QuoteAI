/**
 * Smoke-test for prerendered SEO pages.
 *
 * Reads a random sample of generated HTML files from dist/public and asserts:
 *  1. <h1> is present and non-empty
 *  2. <meta name="description"> has a non-empty content attribute
 *  3. At least one <script type="application/ld+json"> tag is present
 *  4. <div id="root"> is NOT an empty skeleton (has actual content)
 *
 * Usage:
 *   pnpm --filter @workspace/quote-ai run validate-prerender
 *
 * Exits with code 1 and a detailed error report if any assertion fails.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "../dist/public");

// ─── Configuration ─────────────────────────────────────────────────────────

const SAMPLE_SIZE = Number(process.env.PRERENDER_SAMPLE ?? 0) || Infinity; // Phase 68: every file by default (417 takes < 1 s); PRERENDER_SAMPLE=50 for the old random sample
const SEED = 42;        // deterministic shuffle seed

// ─── Helpers ───────────────────────────────────────────────────────────────

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Recursively collect all index.html file paths under a directory. */
function collectHtmlFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectHtmlFiles(full));
    } else if (entry.isFile() && entry.name === "index.html") {
      results.push(full);
    }
  }
  return results;
}

// ─── Assertions ────────────────────────────────────────────────────────────

interface Failure {
  file: string;
  errors: string[];
}

function validateHtml(filePath: string, html: string): string[] {
  const errors: string[] = [];

  // 1. h1 must be present and non-empty
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1Match) {
    errors.push("Missing <h1> tag");
  } else {
    const h1Text = h1Match[1].replace(/<[^>]*>/g, "").trim();
    if (h1Text.length === 0) {
      errors.push("<h1> tag is present but empty");
    }
  }

  // 2. meta description must be present and non-empty
  // Phase 80: the head is Helmet output (`<meta data-rh="true" name=… content=…/>`), so attribute order is not fixed.
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const descTag = metaTags.find((tag) => /\bname="description"/i.test(tag));
  const descMatch = descTag ? /\bcontent="([^"]*)"/i.exec(descTag) : null;
  if (!descMatch) {
    errors.push('Missing <meta name="description"> tag');
  } else {
    const desc = descMatch[1].trim();
    if (desc.length === 0) {
      errors.push('<meta name="description"> content is empty');
    }
  }

  // 3. JSON-LD script must be present
  const hasJsonLd = /<script\b[^>]*type="application\/ld\+json"[^>]*>/i.test(html);
  if (!hasJsonLd) {
    errors.push('Missing <script type="application/ld+json"> tag');
  }

  // 4. #root must not be an empty skeleton
  const rootMatch = html.match(/<div\s+id="root"(?:\s+data-ssr="[^"]*")?>([\s\S]*?)<\/div>/i);
  if (!rootMatch) {
    errors.push('Missing <div id="root"> element');
  } else {
    const rootContent = rootMatch[1].trim();
    if (rootContent.length === 0) {
      errors.push('<div id="root"> is empty — prerender produced a skeleton page');
    }
  }


  // 5. (Phase 68) head integrity — one <title>, one canonical that matches
  //    the file's own path, hreflang x-default, og:image that exists in
  //    dist/public (210 sector/city pages pointed at /og/<slug>.jpg — a 404),
  //    and <meta charset> ahead of everything else in <head>.
  const rel = relative(distDir, filePath).split(sep).join("/").replace(/index\.html$/, "");
  const expectedCanonical = `https://quoteai.ca/${rel}`;
  const titles = html.match(/<title>/gi) ?? [];
  if (titles.length !== 1) errors.push(`Expected exactly one <title>, found ${titles.length}`);
  const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const canonicals = linkTags.filter((tag) => /\brel="canonical"/i.test(tag)).map((tag) => /\bhref="([^"]*)"/i.exec(tag)?.[1] ?? "");
  if (canonicals.length !== 1) errors.push(`Expected exactly one canonical, found ${canonicals.length}`);
  else if (canonicals[0] !== expectedCanonical) errors.push(`Canonical ${canonicals[0]} ≠ ${expectedCanonical}`);
  if (!linkTags.some((tag) => /\bhreflang="x-default"/i.test(tag))) errors.push("Missing hreflang x-default");
  // Phase 80: a page must only advertise language alternates that are built.
  for (const tag of linkTags.filter((t) => /\bhreflang="(?:en-CA|fr-CA)"/i.test(t))) {
    const href = /\bhref="https:\/\/quoteai\.ca(\/[^"]*)"/i.exec(tag)?.[1];
    if (!href) { errors.push(`hreflang tag without an absolute quoteai.ca href: ${tag}`); continue; }
    if (!existsSync(join(distDir, href.replace(/\/$/, ""), "index.html"))) errors.push(`hreflang alternate ${href} is not a prerendered page`);
  }
  // Phase 80: the hydration marker must name this route.
  const ssrMarker = html.match(/<div\s+id="root"\s+data-ssr="([^"]*)"/)?.[1];
  const expectedMarker = rel === "" ? "/" : `/${rel.replace(/\/$/, "")}`;
  if (ssrMarker !== expectedMarker) errors.push(`data-ssr "${ssrMarker}" ≠ "${expectedMarker}"`);
  // Phase 80: critical CSS inlined, full stylesheet deferred to the end of <body>, nothing the CSP blocks.
  if (!/<style[^>]*>[^<]*:root/i.test(html)) errors.push("No inlined critical CSS (<style> with :root tokens)");
  if (/\son(?:load|error)=/i.test(html)) errors.push("Inline event handler in the page (blocked by the CSP)");
  const bodyHtml = html.slice(html.indexOf("<body"));
  if (!/<link\b[^>]*rel="stylesheet"[^>]*href="\/assets\/index-[^"]+\.css"/i.test(bodyHtml)) errors.push("Full stylesheet <link> is not in <body>");
  const ogTag = metaTags.find((tag) => /\bproperty="og:image"/i.test(tag));
  const og = ogTag ? /\bcontent="https:\/\/quoteai\.ca(\/[^"]+)"/i.exec(ogTag) : null;
  if (!og) errors.push("Missing og:image");
  else if (!existsSync(join(distDir, og[1]!))) errors.push(`og:image ${og[1]} does not exist in dist/public`);
  const head = html.slice(html.indexOf("<head>"), html.indexOf("</head>"));
  const charsetAt = head.search(/<meta\s+charset=/i);
  const firstTag = head.search(/<(?!head)[a-z]/i);
  if (charsetAt === -1) errors.push("Missing <meta charset>");
  else if (charsetAt !== firstTag) errors.push("<meta charset> is not the first element in <head>");
  const lang = html.match(/<html lang="([^"]*)"/)?.[1];
  if (rel.startsWith("fr/") ? lang !== "fr-CA" : lang !== "en-CA") errors.push(`<html lang="${lang}"> does not match the route`);
  return errors;
}

// ─── Main ──────────────────────────────────────────────────────────────────

if (!existsSync(distDir)) {
  console.error(`\n✗ dist/public not found at: ${distDir}`);
  console.error("  Run the build first: pnpm --filter @workspace/quote-ai run build\n");
  process.exit(1);
}

console.log(`\nScanning HTML files in ${distDir}…`);

// Phase 80: every index.html under dist/public is a prerendered page, the homepage included.
const allFiles = collectHtmlFiles(distDir);
if (allFiles.length === 0) {
  console.error("✗ No index.html files found in dist/public");
  process.exit(1);
}

const shuffled = seededShuffle(allFiles, SEED);
const sample = shuffled.slice(0, SAMPLE_SIZE);

console.log(`Found ${allFiles.length} HTML files — checking ${sample.length} (sample of ${SAMPLE_SIZE}).\n`);

const failures: Failure[] = [];

for (const filePath of sample) {
  const html = readFileSync(filePath, "utf-8");
  const errors = validateHtml(filePath, html);
  if (errors.length > 0) {
    failures.push({ file: relative(distDir, filePath), errors });
  }
}

if (failures.length === 0) {
  console.log(`✓ All ${sample.length} sampled pages passed the prerender smoke-test.\n`);
  process.exit(0);
} else {
  console.error(`✗ ${failures.length} of ${sample.length} sampled pages FAILED:\n`);
  for (const { file, errors } of failures) {
    console.error(`  ${file}`);
    for (const err of errors) {
      console.error(`    • ${err}`);
    }
  }
  console.error(`\nFix the prerender script and rebuild before deploying.\n`);
  process.exit(1);
}
