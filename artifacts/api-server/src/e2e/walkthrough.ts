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

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenv(path: string) {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let value = m[2]!;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value !== "") process.env[m[1]!] ??= value;
  }
}

loadDotenv(resolve(import.meta.dirname, "../../../../.env.staging"));

const FRONTEND = process.env.WALKTHROUGH_FRONTEND ?? "http://localhost:5183";
process.env.NODE_ENV = "development";
process.env.QUOTEAI_BASE_URL = FRONTEND; // links in emails / PDFs point at the local frontend
process.env.BETTER_AUTH_URL = FRONTEND;
process.env.TRUSTED_ORIGINS = [process.env.TRUSTED_ORIGINS, FRONTEND, "http://localhost:5000"].filter(Boolean).join(",");
process.env.RESEND_API_KEY ??= "re_walkthrough_mock";
process.env.BETTER_AUTH_SECRET ??= "walkthrough-secret-not-for-production-0000";
process.env.TOKEN_ENCRYPTION_KEY ??= "0".repeat(64);
process.env.CRON_SECRET ??= "walkthrough-cron-secret";
process.env.LOG_LEVEL ??= "info";
process.env.PORT ??= "5000";
// Vercel pulls Sensitive vars as empty strings, so the AI key is usually
// absent locally. Without one, point the client at a closed port so every AI
// call takes its deterministic fallback (same trick as vitest.e2e.setup.ts).
if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY && !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "walkthrough-no-ai";
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "http://127.0.0.1:9/v1";
  console.warn("[walkthrough] no AI key set — AI features run their fallbacks (set GROQ_API_KEY to use real models)");
}

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

type Mail = { at: string; to: string[]; from: string; subject: string; links: string[]; html: string };
const mailbox: Mail[] = [];
const MAILBOX_PATH = resolve(import.meta.dirname, "../../.walkthrough-mailbox.json");

stubHost("https://api.resend.com/", (req) => {
  const body = (req.json ?? {}) as { to?: string | string[]; from?: string; subject?: string; html?: string };
  const html = body.html ?? "";
  const links = [...new Set([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&")))];
  const mail: Mail = { at: new Date().toISOString(), to: Array.isArray(body.to) ? body.to : [body.to ?? ""], from: body.from ?? "", subject: body.subject ?? "", links, html };
  mailbox.push(mail);
  writeFileSync(MAILBOX_PATH, JSON.stringify(mailbox, null, 2));
  console.log(`\n[mail] to=${mail.to.join(",")} subject="${mail.subject}"`);
  for (const l of links) console.log(`[mail]   ${l}`);
  return json(200, { id: `walkthrough-${mailbox.length}` });
});

const { default: app } = await import("../app.js");
const port = Number(process.env.PORT);
app.listen(port, () => {
  console.log(`[walkthrough] API on http://localhost:${port} — frontend expected at ${FRONTEND}; mailbox → ${MAILBOX_PATH}`);
});
