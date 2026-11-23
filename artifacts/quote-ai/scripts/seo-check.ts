/**
 * SEO gate on the built site (docs/SEO-RECOVERY-PLAN.md S2). Runs at the end
 * of `build`, so a deploy fails instead of shipping a regression.
 *
 * Fails on:
 *  - a sitemap URL without a built page, or a built page that is noindex
 *  - an indexable page left out of the sitemap
 *  - hreflang pointing at a page that is not in the sitemap
 *  - an internal link to a page that does not exist or that redirects
 *    (missing trailing slash, /fr instead of /fr/, a retired trade)
 *  - Italian text from the original template, review/rating markup, or a
 *    SoftwareApplication outside the homepage
 *  - a title over 65 or a meta description over 165 characters, on an
 *    indexable page
 *  - no 404.html
 *
 *   pnpm --filter @workspace/quote-ai run qa:seo
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, "../dist/public");
const BASE = "https://quoteai.ca";

if (!existsSync(dist)) {
  console.error("seo-check: dist/public not found; build first.");
  process.exit(1);
}

const sitemap = new Set(
  [...readFileSync(join(__dirname, "../public/sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!),
);

// App routes rendered in the browser (vercel.json rewrites them to spa.html /
// app.html): links to them are fine without a built page.
const APP_PREFIXES = ["/dashboard", "/sign-in", "/sign-up", "/onboarding", "/welcome", "/admin", "/crm", "/sign/", "/portal/", "/i/", "/t/", "/team-invite/", "/join", "/p/"];
const isAppPath = (p: string) => APP_PREFIXES.some((x) => p === x || p === `${x}/` || p.startsWith(x.endsWith("/") ? x : `${x}/`));

const pages: string[] = [];
(function walk(dir: string) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "assets") walk(p);
    } else if (e.name === "index.html") pages.push(p);
  }
})(dist);

const urlOf = (file: string) => {
  const rel = relative(dist, dirname(file)).split(sep).join("/");
  return rel ? `${BASE}/${rel}/` : `${BASE}/`;
};
const built = new Set(pages.map(urlOf));

const errors: string[] = [];
const err = (msg: string) => errors.push(msg);

if (!existsSync(join(dist, "404.html"))) err("404.html is missing");
for (const u of sitemap) if (!built.has(u)) err(`sitemap URL has no built page: ${u}`);

const ITALIAN = /Generato con AI|P\.IVA|IVA 22%|Spett\.le|La Tua Azienda|Preventivo\b|Subtotale/;
let indexable = 0;

for (const file of pages) {
  const html = readFileSync(file, "utf8");
  const url = urlOf(file);
  const head = html.slice(0, html.indexOf("</head>"));
  const robots = [...head.matchAll(/<meta name="robots" content="([^"]*)"/g)].map((m) => m[1]!);
  if (robots.length !== 1) err(`${url}: ${robots.length} robots meta tags`);
  const noindex = robots.some((r) => r.includes("noindex"));

  if (sitemap.has(url) && noindex) err(`${url}: in the sitemap but noindex`);
  if (!sitemap.has(url) && !noindex) err(`${url}: indexable but not in the sitemap`);

  if (ITALIAN.test(html)) err(`${url}: Italian template text`);
  if (/"@type":"(AggregateRating|Review)"/.test(html)) err(`${url}: review or rating markup`);
  if (/"@type":"SoftwareApplication"/.test(html) && url !== `${BASE}/` && url !== `${BASE}/fr/`) err(`${url}: SoftwareApplication outside the homepage`);

  if (!noindex) {
    indexable++;
    const title = /<title>([^<]*)<\/title>/.exec(head)?.[1] ?? "";
    const desc = /<meta name="description" content="([^"]*)"/.exec(head)?.[1] ?? "";
    const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');
    if (decode(title).length > 65) err(`${url}: title is ${decode(title).length} characters`);
    if (decode(desc).length > 165) err(`${url}: description is ${decode(desc).length} characters`);
    for (const m of head.matchAll(/hreflang="([^"]+)" href="([^"]+)"/gi)) {
      if (!sitemap.has(m[2]!)) err(`${url}: hreflang ${m[1]} -> ${m[2]} is not in the sitemap`);
    }
  }

  // Internal links in the page body.
  const body = html.slice(html.indexOf("<body"));
  for (const m of body.matchAll(/<a\b[^>]*\shref="(\/[^"]*)"/g)) {
    const path = m[1]!.split("#")[0]!.split("?")[0]!;
    if (!path || isAppPath(path) || /\.[a-z0-9]+$/i.test(path)) continue;
    if (!path.endsWith("/")) {
      err(`${url}: link to ${path} (redirects: no trailing slash)`);
      continue;
    }
    if (!built.has(`${BASE}${path}`)) err(`${url}: link to ${path} (no such page)`);
  }
}

if (errors.length) {
  const unique = [...new Set(errors)];
  console.error(`\nseo-check: ${unique.length} problem(s) in ${pages.length} pages:\n`);
  for (const e of unique.slice(0, 80)) console.error(`  ✗ ${e}`);
  if (unique.length > 80) console.error(`  … and ${unique.length - 80} more`);
  process.exit(1);
}
console.log(`✓ seo-check: ${pages.length} pages (${indexable} indexable, ${sitemap.size} in the sitemap), no problems.`);
