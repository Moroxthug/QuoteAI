import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.join(__dirname, "google-indexing-key.json");
const SITE_URL = "https://quoteai.ca/";

const urls = [
  "https://quoteai.ca/quotes/air-conditioning-installer/",
  "https://quoteai.ca/quotes/painter/monza/",
  "https://quoteai.ca/quotes/general-contractor/brescia/",
  "https://quoteai.ca/blog/privacy/",
  "https://quoteai.ca/privacy/",
  "https://quoteai.ca/chi-siamo/",
];

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const searchconsole = google.searchconsole({ version: "v1", auth });

  for (const url of urls) {
    try {
      const res = await searchconsole.urlInspection.index.inspect({
        requestBody: { inspectionUrl: url, siteUrl: SITE_URL },
      });
      const r = res.data.inspectionResult?.indexStatusResult;
      console.log(`\n=== ${url} ===`);
      console.log(JSON.stringify(r, null, 2));
    } catch (err: any) {
      console.error(`ERROR for ${url}:`, err?.response?.data?.error?.message ?? err.message);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
