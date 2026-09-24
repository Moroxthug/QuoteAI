// Phase 98 (docs/LAUNCH-FINISH-PLAN.md): the restore rehearsal (Phase 99 L-2,
// go/no-go 1.2) as one command, so the owner's part is only the target URL.
//
//   pnpm --filter @workspace/api-server ops:rehearse --target "postgresql://postgres.<ref>:<pw>@…pooler.supabase.com:5432/postgres" [--from .backups/<dir>] [--storage]
//
// 1. backup   a fresh backup of production (DATABASE_URL from .env.staging) into
//             .backups/rehearsal-<stamp>, unless --from names an existing one
//             (e.g. an unzipped nightly artifact — the truer test). Storage is
//             skipped unless --storage (then RESTORE_SUPABASE_URL / _SERVICE_ROLE_KEY).
// 2. restore  ops:restore --wipe into the target: schema from the migrations,
//             every table in foreign-key order, sequences, row counts compared.
// 3. drift    lib/db schema-drift against the target.
// 4. record   one row appended to docs/RESTORE-REHEARSALS.md (pass or fail,
//             timings, row counts) — `ops:owner-check` reads it for L-2.
//
// The target is wiped. restore.ts refuses the backup's own source, so pointing
// this at production by mistake stops at step 2 without touching it.

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { loadDotenv, STAGING_ENV_PATH } from "../src/e2e/qaEnv.js";
import type { Manifest } from "./backup.js";

loadDotenv(STAGING_ENV_PATH);

const ROOT = resolve(import.meta.dirname, "../../..");
const LOG = join(ROOT, "docs/RESTORE-REHEARSALS.md");
const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};

const target = flag("--target") ?? process.env.RESTORE_DATABASE_URL;
if (!target) {
  console.error("rehearse: --target <pooler DATABASE_URL of the scratch project> (or RESTORE_DATABASE_URL) is required");
  process.exit(2);
}
const withStorage = argv.includes("--storage");
const targetHost = (() => {
  try {
    const u = new URL(target);
    return `${u.username.split(".")[1] ?? u.hostname}`; // the Supabase project ref, not the password
  } catch {
    return "?";
  }
})();

// The target URL travels in the environment, never on a command line: cmd.exe
// would mangle a password containing & or %, and argv shows up in process lists.
function step(name: string, args: string[], env: NodeJS.ProcessEnv = {}): { ok: boolean; ms: number; tail: string } {
  console.log(`\n── ${name} ─────────────────────────────`);
  const t0 = Date.now();
  const r = spawnSync("pnpm", args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: process.platform === "win32", // pnpm is a .cmd here
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  process.stdout.write(out);
  // The last line the script itself printed, not pnpm's "Exit status 1" wrapper.
  const tail = out.trim().split(/\r?\n/).filter((l) => l && !/ERR_PNPM|^Exit status|^\$ |^[A-Z]:\\/.test(l)).at(-1) ?? "";
  return { ok: r.status === 0, ms: Date.now() - t0, tail };
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
let from = flag("--from");
let backupMs = 0;
if (!from) {
  from = join(".backups", `rehearsal-${stamp}`);
  const b = step("1. backup production", ["--filter", "@workspace/api-server", "ops:backup", "--out", from, ...(withStorage ? [] : ["--no-storage"])]);
  backupMs = b.ms;
  if (!b.ok) finish("fail", `backup: ${b.tail}`);
}
const backupDir = resolve(ROOT, from);
if (!existsSync(join(backupDir, "manifest.json"))) finish("fail", `no manifest.json in ${from}`);
const manifest = JSON.parse(readFileSync(join(backupDir, "manifest.json"), "utf8")) as Manifest;

const r = step("2. restore into the target (--wipe)", ["--filter", "@workspace/api-server", "ops:restore", "--from", backupDir, "--yes", "--wipe", ...(withStorage ? ["--storage"] : [])], { RESTORE_DATABASE_URL: target });
if (!r.ok) finish("fail", r.tail, r.ms);

const d = step("3. schema drift on the target", ["--filter", "@workspace/db", "schema-drift"], { DATABASE_URL: target });
if (!d.ok) finish("fail", `schema drift: ${d.tail}`, r.ms);

finish("pass", "restored, row counts and schema match", r.ms);

function finish(result: "pass" | "fail", note: string, restoreMs = 0): never {
  const rows = manifestSummary();
  if (!existsSync(LOG)) {
    writeFileSync(
      LOG,
      "# Restore rehearsals\n\nOne row per `pnpm --filter @workspace/api-server ops:rehearse` run (Phase 98). A backup nobody has restored is not a backup: go/no-go 1.2 and Phase 99 L-2 are closed by a `pass` row here, and `ops:owner-check` reads this file. Rehearse again after any large migration and at least every quarter.\n\n| Date | Result | Backup | Target project | Tables / rows | Backup time | Restore time | Note |\n|---|---|---|---|---|---|---|---|\n",
    );
  }
  const backupLabel = relative(ROOT, backupDir).replace(/\\/g, "/");
  const line = `| ${new Date().toISOString().slice(0, 10)} | ${result} | \`${backupLabel}\`${rows.createdAt ? ` (taken ${rows.createdAt})` : ""} | ${targetHost} | ${rows.tables} / ${rows.rows} | ${backupMs ? `${Math.round(backupMs / 1000)} s` : "—"} | ${restoreMs ? `${Math.round(restoreMs / 1000)} s` : "—"} | ${note.replace(/\|/g, "/").slice(0, 200)} |\n`;
  appendFileSync(LOG, line);
  console.log(`\nrehearse: ${result.toUpperCase()} — ${note}\nrecorded in docs/RESTORE-REHEARSALS.md`);
  process.exit(result === "pass" ? 0 : 1);
}

function manifestSummary(): { tables: number | string; rows: number | string; createdAt?: string } {
  try {
    const m: Manifest = manifest;
    return { tables: m.tables.length, rows: m.tables.reduce((n, t) => n + t.rows, 0), createdAt: m.createdAt.slice(0, 16).replace("T", " ") };
  } catch {
    return { tables: "?", rows: "?" };
  }
}
