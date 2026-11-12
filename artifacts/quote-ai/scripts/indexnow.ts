/**
 * IndexNow: tell Bing (which also feeds ChatGPT search and Copilot), Yandex,
 * Seznam and Naver that pages changed, so they recrawl in hours instead of
 * weeks. Google does not use IndexNow; for Google the sitemap and Search
 * Console's "Request indexing" remain the levers.
 *
 * The key is public by design: the engines fetch https://quoteai.ca/<key>.txt
 * to check that whoever submits owns the site. Run after a deploy is live:
 *
 *   npx tsx scripts/indexnow.ts                 every URL in the sitemap
 *   npx tsx scripts/indexnow.ts --since=2026-11-01   only URLs with a newer lastmod
 *   npx tsx scripts/indexnow.ts https://quoteai.ca/blog/x/ …   just these
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOST = "quoteai.ca";
const KEY = "42efa5f32c86381e275c45d6bd26756c";

const args = process.argv.slice(2);
const since = args.find((a) => a.startsWith("--since="))?.slice(8);
let urls = args.filter((a) => a.startsWith("https://"));
if (urls.length === 0) {
  const xml = readFileSync(join(__dirname, "../public/sitemap.xml"), "utf-8");
  urls = [...xml.matchAll(/<loc>(.*?)<\/loc>\s*<lastmod>(.*?)<\/lastmod>/g)]
    .filter((m) => !since || m[2] >= since)
    .map((m) => m[1]);
}

// One request takes up to 10 000 URLs.
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log(`IndexNow: ${urls.length} URLs -> HTTP ${res.status} ${res.statusText}`);
if (res.status >= 400) {
  console.log(await res.text());
  process.exit(1);
}
