// Phase 123: creates the Play upload key once, outside the repo.
//
//   pnpm --filter @workspace/mobile upload-key
//
// Writes ~/.quoteai-keys/quoteai-upload.jks and ~/.quoteai-keys/upload.properties
// (the password, generated here and never printed). Google Play keeps the key
// that signs what phones install (Play App Signing); this one only proves an
// upload came from us — if it is lost, Play Console → App integrity can reset
// it. Back both files up in a password manager. Refuses to overwrite.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const dir = path.join(homedir(), ".quoteai-keys");
const jks = path.join(dir, "quoteai-upload.jks");
const props = path.join(dir, "upload.properties");
if (existsSync(jks) || existsSync(props)) {
  console.error(`An upload key already exists in ${dir} — keep it; nothing was changed.`);
  process.exit(1);
}

const win = process.platform === "win32";
const javaHomes = [process.env.JAVA_HOME, win ? "C:/Program Files/Android/Android Studio/jbr" : undefined, "/Applications/Android Studio.app/Contents/jbr/Contents/Home"].filter(Boolean) as string[];
const keytool = javaHomes.map((h) => path.join(h, "bin", win ? "keytool.exe" : "keytool")).find(existsSync);
if (!keytool) throw new Error("keytool not found: set JAVA_HOME or install Android Studio");

mkdirSync(dir, { recursive: true });
const password = randomBytes(24).toString("base64url");
const alias = "quoteai-upload";
execFileSync(keytool, [
  "-genkeypair", "-keystore", jks, "-storetype", "PKCS12", "-alias", alias,
  "-keyalg", "RSA", "-keysize", "4096", "-validity", "10000",
  "-storepass", password, "-keypass", password,
  "-dname", "CN=QuoteAI, O=QuoteAI, C=CA",
], { stdio: ["ignore", "ignore", "inherit"] });
// PKCS12 keeps one password for the store and the key.
writeFileSync(props, `storeFile=${jks.replace(/\\/g, "/")}\nkeyAlias=${alias}\nstorePassword=${password}\nkeyPassword=${password}\n`, { mode: 0o600 });

const fingerprint = execFileSync(keytool, ["-list", "-keystore", jks, "-storepass", password, "-alias", alias], { encoding: "utf8" })
  .split("\n").find((l) => /SHA-256|SHA256/.test(l))?.trim();
console.log(`Upload key created in ${dir} (password in upload.properties — back up both files).`);
if (fingerprint) console.log(`Upload certificate ${fingerprint}`);
