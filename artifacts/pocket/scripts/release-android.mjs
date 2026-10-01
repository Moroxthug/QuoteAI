// Phase 123.4: a signed release bundle (.aab) for Google Play, built on this computer.
//
//   npm run release:android              # version name 0.1.0.<version code>
//   npm run release:android -- 1.0.0     # a version name of your choosing
//   npm run release:android -- --no-prebuild   # retry Gradle without regenerating android/
//
// Reads the Play upload key from ~/.quoteai-keys/upload.properties (the same key as the
// Capacitor app, docs/RUNBOOKS.md "The phone app"), regenerates android/ with
// `expo prebuild` (plugins/with-release.js writes the signing and the version code), and
// runs Gradle's bundleRelease with Android Studio's JDK and the standard SDK folder when
// JAVA_HOME / ANDROID_HOME are unset. The bundle
// lands in android/app/build/outputs/bundle/release/app-release.aab.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const props = path.join(homedir(), ".quoteai-keys", "upload.properties");
if (!existsSync(props)) {
  console.error(`No upload key at ${props}. It is made once by: pnpm --filter @workspace/mobile upload-key`);
  process.exit(1);
}
const kv = Object.fromEntries(
  readFileSync(props, "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const versionCode = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 60_000);
const versionName = process.argv.slice(2).find((a) => /^\d+\.\d+\.\d+/.test(a)) ?? `0.1.0.${versionCode}`;
const studioJdk = "C:/Program Files/Android/Android Studio/jbr";
const sdk = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk") : "";
const env = {
  ...process.env,
  ANDROID_KEYSTORE_PATH: kv.storeFile,
  ANDROID_KEYSTORE_PASSWORD: kv.storePassword,
  ANDROID_KEY_ALIAS: kv.keyAlias,
  ANDROID_KEY_PASSWORD: kv.keyPassword,
  ANDROID_VERSION_CODE: String(versionCode),
  ANDROID_VERSION_NAME: versionName,
  NODE_ENV: "production",
  // Source maps go to Sentry only when its auth token is set (and the DSN, EXPO_PUBLIC_SENTRY_DSN).
  ...(!process.env.SENTRY_AUTH_TOKEN ? { SENTRY_DISABLE_AUTO_UPLOAD: "true" } : {}),
  ...(!process.env.JAVA_HOME && process.platform === "win32" && existsSync(studioJdk) ? { JAVA_HOME: studioJdk } : {}),
  // prebuild clears android/local.properties, so point Gradle at the SDK.
  ...(!process.env.ANDROID_HOME && sdk && existsSync(sdk) ? { ANDROID_HOME: sdk } : {}),
};

const win = process.platform === "win32";
if (!process.argv.includes("--no-prebuild")) execFileSync(win ? "npx.cmd" : "npx", ["expo", "prebuild", "--platform", "android", "--no-install"], { cwd: root, stdio: "inherit", env, shell: win });
execFileSync(path.join(root, "android", win ? "gradlew.bat" : "gradlew"), ["bundleRelease", "--no-daemon", "--max-workers=2"], { cwd: path.join(root, "android"), stdio: "inherit", env, shell: win });

const aab = path.join(root, "android/app/build/outputs/bundle/release/app-release.aab");
console.log(`\nSigned bundle: ${aab} (${(statSync(aab).size / 1e6).toFixed(1)} MB), version code ${versionCode}, version ${versionName}.`);
console.log("Upload it in Play Console → Testing → Closed testing → Create new release, or share it through Internal app sharing.");
