// Phase 69 (docs/QA-VERIFICATION-PLAN.md): restore a scripts/backup.ts
// backup into a Postgres database. Pure Node (no psql/pg_restore).
//
//   pnpm --filter @workspace/api-server ops:restore --from .backups/<stamp> --target <DATABASE_URL> --yes [--wipe | --truncate] [--data-only] [--storage]
//
//   --wipe        DROP SCHEMA public CASCADE and rebuild it from lib/db/drizzle/*.sql (a scratch project)
//   --truncate    keep the schema, empty every table in the backup, then load
//   (neither)     the target's public schema must be empty of tables
//   --data-only   skip the migrations (schema already applied)
//   --storage     also upload storage/<bucket>/** to RESTORE_SUPABASE_URL / RESTORE_SUPABASE_SERVICE_ROLE_KEY
//   BACKUP_PASSPHRASE   to decrypt an encrypted backup
//   --verify      no database: decrypt + gunzip every table file, check its sha256 and
//                 row count against the manifest (the nightly workflow runs this)
//
// Refuses to run against the backup's own source (same host + database)
// unless --allow-same-source is given — a restore over production is the
// one action this script must never do by accident.
//
// Order of operations: migrations → schema check against the manifest →
// COPY every table FROM STDIN in foreign-key order (session_replication_role
// = replica when the role may set it, so cycles and self-references load
// too) → sequences → row-count verification. Everything data-related runs in
// one transaction: a failure leaves the target untouched.

import { createDecipheriv, scryptSync } from "node:crypto";
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import pg from "pg";
import { from as copyFrom } from "pg-copy-streams";
import type { Manifest } from "./backup.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const MIGRATIONS_DIR = join(ROOT, "lib/db/drizzle");

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name: string) => args.includes(name);

const from = flag("--from");
const target = flag("--target") ?? process.env.RESTORE_DATABASE_URL;
const verifyOnly = has("--verify");
if (!from || (!target && !verifyOnly)) {
  console.error("restore: --from <backup dir> and --target <DATABASE_URL> (or RESTORE_DATABASE_URL) are required");
  process.exit(2);
}
if (!has("--yes") && !verifyOnly) {
  console.error("restore: refusing without --yes (this rewrites the target database)");
  process.exit(2);
}
const backupDir = resolve(ROOT, from);
const manifest = JSON.parse(readFileSync(join(backupDir, "manifest.json"), "utf8")) as Manifest;
const passphrase = process.env.BACKUP_PASSPHRASE;
if (manifest.encrypted && !passphrase) {
  console.error("restore: backup is encrypted — set BACKUP_PASSPHRASE");
  process.exit(2);
}

const targetUrl = new URL(target ?? "postgres://verify-only/none");
if (!verifyOnly && targetUrl.hostname === manifest.source.host && targetUrl.pathname.replace(/^\//, "") === manifest.source.database && !has("--allow-same-source")) {
  console.error(`restore: target ${targetUrl.hostname} is the backup's source — pass --allow-same-source if you really mean to overwrite it`);
  process.exit(2);
}

function readData(rel: string): Buffer {
  const abs = join(backupDir, rel);
  const raw = readFileSync(abs);
  if (!rel.endsWith(".enc")) return raw;
  if (raw.subarray(0, 5).toString() !== "QAIB1") throw new Error(`${rel}: not a QuoteAI encrypted file`);
  const salt = raw.subarray(5, 21);
  const iv = raw.subarray(21, 33);
  const tag = raw.subarray(33, 49);
  const body = raw.subarray(49);
  const decipher = createDecipheriv("aes-256-gcm", scryptSync(passphrase!, salt, 32), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

async function applyMigrations(client: pg.PoolClient): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR).filter((n) => /^\d{4}_.*\.sql$/.test(n)).sort();
  const missing = manifest.migrations.filter((m) => !files.includes(m.file)).map((m) => m.file);
  if (missing.length) throw new Error(`migrations in the manifest are not in the checkout: ${missing.join(", ")} — check out the commit the backup was taken from`);
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8").replace(/^\uFEFF/, "").replace(/-->\s*statement-breakpoint/g, "");
    process.stdout.write(`  migration ${f}\n`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`migration ${f} failed: ${(err as Error).message}`, { cause: err });
    }
  }
}

