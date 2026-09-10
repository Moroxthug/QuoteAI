/**
 * Notifica Google (Indexing API) di tutti gli URL presenti in sitemap.xml.
 *
 * Setup richiesto una tantum:
 *  1. Nel progetto GCP del service account, abilita "Web Search Indexing API".
 *  2. In Search Console > Impostazioni > Utenti e permessi, aggiungi come
 *     "Proprietario" l'email del service account (client_email nel JSON).
 *
 * Uso:
 *   npx tsx scripts/submit-to-google.ts
 *   npx tsx scripts/submit-to-google.ts --url=https://quoteai.ca/blog/
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.join(__dirname, "google-indexing-key.json");
const SITEMAP_PATH = path.join(__dirname, "..", "public", "sitemap.xml");

function loadSitemapUrls(): string[] {
  const xml = readFileSync(SITEMAP_PATH, "utf-8");
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  return matches.map((m) => m[1].trim());
}

async function main() {
  if (!existsSync(KEY_PATH)) {
    console.error(`Chiave service account non trovata: ${KEY_PATH}`);
    process.exit(1);
  }

  const singleUrlArg = process.argv.find((a) => a.startsWith("--url="));
  const urls = singleUrlArg
    ? [singleUrlArg.replace("--url=", "")]
    : loadSitemapUrls();

  console.log(`Trovati ${urls.length} URL da notificare a Google.`);

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/indexing"],
  });

  const client = google.indexing({ version: "v3", auth });

  let ok = 0;
  let failed = 0;

  for (const url of urls) {
    try {
      await client.urlNotifications.publish({
        requestBody: { url, type: "URL_UPDATED" },
      });
      ok++;
      console.log(`OK   ${url}`);
    } catch (err: any) {
      failed++;
      const message = err?.response?.data?.error?.message ?? err.message;
      console.error(`FAIL ${url} -> ${message}`);
    }
    // Rispetta il rate limit dell'API (~200 richieste/giorno per progetto).
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\nCompletato: ${ok} inviati, ${failed} falliti su ${urls.length} totali.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
