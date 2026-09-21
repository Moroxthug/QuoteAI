// Phase 66 — a local dev server for the functional walkthrough in the Browser
// pane. It boots the real Express app against `.env.staging` with two
// differences from production: outbound email is captured at the fetch
// boundary (api.resend.com) instead of sent, and every other vendor host is
// stubbed with a 599 so nothing leaves the machine. Captured emails are
// written to `.walkthrough-mailbox.json` (gitignored) and every link in them
// is printed, so the verification / quote / signing / invoice links can be
// followed by hand. AI keys are kept — this is the walk-through, not the
// deterministic e2e suite.
//
//   pnpm --filter @workspace/api-server walkthrough        # :5000 (vite's default proxy target)
//   then the `quote-ai` launch config (vite :5183 → proxy :5000)

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bootstrapQaEnv, captureResend } from "./qaEnv.js";

process.env.LOG_LEVEL ??= "info";
bootstrapQaEnv("walkthrough");
const FRONTEND = process.env.WALKTHROUGH_FRONTEND ?? "http://localhost:5183";
process.env.NODE_ENV = "development";
process.env.QUOTEAI_BASE_URL = FRONTEND; // links in emails / PDFs point at the local frontend
process.env.BETTER_AUTH_URL = FRONTEND;
process.env.TRUSTED_ORIGINS = [process.env.TRUSTED_ORIGINS, FRONTEND, "http://localhost:5000"].filter(Boolean).join(",");
process.env.PORT ??= "5000";

const { installVendorStubs, stubHost, json } = await import("./vendorStub.js");
installVendorStubs();
for (const host of [
  "https://graph.facebook.com/",
  "https://gmail.googleapis.com/",
  "https://www.googleapis.com/",
  "https://oauth2.googleapis.com/",
  "https://graph.microsoft.com/",
  "https://login.microsoftonline.com/",
  "https://sandbox-quickbooks.api.intuit.com/",
  "https://quickbooks.api.intuit.com/",
  "https://oauth.platform.intuit.com/",
  "https://developer.api.intuit.com/",
  "https://api.waveapps.com/",
  "https://gql.waveapps.com/",
  "https://googleads.googleapis.com/",
  "https://sandbox.financeit.ca/",
  "https://financeit.ca/",
]) {
  stubHost(host, (req) => json(599, { error: "walkthrough: vendor call blocked", url: req.url }));
}

// Phase 74: Twilio is "configured" with fake credentials and every send is
// accepted and printed, so Settings → SMS and the job page's "On my way" can be
// clicked through. Set the real TWILIO_* in .env.staging to text a real phone.
process.env.TWILIO_ACCOUNT_SID ??= "ACwalkthrough00000000000000000000";
process.env.TWILIO_AUTH_TOKEN ??= "walkthrough-twilio-token";
process.env.TWILIO_FROM_NUMBER ??= "+18005550199";
if (process.env.TWILIO_ACCOUNT_SID.startsWith("ACwalkthrough")) {
  stubHost("https://api.twilio.com/", (req) => {
    const form = new URLSearchParams(req.body ?? "");
    console.log(`
[sms] to=${form.get("To")} ${JSON.stringify(form.get("Body"))}`);
    return json(201, { sid: `SM${Date.now()}`, status: "queued" });
  });
}

const MAILBOX_PATH = resolve(import.meta.dirname, "../../.walkthrough-mailbox.json");
const mailbox = await captureResend((mail) => {
  writeFileSync(MAILBOX_PATH, JSON.stringify(mailbox, null, 2));
  console.log(`\n[mail] to=${mail.to.join(",")} subject="${mail.subject}"`);
  for (const l of mail.links) console.log(`[mail]   ${l}`);
});

const { default: app } = await import("../app.js");
const port = Number(process.env.PORT);
app.listen(port, () => {
  console.log(`[walkthrough] API on http://localhost:${port} — frontend expected at ${FRONTEND}; mailbox → ${MAILBOX_PATH}`);
});
