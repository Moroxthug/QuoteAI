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

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "../dist/public");

// ─── Configuration ─────────────────────────────────────────────────────────

const SAMPLE_SIZE = 50; // how many files to check (or all if fewer exist)
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
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"\s*\/?>/i)
    ?? html.match(/<meta\s+content="([^"]*)"\s+name="description"\s*\/?>/i);
  if (!descMatch) {
    errors.push('Missing <meta name="description"> tag');
  } else {
    const desc = descMatch[1].trim();
    if (desc.length === 0) {
      errors.push('<meta name="description"> content is empty');
    }
  }

  // 3. JSON-LD script must be present
  const hasJsonLd = /<script\s+type="application\/ld\+json">/i.test(html);
  if (!hasJsonLd) {
    errors.push('Missing <script type="application/ld+json"> tag');
  }

  // 4. #root must not be an empty skeleton
  const rootMatch = html.match(/<div\s+id="root">([\s\S]*?)<\/div>/i);
  if (!rootMatch) {
    errors.push('Missing <div id="root"> element');
  } else {
    const rootContent = rootMatch[1].trim();
    if (rootContent.length === 0) {
      errors.push('<div id="root"> is empty — prerender produced a skeleton page');
    }
  }

  return errors;
}

// ─── Main ──────────────────────────────────────────────────────────────────

if (!existsSync(distDir)) {
  console.error(`\n✗ dist/public not found at: ${distDir}`);
  console.error("  Run the build first: pnpm --filter @workspace/quote-ai run build\n");
  process.exit(1);
}

console.log(`\nScanning HTML files in ${distDir}…`);

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
