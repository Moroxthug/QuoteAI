#!/usr/bin/env node
// Phase 69 (docs/QA-VERIFICATION-PLAN.md): source maps for error tracking.
//
// Runs at the end of each app's build. With SENTRY_AUTH_TOKEN + SENTRY_ORG +
// SENTRY_PROJECT set (Vercel → Settings → Environment Variables, build-time
// is enough) it:
//   1. `sentry-cli sourcemaps inject` — stamps every JS file and its map with
//      a debug id (the `_sentryDebugIds` registry @workspace/error-reporting
//      reads at runtime), so Sentry can symbolicate without release/URL
//      matching;
//   2. `sentry-cli sourcemaps upload` — ships the maps, tagged with the
//      commit as release;
//   3. with --delete-maps, removes the .map files afterwards so the public
//      build never serves them.
// Without the token it prints one line and exits 0 — local builds and CI
// are unaffected. `npx` fetches @sentry/cli on demand, so nothing is added to
// the install (its postinstall would otherwise download a 20 MB binary on
// every `pnpm install`).
//
// Usage: node scripts/sentry-sourcemaps.mjs [--delete-maps] [--ext mjs] <path>...

import { spawnSync } from "node:child_process";
import { readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const deleteMaps = args.includes("--delete-maps");
const exts = [];
const paths = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--delete-maps") continue;
  if (args[i] === "--ext") {
    exts.push(args[++i]);
    continue;
  }
  paths.push(args[i]);
}
if (paths.length === 0) {
  console.error("sentry-sourcemaps: no paths given");
  process.exit(2);
}

const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = process.env;
if (!SENTRY_AUTH_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT) {
  console.log("sentry-sourcemaps: SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT not set — skipped (no debug ids, no upload)");
  process.exit(0);
}

const release = process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "";
const extArgs = exts.flatMap((e) => ["--ext", e]);

function cli(...cmd) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const res = spawnSync(npx, ["--yes", "@sentry/cli@2", ...cmd], { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
  if (res.status !== 0) {
    console.error(`sentry-sourcemaps: sentry-cli ${cmd[0]} ${cmd[1]} failed (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
}

cli("sourcemaps", "inject", ...extArgs, ...paths);
cli("sourcemaps", "upload", ...(release ? ["--release", release] : []), ...extArgs, ...paths);

if (deleteMaps) {
  let removed = 0;
  const walk = (p) => {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const name of readdirSync(p)) walk(join(p, name));
    } else if (p.endsWith(".map")) {
      unlinkSync(p);
      removed++;
    }
  };
  for (const p of paths) walk(p);
  console.log(`sentry-sourcemaps: uploaded for release "${release || "(none)"}", removed ${removed} .map file(s) from the deployable output`);
}