/** Tables ordered so that every foreign-key parent precedes its children (cycles broken, reported). */
function fkOrder(constraints: { table_name: string; constraint_type: string; ref_table: string | null }[], tables: string[]): { order: string[]; cyclic: string[] } {
  const deps = new Map<string, Set<string>>(tables.map((t) => [t, new Set()]));
  for (const c of constraints) {
    if (c.constraint_type !== "FOREIGN KEY" || !c.ref_table || c.ref_table === c.table_name) continue;
    if (deps.has(c.table_name) && deps.has(c.ref_table)) deps.get(c.table_name)!.add(c.ref_table);
  }
  const order: string[] = [];
  const done = new Set<string>();
  let progress = true;
  while (progress) {
    progress = false;
    for (const t of tables) {
      if (done.has(t)) continue;
      if ([...deps.get(t)!].every((d) => done.has(d))) {
        order.push(t);
        done.add(t);
        progress = true;
      }
    }
  }
  const cyclic = tables.filter((t) => !done.has(t));
  return { order: [...order, ...cyclic], cyclic };
}

async function loadData(client: pg.PoolClient): Promise<void> {
  const tables = manifest.tables.map((t) => t.name);
  const { rows: existing } = await client.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'");
  const present = new Set(existing.map((r) => r.table_name));
  const absent = tables.filter((t) => !present.has(t));
  if (absent.length) throw new Error(`target is missing tables from the backup: ${absent.join(", ")} (apply the migrations first / drop --data-only)`);

  // Schema check: every column the backup has must exist on the target with the same type.
  const { rows: cols } = await client.query<{ table_name: string; column_name: string; udt_name: string }>(
    "select table_name, column_name, udt_name from information_schema.columns where table_schema='public'",
  );
  const have = new Set(cols.map((c) => `${c.table_name}.${c.column_name}:${c.udt_name}`));
  const mismatched = (manifest.schema.columns as { table_name: string; column_name: string; udt_name: string }[])
    .filter((c) => tables.includes(c.table_name) && !have.has(`${c.table_name}.${c.column_name}:${c.udt_name}`))
    .map((c) => `${c.table_name}.${c.column_name} (${c.udt_name})`);
  if (mismatched.length) throw new Error(`target schema differs from the backup's: ${mismatched.slice(0, 10).join(", ")}${mismatched.length > 10 ? ` (+${mismatched.length - 10})` : ""}`);

  const { rows: cons } = await client.query<{ table_name: string; constraint_type: string; ref_table: string | null }>(
    "select tc.table_name, tc.constraint_type, ccu.table_name as ref_table from information_schema.table_constraints tc left join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name where tc.table_schema='public' and tc.constraint_type='FOREIGN KEY'",
  );
  const { order, cyclic } = fkOrder(cons, tables);

  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout = 0");
    let replica = false;
    try {
      await client.query("SET LOCAL session_replication_role = 'replica'");
      replica = true;
    } catch {
      if (cyclic.length) console.warn(`  role cannot disable FK triggers and these tables reference each other in a cycle: ${cyclic.join(", ")} — the load may fail on them`);
    }
    if (has("--truncate")) {
      await client.query(`TRUNCATE ${tables.map((t) => `"public"."${t}"`).join(", ")} CASCADE`);
    } else if (!has("--wipe")) {
      const { rows: [nonEmpty] } = await client.query<{ n: string }>(
        `select count(*)::text as n from (${tables.map((t) => `select 1 from "public"."${t}" limit 1`).join(" union all ")}) s`,
      );
      if (Number(nonEmpty!.n) > 0) throw new Error("target has data — pass --truncate to empty the backup's tables first, or --wipe to rebuild the schema");
    }
    for (const t of order) {
      const entry = manifest.tables.find((m) => m.name === t)!;
      const stream = client.query(copyFrom(`COPY "public"."${t}" FROM STDIN WITH (FORMAT csv, HEADER)`));
      const source = entry.file.endsWith(".enc") ? Readable.from([readData(entry.file)]) : createReadStream(join(backupDir, entry.file));
      await pipeline(source, createGunzip(), stream);
      const { rows: [cnt] } = await client.query<{ n: string }>(`select count(*)::text as n from "public"."${t}"`);
      const ok = Number(cnt!.n) === entry.rows;
      process.stdout.write(`  ${t.padEnd(36)} ${String(cnt!.n).padStart(8)} / ${String(entry.rows).padStart(8)} ${ok ? "ok" : "MISMATCH"}\n`);
      if (!ok) throw new Error(`row count mismatch on ${t}`);
    }
    for (const s of manifest.sequences) {
      if (s.lastValue === null) continue;
      await client.query(`select setval('"public"."${s.name}"', $1, true)`, [s.lastValue]);
    }
    await client.query("COMMIT");
    console.log(`  data loaded (${replica ? "FK triggers disabled during load" : "FK order only"})`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function wipe(client: pg.PoolClient): Promise<void> {
  console.log("  dropping schema public");
  await client.query("DROP SCHEMA public CASCADE");
  await client.query("CREATE SCHEMA public");
  // Supabase's default grants on public, best-effort (roles may not exist off-Supabase).
  for (const sql of [
    "GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role",
    "GRANT ALL ON SCHEMA public TO postgres, service_role",
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role",
  ]) {
    await client.query(sql).catch(() => undefined);
  }
}

async function restoreStorage(): Promise<void> {
  const url = process.env.RESTORE_SUPABASE_URL;
  const key = process.env.RESTORE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("--storage needs RESTORE_SUPABASE_URL and RESTORE_SUPABASE_SERVICE_ROLE_KEY");
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const root = join(backupDir, "storage");
  if (!existsSync(root)) {
    console.log("  no storage/ in the backup");
    return;
  }
  for (const bucket of readdirSync(root)) {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.name === bucket)) {
      const { error } = await supabase.storage.createBucket(bucket, { public: bucket.startsWith("public") });
      if (error) throw new Error(`createBucket ${bucket}: ${error.message}`);
    }
    let n = 0;
    const walk = async (dir: string): Promise<void> => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          await walk(p);
          continue;
        }
        const rel = relative(join(root, bucket), p).replace(/\\/g, "/").replace(/\.enc$/, "");
        const { error } = await supabase.storage.from(bucket).upload(rel, readData(relative(backupDir, p)), { upsert: true });
        if (error) throw new Error(`upload ${bucket}/${rel}: ${error.message}`);
        n++;
      }
    };
    await walk(join(root, bucket));
    console.log(`  storage/${bucket}: ${n} object(s) uploaded`);
  }
}

