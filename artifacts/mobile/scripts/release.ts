// Phase 123: a signed release bundle (.aab) for Google Play, built on this computer.
//
//   pnpm --filter @workspace/mobile android:bundle            # version name 0.1.<version code>
//   pnpm --filter @workspace/mobile android:bundle -- 1.0.0   # a version name of your choosing
//
// Reads the upload key from ~/.quoteai-keys/upload.properties (made by
// `pnpm --filter @workspace/mobile upload-key`), builds the app against the
// production API (VITE_API_ORIGIN, default https://quoteai.ca) and signs the
// bundle. The version code is the minutes since 2026-01-01 UTC — the same rule
// as CI (build.gradle), so every build, here or there, is newer than the last
// and Play never refuses an upload for a reused number.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const props = path.join(homedir(), ".quoteai-keys", "upload.properties");
if (!existsSync(props)) {
  console.error(`No upload key at ${props} — run: pnpm --filter @workspace/mobile upload-key`);
  process.exit(1);
}
const kv = Object.fromEntries(
  readFileSync(props, "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const versionCode = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 60_000);
const versionName = process.argv.slice(2).find((a) => /^\d+\.\d+\.\d+/.test(a)) ?? `0.1.${versionCode}`;
const env = {
  ...process.env,
  ANDROID_KEYSTORE_PATH: kv.storeFile!,
  ANDROID_KEYSTORE_PASSWORD: kv.storePassword!,
  ANDROID_KEY_ALIAS: kv.keyAlias!,
  ANDROID_KEY_PASSWORD: kv.keyPassword!,
  ANDROID_VERSION_CODE: String(versionCode),
  ANDROID_VERSION_NAME: versionName,
};
const root = path.resolve(import.meta.dirname, "..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
execFileSync(pnpm, ["run", "sync"], { cwd: root, stdio: "inherit", env, shell: process.platform === "win32" });
execFileSync(process.execPath, [path.join(root, "node_modules/tsx/dist/cli.mjs"), path.join(root, "scripts/gradle.ts"), "bundleRelease"], { cwd: root, stdio: "inherit", env });

const aab = path.join(root, "android/app/build/outputs/bundle/release/app-release.aab");
console.log(`\nSigned bundle: ${aab} (${(statSync(aab).size / 1024 / 1024).toFixed(1)} MB) — version ${versionName} (code ${versionCode})`);
console.log("Upload it in Play Console → Test and release → Testing → Internal testing → Create new release.");
