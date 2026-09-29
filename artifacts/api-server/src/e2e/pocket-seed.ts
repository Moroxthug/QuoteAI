// Pocket (docs/POCKET-DESIGN-PLAN.md) — a signed-in sample company to build the phone
// screens against in the Browser pane: the store screenshots' showcase (fixtures.ts) with
// real-looking names, left in place (not cleaned up) and its session token printed.
//
//   E2E_NO_PURGE=1 pnpm --filter @workspace/api-server exec tsx src/e2e/pocket-seed.ts [en|fr]
//
// Then in the app's tab: localStorage.setItem("quoteai_session-token", "<token>"). The next
// QA run without E2E_NO_PURGE purges it like any leftover fixture.

import { bootstrapQaEnv } from "./qaEnv.js";

process.env.LOG_LEVEL ??= "warn";
process.env.E2E_NO_PURGE ??= "1";
bootstrapQaEnv("pocket-seed");

const lang = (process.argv[2] === "fr" ? "fr" : "en") as "en" | "fr";
const { captureResend } = await import("./qaEnv.js");
await captureResend();
const { installVendorStubs } = await import("./vendorStub.js");
installVendorStubs();
const { startServer, stopServer, createOrg } = await import("./harness.js");
await startServer();
const { seedShowcase } = await import("./fixtures.js");
const { COMPANY, realNames } = await import("./showcase-names.js");

const org = await createOrg({ province: lang === "fr" ? "QC" : "ON", companyName: COMPANY[lang] });
await seedShowcase(org, { withLogo: false });
await realNames(org.userId, lang);
console.log(`POCKET_TOKEN=${org.token}`);
await stopServer();
process.exit(0);
