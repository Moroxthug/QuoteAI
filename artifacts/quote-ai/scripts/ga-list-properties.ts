/**
 * Elenca gli account e le property GA4 visibili al service account.
 * Serve per trovare il property ID da usare negli altri script GA.
 *
 * Uso: npx tsx scripts/ga-list-properties.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AnalyticsAdminServiceClient } from "@google-analytics/admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.join(__dirname, "google-indexing-key.json");

async function main() {
  const client = new AnalyticsAdminServiceClient({ keyFilename: KEY_PATH });

  const [accounts] = await client.listAccounts({});
  if (accounts.length === 0) {
    console.log("Nessun account GA visibile. Verifica di aver aggiunto il service account in GA4 > Admin > Property Access Management.");
    return;
  }

  for (const account of accounts) {
    console.log(`Account: ${account.displayName} (${account.name})`);
    const [properties] = await client.listProperties({
      filter: `parent:${account.name}`,
    });
    for (const prop of properties) {
      console.log(`  Property: ${prop.displayName} -> ${prop.name} (id: ${prop.name?.split("/")[1]})`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
