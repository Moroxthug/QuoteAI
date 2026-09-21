// Phase 69 (docs/RUNBOOKS.md → "Rotate TOKEN_ENCRYPTION_KEY"): re-encrypts
// every at-rest OAuth token (src/lib/crypto.ts format: iv.tag.ciphertext,
// AES-256-GCM) from the old key to a new one.
//
//   OLD_TOKEN_ENCRYPTION_KEY=<64 hex> NEW_TOKEN_ENCRYPTION_KEY=<64 hex> DATABASE_URL=… \
//     pnpm --filter @workspace/api-server ops:rotate-token-key [--apply]
//
// Without --apply it is a dry run: every value is decrypted with one of the
// two keys and counted, nothing is written. Idempotent: a value that already
// decrypts with the NEW key is left alone, so the script can run again after
// the env flip to catch tokens the still-running old deployment wrote in
// between. A value that decrypts with neither key is reported and the run
// exits 1 without writing anything (the connection has to be re-authorised
// by its owner) — unless --skip-undecryptable, which rotates what it can and
// leaves those rows for their owners to reconnect. --user <id> limits the
// run to one tenant's rows (the e2e test uses it; handy for a single repair).

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import pg from "pg";

const ALGO = "aes-256-gcm";

// One row per encrypted column — keep in sync with `encryptSecret(` call sites.
const COLUMNS: { table: string; pk: string[]; columns: string[] }[] = [
  { table: "quickbooks_connections", pk: ["user_id"], columns: ["access_token_enc", "refresh_token_enc"] },
  { table: "calendar_connections", pk: ["user_id", "provider"], columns: ["access_token_enc", "refresh_token_enc"] },
  { table: "email_connections", pk: ["user_id", "provider"], columns: ["access_token_enc", "refresh_token_enc"] },
  { table: "wave_connections", pk: ["user_id"], columns: ["access_token_enc", "refresh_token_enc"] },
  { table: "flinks_connections", pk: ["user_id"], columns: ["login_id_enc"] },
  { table: "meta_lead_ads_connections", pk: ["user_id"], columns: ["page_access_token_enc"] },
  { table: "google_lsa_connections", pk: ["user_id"], columns: ["refresh_token_enc"] },
];

function key(name: string): Buffer {
  const k = Buffer.from(process.env[name] ?? "", "hex");
  if (k.length !== 32) {
    console.error(`${name} must be 64 hex chars (openssl rand -hex 32)`);
    process.exit(2);
  }
  return k;
}

function decrypt(payload: string, k: Buffer): string | null {
  try {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const d = createDecipheriv(ALGO, k, Buffer.from(ivB64, "base64"));
    d.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([d.update(Buffer.from(dataB64, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function encrypt(plaintext: string, k: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv(ALGO, k, iv);
  const enc = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

async function main(): Promise<void> {
  const oldKey = key("OLD_TOKEN_ENCRYPTION_KEY");
  const newKey = key("NEW_TOKEN_ENCRYPTION_KEY");
  if (oldKey.equals(newKey)) {
    console.error("old and new keys are identical");
    process.exit(2);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(2);
  }
  const apply = process.argv.includes("--apply");
  const skipUndecryptable = process.argv.includes("--skip-undecryptable");
  const userIdx = process.argv.indexOf("--user");
  const onlyUser = userIdx === -1 ? undefined : process.argv[userIdx + 1];
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });
  const client = await pool.connect();
  let rotated = 0;
  let alreadyNew = 0;
  const undecryptable: string[] = [];
  const updates: { table: string; pk: string[]; id: unknown[]; column: string; value: string }[] = [];
  try {
    for (const { table, pk, columns } of COLUMNS) {
      const { rows } = await client.query<Record<string, unknown>>(
        `select ${[...pk, ...columns].map((c) => `"${c}"`).join(", ")} from "public"."${table}"${onlyUser ? ' where "user_id" = $1' : ""}`,
        onlyUser ? [onlyUser] : [],
      );
      for (const row of rows) {
        for (const column of columns) {
          const value = row[column];
          if (typeof value !== "string" || !value) continue;
          if (decrypt(value, newKey) !== null) {
            alreadyNew++;
            continue;
          }
          const plain = decrypt(value, oldKey);
          if (plain === null) {
            undecryptable.push(`${table}.${column} ${pk.map((k) => `${k}=${String(row[k])}`).join(" ")}`);
            continue;
          }
          updates.push({ table, pk, id: pk.map((k) => row[k]), column, value: encrypt(plain, newKey) });
          rotated++;
        }
      }
      console.log(`  ${table.padEnd(28)} ${rows.length} row(s)`);
    }
    console.log(`\n${rotated} value(s) to rotate, ${alreadyNew} already under the new key, ${undecryptable.length} undecryptable`);
    for (const u of undecryptable) console.log(`  cannot decrypt: ${u}`);
    if (undecryptable.length && !skipUndecryptable) {
      console.error("\nrefusing to write: some values decrypt with neither key. Those connections must be re-authorised by their owners (Settings → Integrations) — or the OLD key is wrong.");
      process.exit(1);
    }
    if (undecryptable.length) console.warn("--skip-undecryptable: the rows above are left as they are; their owners must reconnect the integration.");
    if (!apply) {
      console.log("\ndry run — re-run with --apply to write");
      return;
    }
    await client.query("BEGIN");
    for (const u of updates) {
      const where = u.pk.map((k, i) => `"${k}" = $${i + 2}`).join(" and ");
      await client.query(`update "public"."${u.table}" set "${u.column}" = $1 where ${where}`, [u.value, ...u.id]);
    }
    await client.query("COMMIT");
    console.log(`\napplied: ${updates.length} value(s) re-encrypted. Now set TOKEN_ENCRYPTION_KEY to the new key in Vercel and redeploy; then run this again (dry run) to confirm 0 left.`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("rotate-token-key failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
