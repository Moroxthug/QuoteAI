// Phase 118 (docs/APP-PLAN.md): the two files that let a quoteai.ca/dashboard
// link open the phone app instead of the browser when it is installed —
// Android App Links (/.well-known/assetlinks.json) and iOS Universal Links
// (/.well-known/apple-app-site-association). Written into dist/public at build
// time from:
//   ANDROID_CERT_SHA256  comma list of signing-certificate SHA-256 fingerprints
//                        (Play Console → App integrity: the app signing key and
//                        the upload key; a debug key for internal testing)
//   APPLE_TEAM_ID        the Apple developer team id (Phase 125)
// A file whose variable is unset is not written: links then open the website,
// as they do today. Only /dashboard and (Phase 119) a crew member's /t link
// are claimed — client links (/p, /sign, /i, /portal, /join) always stay in
// the browser.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const APP_ID = "ca.quoteai.app";
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function assetLinks(fingerprints: string[]): unknown[] {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: APP_ID, sha256_cert_fingerprints: fingerprints },
    },
  ];
}

function appleAppSiteAssociation(teamId: string): unknown {
  return {
    applinks: {
      details: [{ appIDs: [`${teamId}.${APP_ID}`], components: [{ "/": "/dashboard" }, { "/": "/dashboard/*" }, { "/": "/t/*" }] }],
    },
  };
}

function parseFingerprints(raw: string | undefined): string[] {
  const list = (raw ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  for (const f of list) if (!FINGERPRINT.test(f)) throw new Error(`ANDROID_CERT_SHA256: "${f}" is not a SHA-256 fingerprint (AA:BB:… 32 pairs)`);
  return list;
}

const dir = path.resolve(import.meta.dirname, "../dist/public/.well-known");
const fingerprints = parseFingerprints(process.env.ANDROID_CERT_SHA256);
const team = process.env.APPLE_TEAM_ID?.trim();
if (fingerprints.length || team) mkdirSync(dir, { recursive: true });
if (fingerprints.length) {
  writeFileSync(path.join(dir, "assetlinks.json"), JSON.stringify(assetLinks(fingerprints), null, 2));
  console.log(`assetlinks.json: ${fingerprints.length} certificate(s)`);
} else console.log("assetlinks.json: skipped (ANDROID_CERT_SHA256 unset) — /dashboard links open the website");
if (team) {
  if (!/^[A-Z0-9]{10}$/.test(team)) throw new Error(`APPLE_TEAM_ID: "${team}" is not a 10-character team id`);
  writeFileSync(path.join(dir, "apple-app-site-association"), JSON.stringify(appleAppSiteAssociation(team)));
  console.log("apple-app-site-association: written");
} else console.log("apple-app-site-association: skipped (APPLE_TEAM_ID unset)");
