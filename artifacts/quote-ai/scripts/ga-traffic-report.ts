/**
 * Estrae il traffico organico per pagina dalle ultime N settimane
 * e lo confronta con sitemap.xml per trovare pagine indicizzate
 * (o presenti nel sito) che non ricevono traffico.
 *
 * Uso: npx tsx scripts/ga-traffic-report.ts [giorni]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.join(__dirname, "google-indexing-key.json");
const SITEMAP_PATH = path.join(__dirname, "..", "public", "sitemap.xml");

const GA4_PROPERTY_ID = "544950059";
const days = Number(process.argv[2]) || 28;

function loadSitemapPaths(): string[] {
  const xml = readFileSync(SITEMAP_PATH, "utf-8");
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  return matches.map((m) => new URL(m[1].trim()).pathname);
}

async function main() {
  const client = new BetaAnalyticsDataClient({ keyFilename: KEY_PATH });

  const [response] = await client.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 1000,
  });

  const trafficByPath = new Map<string, { views: number; sessions: number }>();
  for (const row of response.rows ?? []) {
    const p = row.dimensionValues?.[0]?.value ?? "";
    trafficByPath.set(p, {
      views: Number(row.metricValues?.[0]?.value ?? 0),
      sessions: Number(row.metricValues?.[1]?.value ?? 0),
    });
  }

  console.log(`\n=== Traffico per pagina (ultimi ${days} giorni) ===`);
  for (const [p, stats] of trafficByPath) {
    console.log(`${stats.views.toString().padStart(6)} views  ${stats.sessions.toString().padStart(6)} sessions  ${p}`);
  }

  const sitemapPaths = loadSitemapPaths();
  const zeroTraffic = sitemapPaths.filter((p) => !trafficByPath.has(p));

  console.log(`\n=== Pagine in sitemap SENZA traffico negli ultimi ${days} giorni (${zeroTraffic.length}/${sitemapPaths.length}) ===`);
  for (const p of zeroTraffic) {
    console.log(p);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
