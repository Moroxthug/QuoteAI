// Phase 69 (docs/QA-VERIFICATION-PLAN.md): logical backup of the production
// database (+ Storage objects) in plain Node — no pg_dump, no Docker, so it
// runs from any machine with the repo and on the nightly GitHub Action.
//
// The Supabase Free plan has NO automatic backups and no PITR; this is the
// backup until the project moves to Pro (daily backups) — and after that,
// still the only copy that lives outside Supabase.
//
//   pnpm --filter @workspace/api-server ops:backup [--out .backups/<stamp>] [--no-storage]
//     DATABASE_URL          source (or --source <url>); read from .env.staging when unset
//     SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY   for Storage (skipped with --no-storage)
//     BACKUP_PASSPHRASE     encrypts every data file (AES-256-GCM, scrypt); manifest stays readable
//
// Output:
//   manifest.json      tables/rows/bytes/sha256, sequences, migration list, schema introspection
//   tables/<t>.csv.gz  COPY … TO STDOUT (FORMAT csv, HEADER) — one consistent snapshot
//   storage/<bucket>/<path>   every object of both buckets
// Restore with scripts/restore.ts (pnpm ops:restore) — rehearsed in Phase 69.

import { createHash, randomBytes, scryptSync, createCipheriv } from "node:crypto";
import { createWriteStream, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import pg from "pg";
import { to as copyTo } from "pg-copy-streams";
import { loadDotenv, STAGING_ENV_PATH } from "../src/e2e/qaEnv.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const MIGRATIONS_DIR = join(ROOT, "lib/db/drizzle");

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name: string) => args.includes(name);

loadDotenv(STAGING_ENV_PATH);
const source = flag("--source") ?? process.env.DATABASE_URL;
if (!source) {
  console.error("backup: DATABASE_URL (or --source) is required");
  process.exit(2);
}
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = resolve(ROOT, flag("--out") ?? join(".backups", stamp));
const withStorage = !has("--no-storage");
const passphrase = process.env.BACKUP_PASSPHRASE;

// The same introspection schema-drift.ts uses, so a restore can be verified
// against what the source looked like at backup time.
const SCHEMA_SQL = {
  columns:
    "select table_name, column_name, data_type, udt_name, is_nullable, column_default from information_schema.columns where table_schema='public' order by table_name, ordinal_position",
  enums:
    "select t.typname as enum_name, string_agg(e.enumlabel, ',' order by e.enumsortorder) as labels from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname order by 1",
  constraints:
    "select tc.table_name, tc.constraint_type, kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_column from information_schema.table_constraints tc join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.table_schema=tc.table_schema left join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and tc.constraint_type='FOREIGN KEY' where tc.table_schema='public' and tc.constraint_type in ('PRIMARY KEY','FOREIGN KEY','UNIQUE') order by 1,2,3",
  indexes: "select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by 1,2",
};

export type Manifest = {
  version: 1;
  createdAt: string;
  source: { host: string; database: string };
  pgVersion: string;
  encrypted: boolean;
  tables: { name: string; rows: number; bytes: number; sha256: string; file: string }[];
  sequences: { name: string; lastValue: number | null }[];
  migrations: { file: string; sha256: string }[];
  schema: { columns: unknown[]; enums: unknown[]; constraints: unknown[]; indexes: unknown[] };
  storage: { bucket: string; objects: number; bytes: number }[];
};

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** AES-256-GCM: [magic "QAIB1"][16 salt][12 iv][16 tag][ciphertext]. */
function encryptFile(path: string, pass: string): void {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(pass, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plain = readFileSync(path);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  writeFileSync(`${path}.enc`, Buffer.concat([Buffer.from("QAIB1"), salt, iv, tag, enc]));
  unlinkSync(path);
}

async function dumpTables(client: pg.PoolClient, manifest: Manifest): Promise<void> {
  const { rows: tables } = await client.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name",
  );
  mkdirSync(join(outDir, "tables"), { recursive: true });
  for (const { table_name } of tables) {
    const file = join("tables", `${table_name}.csv.gz`);
    const abs = join(outDir, file);
    const { rows: [cnt] } = await client.query<{ n: string }>(`select count(*)::text as n from "public"."${table_name}"`);
    const stream = client.query(copyTo(`COPY "public"."${table_name}" TO STDOUT WITH (FORMAT csv, HEADER)`));
    await pipeline(stream, createGzip({ level: 6 }), createWriteStream(abs));
    const bytes = statSync(abs).size;
    manifest.tables.push({ name: table_name, rows: Number(cnt!.n), bytes, sha256: sha256File(abs), file: file.replace(/\\/g, "/") });
    process.stdout.write(`  ${table_name.padEnd(36)} ${String(cnt!.n).padStart(8)} rows ${String(bytes).padStart(10)} B\n`);
  }
}