/** CSV rows in a buffer, honouring quoted fields that span lines; minus the header. */
function csvRows(buf: Buffer): number {
  let rows = 0;
  let quoted = false;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c === 0x22) quoted = !quoted; // a doubled quote toggles twice — net zero, correct
    else if (c === 0x0a && !quoted) rows++;
  }
  return Math.max(0, rows - 1);
}

async function verify(): Promise<void> {
  const { gunzipSync } = await import("node:zlib");
  const { createHash } = await import("node:crypto");
  let bad = 0;
  for (const t of manifest.tables) {
    const stored = readFileSync(join(backupDir, t.file));
    const sha = createHash("sha256").update(t.file.endsWith(".enc") ? readData(t.file) : stored).digest("hex");
    const rows = csvRows(gunzipSync(readData(t.file)));
    const ok = sha === t.sha256 && rows === t.rows;
    if (!ok) bad++;
    process.stdout.write(`  ${t.name.padEnd(36)} ${String(rows).padStart(8)} / ${String(t.rows).padStart(8)} ${ok ? "ok" : sha !== t.sha256 ? "SHA MISMATCH" : "ROW MISMATCH"}
`);
  }
  if (bad) throw new Error(`${bad} table file(s) failed verification`);
  console.log(`verify: ${manifest.tables.length} table files readable, hashes and row counts match the manifest (${manifest.encrypted ? "encrypted" : "plain"})`);
}

async function main(): Promise<void> {
  if (verifyOnly) {
    await verify();
    return;
  }
  console.log(`restore: ${backupDir} (taken ${manifest.createdAt} from ${manifest.source.host}) → ${targetUrl.hostname}/${targetUrl.pathname.replace(/^\//, "")}`);
  const pool = new pg.Pool({ connectionString: target, ssl: { rejectUnauthorized: false }, max: 1 });
  const client = await pool.connect();
  try {
    if (has("--wipe")) await wipe(client);
    if (!has("--data-only")) await applyMigrations(client);
    await loadData(client);
  } finally {
    client.release();
    await pool.end();
  }
  if (has("--storage")) await restoreStorage();
  console.log("restore: done — run `pnpm --filter @workspace/db schema-drift` with DATABASE_URL=<target> to double-check the schema");
}

main().catch((err) => {
  console.error("restore failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
