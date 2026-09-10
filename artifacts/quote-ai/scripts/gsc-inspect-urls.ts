/**
 * Interroga la Search Console URL Inspection API per un campione di URL
 * (pagine core + pagine programmatiche citta'/servizio) per capire lo
 * stato di indicizzazione reale e il motivo di eventuale esclusione.
 *
 * Uso:
 *   npx tsx scripts/gsc-inspect-urls.ts              (campione automatico)
 *   npx tsx scripts/gsc-inspect-urls.ts --all        (tutte le URL in sitemap, lento/quota-limited)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.join(__dirname, "google-indexing-key.json");
const SITEMAP_PATH = path.join(__dirname, "..", "public", "sitemap.xml");

const SITE_URL = "https://quoteai.ca/";

function loadSitemapUrls(): string[] {
  const xml = readFileSync(SITEMAP_PATH, "utf-8");
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());
}

function sampleUrls(all: string[]): string[] {
  // Pagine core (sempre incluse) + un campione distribuito di pagine
  // programmatiche citta'/servizio per capire lo stato tipico del template.
  const core = all.filter((u) => !u.includes("/preventivi/"));
  const programmatic = all.filter((u) => u.includes("/preventivi/"));
  const step = Math.max(1, Math.floor(programmatic.length / 15));
  const sampled = programmatic.filter((_, i) => i % step === 0).slice(0, 15);
  return [...core, ...sampled];
}

async function main() {
  const all = loadSitemapUrls();
  const urls = process.argv.includes("--all") ? all : sampleUrls(all);
  console.log(`Ispeziono ${urls.length} URL su ${all.length} totali...\n`);

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const results: { url: string; verdict: string; coverageState: string; lastCrawl?: string }[] = [];

  for (const url of urls) {
    try {
      const res = await searchconsole.urlInspection.index.inspect({
        requestBody: { inspectionUrl: url, siteUrl: SITE_URL },
      });
      const result = res.data.inspectionResult?.indexStatusResult;
      const verdict = result?.verdict ?? "UNKNOWN";
      const coverageState = result?.coverageState ?? "n/d";
      const lastCrawl = result?.lastCrawlTime ?? undefined;
      results.push({ url, verdict, coverageState, lastCrawl });
      console.log(`${verdict.padEnd(10)} ${coverageState.padEnd(35)} ${url}`);
    } catch (err: any) {
      const message = err?.response?.data?.error?.message ?? err.message;
      console.error(`ERROR      ${message.slice(0, 60).padEnd(35)} ${url}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.coverageState] = (counts[r.coverageState] ?? 0) + 1;

  console.log("\n=== Riepilogo per stato di copertura ===");
  for (const [state, count] of Object.entries(counts)) {
    console.log(`${count.toString().padStart(3)}  ${state}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
