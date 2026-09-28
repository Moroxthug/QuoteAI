// Phase 118: runs the Android Gradle build with a JDK found on this machine —
// JAVA_HOME if set, else Android Studio's bundled one — so `pnpm android:debug`
// works without a separate Java install. CI sets JAVA_HOME itself.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const android = path.resolve(import.meta.dirname, "../android");
const win = process.platform === "win32";
const candidates = [
  process.env.JAVA_HOME,
  win ? "C:/Program Files/Android/Android Studio/jbr" : undefined,
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
  "/opt/android-studio/jbr",
].filter((p): p is string => !!p);
const javaHome = candidates.find((p) => existsSync(path.join(p, "bin", win ? "java.exe" : "java")));
if (!javaHome) throw new Error("No JDK found: set JAVA_HOME (JDK 21) or install Android Studio");

const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? (win ? path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk") : path.join(process.env.HOME ?? "", "Android", "Sdk"));

execFileSync(path.join(android, win ? "gradlew.bat" : "gradlew"), process.argv.slice(2), {
  cwd: android,
  stdio: "inherit",
  shell: win,
  env: { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk },
});