async function dumpStorage(manifest: Manifest): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("backup: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — Storage skipped");
    return;
  }
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const buckets = [process.env.SUPABASE_PUBLIC_BUCKET ?? "public-assets", process.env.SUPABASE_PRIVATE_BUCKET ?? "private-assets"];
  for (const bucket of buckets) {
    let objects = 0;
    let bytes = 0;
    const walk = async (prefix: string): Promise<void> => {
      let offset = 0;
      for (;;) {
        const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset });
        if (error) throw new Error(`Storage list ${bucket}/${prefix}: ${error.message}`);
        if (!data || data.length === 0) break;
        for (const entry of data) {
          const path = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (!entry.id) {
            await walk(path); // folder
            continue;
          }
          const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
          if (dlErr || !blob) throw new Error(`Storage download ${bucket}/${path}: ${dlErr?.message}`);
          const buf = Buffer.from(await blob.arrayBuffer());
          const abs = join(outDir, "storage", bucket, path);
          mkdirSync(dirname(abs), { recursive: true });
          writeFileSync(abs, buf);
          objects++;
          bytes += buf.length;
        }
        if (data.length < 1000) break;
        offset += data.length;
      }
    };
    await walk("");
    manifest.storage.push({ bucket, objects, bytes });
    console.log(`  storage/${bucket}: ${objects} object(s), ${bytes} B`);
  }
}

async function main(): Promise<void> {
  const pool = new pg.Pool({ connectionString: source, ssl: { rejectUnauthorized: false }, max: 1 });
  const client = await pool.connect();
  const u = new URL(source!);
  const manifest: Manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    source: { host: u.hostname, database: u.pathname.replace(/^\//, "") },
    pgVersion: "",
    encrypted: Boolean(passphrase),
    tables: [],
    sequences: [],
    migrations: [],
    schema: { columns: [], enums: [], constraints: [], indexes: [] },
    storage: [],
  };
  mkdirSync(outDir, { recursive: true });
  console.log(`backup: ${manifest.source.host}/${manifest.source.database} → ${outDir}`);
  try {
    // One repeatable-read snapshot for every table: a row inserted while the
    // dump runs is either in all related tables or in none of them.
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = 0");
    manifest.pgVersion = (await client.query<{ v: string }>("select version() as v")).rows[0]!.v;
    for (const [k, sql] of Object.entries(SCHEMA_SQL)) {
      (manifest.schema as Record<string, unknown[]>)[k] = (await client.query(sql)).rows;
    }
    manifest.sequences = (
      await client.query<{ name: string; last_value: string | null }>("select sequencename as name, last_value from pg_sequences where schemaname='public' order by 1")
    ).rows.map((r) => ({ name: r.name, lastValue: r.last_value === null ? null : Number(r.last_value) }));
    await dumpTables(client, manifest);
    await client.query("COMMIT");
  } finally {
    client.release();
    await pool.end();
  }

  for (const f of readdirSync(MIGRATIONS_DIR).filter((n) => /^\d{4}_.*\.sql$/.test(n)).sort()) {
    manifest.migrations.push({ file: f, sha256: sha256File(join(MIGRATIONS_DIR, f)) });
  }

  if (withStorage) await dumpStorage(manifest);

  if (passphrase) {
    const encryptDir = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) encryptDir(p);
        else if (basename(p) !== "manifest.json" && !p.endsWith(".enc")) encryptFile(p, passphrase);
      }
    };
    encryptDir(outDir);
    for (const t of manifest.tables) t.file = `${t.file}.enc`;
    console.log("backup: data files encrypted (BACKUP_PASSPHRASE)");
  }

  const tmp = join(outDir, "manifest.json.tmp");
  writeFileSync(tmp, JSON.stringify(manifest, null, 2));
  renameSync(tmp, join(outDir, "manifest.json"));
  const rows = manifest.tables.reduce((a, t) => a + t.rows, 0);
  const bytes = manifest.tables.reduce((a, t) => a + t.bytes, 0);
  console.log(`backup: done — ${manifest.tables.length} tables, ${rows} rows, ${(bytes / 1024).toFixed(1)} KiB compressed, ${manifest.storage.reduce((a, s) => a + s.objects, 0)} storage object(s)`);
  console.log(`backup: manifest ${join(outDir, "manifest.json")}`);
}

main().catch((err) => {
  console.error("backup failed:", err);
  process.exit(1);
});
