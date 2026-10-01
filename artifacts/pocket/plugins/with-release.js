// Phase 123.4: the release build, kept in app.json's plugins so `expo prebuild` (android/ is
// generated, not committed) always writes it.
// - Version code: the minutes since 2026-01-01 UTC unless ANDROID_VERSION_CODE is given, the
//   same rule as the Capacitor app (artifacts/mobile build.gradle), so an Expo build is always
//   newer than the last Capacitor upload (391623) and than the build before it.
// - Signing: a release is signed with the Play upload key when ANDROID_KEYSTORE_PATH and the
//   ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD variables are set
//   (scripts/release-android.mjs reads them from ~/.quoteai-keys/upload.properties); without
//   them it falls back to the debug key, as before.
const { withAppBuildGradle } = require("@expo/config-plugins");

const MARK = "// quoteai: release signing and version code";

module.exports = function withRelease(config) {
  return withAppBuildGradle(config, (c) => {
    let g = c.modResults.contents;
    if (g.includes(MARK)) return c;
    g = g.replace(
      /^android \{/m,
      `${MARK}
def quoteaiEnv = { String name, String fallback -> System.getenv(name) ?: fallback }
def quoteaiKeystore = System.getenv("ANDROID_KEYSTORE_PATH")
def quoteaiMinutes = String.valueOf((long) ((System.currentTimeMillis() - 1767225600000L) / 60000L))

android {`,
    );
    g = g.replace(/versionCode \d+/, 'versionCode quoteaiEnv("ANDROID_VERSION_CODE", quoteaiMinutes).toInteger()');
    g = g.replace(/versionName "([^"]*)"/, 'versionName quoteaiEnv("ANDROID_VERSION_NAME", "$1." + quoteaiMinutes)');
    g = g.replace(
      /signingConfigs \{\n(\s+)debug \{/,
      `signingConfigs {
$1if (quoteaiKeystore) {
$1    release {
$1        storeFile file(quoteaiKeystore)
$1        storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
$1        keyAlias System.getenv("ANDROID_KEY_ALIAS")
$1        keyPassword System.getenv("ANDROID_KEY_PASSWORD")
$1    }
$1}
$1debug {`,
    );
    g = g.replace(
      /(release \{[^}]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig quoteaiKeystore ? signingConfigs.release : signingConfigs.debug",
    );
    c.modResults.contents = g;
    return c;
  });
};
