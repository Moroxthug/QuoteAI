// Phase 69 (docs/QA-VERIFICATION-PLAN.md): environment-variable inventory.
//
// Scans the code for every `process.env.X` / `import.meta.env.VITE_X`,
// classifies each name with the manifest below, and diffs the result against
// what the Vercel project actually has. Exit 1 when a variable the code reads
// is unknown to the manifest (document it here) or a `required` one is
// missing from Vercel. Everything else is reported, not enforced: `feature`
// vars gate an integration that reports "not configured" when absent,
// `deferred` ones are intentionally unset until the partner access exists.
//
// Vercel side, one of:
//   VERCEL_TOKEN=… VERCEL_PROJECT_ID=prj_… [VERCEL_TEAM_ID=team_…]   (REST API)
//   --vercel-keys <file>   one key per line, or a pasted `vercel env ls` table
//   (nothing)              code-side report only
//
//   pnpm env:inventory [--vercel-keys keys.txt] [--write docs/ENV-INVENTORY.md]
// (relative paths resolve against the repo root)

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

type Kind = "required" | "recommended" | "feature" | "deferred" | "build" | "platform" | "local" | "legacy";

type Entry = { kind: Kind; note: string; feature?: string };

// One line per variable the code reads. Keep this the single source of truth
// for "what does production need" — the runbooks point here.
const MANIFEST: Record<string, Entry> = {
  // ── Required: the API refuses to boot or core flows break without them ──
  DATABASE_URL: { kind: "required", note: "Supabase Postgres via the session pooler (aws-0-us-west-2.pooler.supabase.com:5432)" },
  BETTER_AUTH_SECRET: { kind: "required", note: "session signing; rotating it logs everyone out" },
  BETTER_AUTH_URL: { kind: "required", note: "https://quoteai.ca — auth callback base" },
  QUOTEAI_BASE_URL: { kind: "required", note: "public origin used in emails/PDF links" },
  TRUSTED_ORIGINS: { kind: "required", note: "comma list of origins allowed by CORS + better-auth" },
  TOKEN_ENCRYPTION_KEY: { kind: "required", note: "AES-256-GCM key for OAuth tokens at rest — see RUNBOOKS → rotate TOKEN_ENCRYPTION_KEY" },
  CRON_SECRET: { kind: "required", note: "Vercel Cron bearer for /api/cron/tick; nothing scheduled runs without it" },
  RESEND_API_KEY: { kind: "required", note: "every transactional email (auth, quotes, invoices, ops alerts)" },
  SUPABASE_URL: { kind: "required", note: "Storage (logos, PDFs, photos)" },
  SUPABASE_SERVICE_ROLE_KEY: { kind: "required", note: "Storage service key — server only, never in the client" },
  SUPABASE_PUBLIC_BUCKET: { kind: "required", note: "public-assets" },
  SUPABASE_PRIVATE_BUCKET: { kind: "required", note: "private-assets (signed URLs)" },
  STRIPE_SECRET_KEY: { kind: "required", note: "subscriptions + Connect" },
  STRIPE_WEBHOOK_SECRET: { kind: "required", note: "POST /api/payments/webhook signature" },
  STRIPE_PUBLISHABLE_KEY: { kind: "required", note: "returned to the client for Checkout" },
  STRIPE_CONNECT_WEBHOOK_SECRET: { kind: "required", note: "POST /api/payments/connect/webhook signature (Phase 14 invoices paid by card)" },
  ADMIN_EMAIL: { kind: "required", note: "comma list; /api/admin/* access and default recipient of ops alerts" },
  GROQ_API_KEY: { kind: "required", note: "the AI provider in production (OpenAI-compatible); without any AI key every AI feature takes its fallback" },
  SESSION_SECRET: { kind: "legacy", note: "read by lib/auth for the pre-better-auth cookie; kept set, harmless" },

  // ── Recommended for launch (Phase 69) ──
  SENTRY_DSN: { kind: "recommended", note: "API error tracking; unset = errors only in Vercel logs" },
  VITE_SENTRY_DSN: { kind: "recommended", note: "browser error tracking (same DSN is fine)" },
  SENTRY_ENVIRONMENT: { kind: "build", note: "optional override; defaults to VERCEL_ENV" },
  SENTRY_RELEASE: { kind: "build", note: "optional override; defaults to VERCEL_GIT_COMMIT_SHA" },
  VITE_SENTRY_ENVIRONMENT: { kind: "build", note: "optional override for the browser side" },
  VITE_RELEASE: { kind: "platform", note: "injected by vite.config.ts from VERCEL_GIT_COMMIT_SHA" },
  SENTRY_AUTH_TOKEN: { kind: "build", note: "build-time only: source map inject + upload (scripts/sentry-sourcemaps.mjs)" },
  SENTRY_ORG: { kind: "build", note: "with SENTRY_AUTH_TOKEN" },
  SENTRY_PROJECT: { kind: "build", note: "with SENTRY_AUTH_TOKEN" },
  OPS_ALERT_EMAIL: { kind: "recommended", note: "where cron/automation alerts go; falls back to ADMIN_EMAIL" },
  CRON_HEARTBEAT_URL: { kind: "recommended", note: "dead-man switch pinged after each successful tick (Healthchecks.io / Better Stack / Cronitor)" },
  CRON_STALE_AFTER_HOURS: { kind: "recommended", note: "default 25 (daily schedule + 1 h grace); set 2 if the cron moves to hourly" },
  POSTHOG_KEY: { kind: "recommended", note: "server telemetry; unset = no product analytics" },
  POSTHOG_HOST: { kind: "recommended", note: "defaults to https://eu.i.posthog.com" },
  VITE_POSTHOG_KEY: { kind: "recommended", note: "browser analytics (loaded on first interaction)" },
  VITE_POSTHOG_HOST: { kind: "recommended", note: "defaults to https://eu.i.posthog.com" },
  RESEND_WEBHOOK_SECRET: { kind: "recommended", note: "POST /api/webhooks/resend — without it bounce/complaint events are rejected (500) and email_events stays empty" },
  INVOICE_LINK_SECRET: { kind: "legacy", note: "HMAC for public invoice links; falls back to BETTER_AUTH_SECRET (set in prod) — only needed to rotate invoice links independently of sessions" },

  // ── Feature gates: absent = integration shows 'not configured' ──
  QUICKBOOKS_CLIENT_ID: { kind: "feature", feature: "QuickBooks", note: "Phase 11" },
  QUICKBOOKS_CLIENT_SECRET: { kind: "feature", feature: "QuickBooks", note: "" },
  QUICKBOOKS_REDIRECT_URI: { kind: "feature", feature: "QuickBooks", note: "" },
  QUICKBOOKS_ENVIRONMENT: { kind: "feature", feature: "QuickBooks", note: "sandbox | production" },
  GOOGLE_CALENDAR_CLIENT_ID: { kind: "feature", feature: "Google Calendar", note: "Phase 12" },
  GOOGLE_CALENDAR_CLIENT_SECRET: { kind: "feature", feature: "Google Calendar", note: "" },
  GOOGLE_CALENDAR_REDIRECT_URI: { kind: "feature", feature: "Google Calendar", note: "" },
  GMAIL_SEND_CLIENT_ID: { kind: "feature", feature: "Gmail send", note: "Phase 20 — OAuth app registration pending (growth-platform-plan)" },
  GMAIL_SEND_CLIENT_SECRET: { kind: "feature", feature: "Gmail send", note: "" },
  GMAIL_SEND_REDIRECT_URI: { kind: "feature", feature: "Gmail send", note: "" },
  WHATSAPP_ACCESS_TOKEN: { kind: "feature", feature: "WhatsApp", note: "Phase 9 — Meta app + template approval pending" },
  WHATSAPP_PHONE_NUMBER_ID: { kind: "feature", feature: "WhatsApp", note: "" },
  WHATSAPP_BUSINESS_NUMBER: { kind: "feature", feature: "WhatsApp", note: "" },
  WHATSAPP_APP_SECRET: { kind: "feature", feature: "WhatsApp", note: "webhook signature; the webhook 500s without it (safe: nothing is accepted)" },
  WHATSAPP_VERIFY_TOKEN: { kind: "feature", feature: "WhatsApp", note: "" },
  WHATSAPP_LEAD_FOLLOWUP_TEMPLATE: { kind: "feature", feature: "WhatsApp", note: "approved template names" },
  WHATSAPP_REVIEW_REQUEST_TEMPLATE: { kind: "feature", feature: "WhatsApp", note: "" },
  WHATSAPP_PHOTO_SHARE_TEMPLATE: { kind: "feature", feature: "WhatsApp", note: "" },
  META_APP_ID: { kind: "feature", feature: "Meta Lead Ads", note: "Phase 28" },
  META_APP_SECRET: { kind: "feature", feature: "Meta Lead Ads", note: "" },
  META_REDIRECT_URI: { kind: "feature", feature: "Meta Lead Ads", note: "" },
  META_LEADGEN_VERIFY_TOKEN: { kind: "feature", feature: "Meta Lead Ads", note: "" },
  GSC_SERVICE_ACCOUNT_KEY: { kind: "feature", feature: "Search Console (admin)", note: "admin SEO panel only" },
  GSC_SITE_URL: { kind: "feature", feature: "Search Console (admin)", note: "" },
  AI_MODEL: { kind: "feature", feature: "AI", note: "model override; Groq rewrites gpt-4o* names itself" },

  // ── Deferred: partner/dev-app access does not exist yet (edge-features-plan) ──
  OUTLOOK_CALENDAR_CLIENT_ID: { kind: "deferred", note: "Phase 16 — Entra app registration not done" },
  OUTLOOK_CALENDAR_CLIENT_SECRET: { kind: "deferred", note: "" },
  OUTLOOK_CALENDAR_REDIRECT_URI: { kind: "deferred", note: "" },
  WAVE_CLIENT_ID: { kind: "deferred", note: "Phase 25 — Wave partner app not granted" },
  WAVE_CLIENT_SECRET: { kind: "deferred", note: "" },
  WAVE_REDIRECT_URI: { kind: "deferred", note: "" },
  FINANCEIT_APP_ID: { kind: "deferred", note: "Phase 27 — Financeit partner credentials not granted" },
  FINANCEIT_APP_SECRET: { kind: "deferred", note: "" },
  FINANCEIT_WEBHOOK_SECRET: { kind: "deferred", note: "" },
  FINANCEIT_ENVIRONMENT: { kind: "deferred", note: "" },
  FLINKS_CUSTOMER_ID: { kind: "deferred", note: "Phase 29 (bank feed) — Flinks sandbox not granted" },
  FLINKS_INSTANCE: { kind: "deferred", note: "" },
  FLINKS_ENVIRONMENT: { kind: "deferred", note: "" },
  GOOGLE_LSA_CLIENT_ID: { kind: "deferred", note: "Phase 29 (LSA) — Google Ads developer token not applied for" },
  GOOGLE_LSA_CLIENT_SECRET: { kind: "deferred", note: "" },
  GOOGLE_LSA_REDIRECT_URI: { kind: "deferred", note: "" },
  GOOGLE_ADS_DEVELOPER_TOKEN: { kind: "deferred", note: "" },
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: { kind: "deferred", note: "" },

  // ── Aliases / legacy names still read somewhere ──
  OPENAI_API_KEY: { kind: "legacy", note: "alias of the AI key; GROQ_API_KEY wins" },
  AI_INTEGRATIONS_OPENAI_API_KEY: { kind: "legacy", note: "Replit-era alias; e2e uses it to point AI at a closed port" },
  AI_INTEGRATIONS_OPENAI_BASE_URL: { kind: "legacy", note: "Replit-era alias" },
  posthog_key: { kind: "legacy", note: "lowercase alias of POSTHOG_KEY" },
  posthog_host: { kind: "legacy", note: "lowercase alias of POSTHOG_HOST" },
  admin_email: { kind: "legacy", note: "lowercase alias of ADMIN_EMAIL" },

  // ── Set by the platform, never by hand ──
  NODE_ENV: { kind: "platform", note: "vercel.json sets production" },
  VERCEL_URL: { kind: "platform", note: "" },
  VERCEL_PROJECT_PRODUCTION_URL: { kind: "platform", note: "" },
  VERCEL_ENV: { kind: "platform", note: "" },
  VERCEL_GIT_COMMIT_SHA: { kind: "platform", note: "becomes the Sentry release" },
  VERCEL_REGION: { kind: "platform", note: "" },
  VERCEL_SKIP_TYPECHECK: { kind: "platform", note: "vercel.json" },
  PORT: { kind: "local", note: "local server only" },
  LOG_LEVEL: { kind: "local", note: "pino level; default info" },
  BASE_PATH: { kind: "local", note: "vite base override" },
  API_PROXY_TARGET: { kind: "local", note: "server/serve.mjs proxy (Lighthouse QA)" },

  // ── Local / QA only ──
  E2E_NO_PURGE: { kind: "local", note: "e2e harness" },
  E2E_DEBUG: { kind: "local", note: "e2e harness" },
  E2E_REAL_AI: { kind: "local", note: "e2e harness" },
  QA_CHROME_PATH: { kind: "local", note: "qa:visual / qa:lighthouse" },
  WALKTHROUGH_FRONTEND: { kind: "local", note: "walkthrough script" },
  PRERENDER_SAMPLE: { kind: "local", note: "validate-prerender sample size" },
  BACKUP_PASSPHRASE: { kind: "local", note: "ops:backup encryption (also a GitHub Actions secret for the nightly backup)" },
  BACKUP_DATABASE_URL: { kind: "local", note: "GitHub Actions secret: the nightly backup source" },
};

// ── Scan ────────────────────────────────────────────────────────────────────

const SCAN_DIRS = [
  "artifacts/api-server/src",
  "artifacts/api-server/build.mjs",
  "artifacts/api-server/scripts",
  "artifacts/quote-ai/src",
  "artifacts/quote-ai/vite.config.ts",
  "artifacts/quote-ai/server",
  "artifacts/quote-ai/scripts",
  "api",
  "lib/db/src",
  "lib/db/drizzle.config.ts",
  "lib/error-reporting/src",
  "lib/integrations-openai-ai-server/src",
  "scripts/sentry-sourcemaps.mjs",
];
const SKIP = /node_modules|\/dist\/|\.test\.|\/e2e\//;

function walk(p: string, out: string[]): void {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const n of readdirSync(p)) walk(join(p, n), out);
  } else if (/\.(ts|tsx|mjs|js)$/.test(p) && !SKIP.test(p.replace(/\\/g, "/"))) {
    out.push(p);
  }
}

const refs = new Map<string, Set<string>>();
for (const d of SCAN_DIRS) {
  const abs = join(ROOT, d);
  const files: string[] = [];
  try {
    walk(abs, files);
  } catch {
    continue;
  }
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const rel = relative(ROOT, f).replace(/\\/g, "/");
    const re = /(?:process\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[["']([A-Za-z_][A-Za-z0-9_]*)["']\])|import\.meta\.env\.(VITE_[A-Za-z0-9_]+))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const name = m[1] ?? m[2] ?? m[3]!;
      if (!refs.has(name)) refs.set(name, new Set());
      refs.get(name)!.add(rel);
    }
  }
}

// ── Vercel side ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

async function vercelKeys(): Promise<Set<string> | null> {
  const file = flag("--vercel-keys");
  if (file) {
    const keys = new Set<string>();
    for (const line of readFileSync(resolve(ROOT, file), "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\b/.exec(line);
      if (m && m[1] !== "name" && m[1] !== "Vercel") keys.add(m[1]!);
    }
    return keys;
  }
  const token = process.env.VERCEL_TOKEN;
  const project = process.env.VERCEL_PROJECT_ID;
  if (!token || !project) return null;
  const team = process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : "";
  const res = await fetch(`https://api.vercel.com/v10/projects/${project}/env?target=production${team}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Vercel API ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { envs: { key: string; target: string[] }[] };
  return new Set(body.envs.filter((e) => e.target.includes("production")).map((e) => e.key));
}

// ── Report ──────────────────────────────────────────────────────────────────

const ORDER: Kind[] = ["required", "recommended", "feature", "deferred", "legacy", "build", "platform", "local"];

async function main(): Promise<void> {
  const vercel = await vercelKeys();
  const names = new Set<string>([...refs.keys(), ...Object.keys(MANIFEST)]);
  const rows: { name: string; kind: Kind | "UNKNOWN"; feature: string; note: string; inVercel: string; files: string; problem: string }[] = [];
  let failures = 0;
  const problems: string[] = [];

  for (const name of [...names].sort()) {
    const entry = MANIFEST[name];
    const kind: Kind | "UNKNOWN" = entry?.kind ?? "UNKNOWN";
    const files = [...(refs.get(name) ?? [])];
    const set = vercel ? vercel.has(name) : undefined;
    let problem = "";
    if (!entry) {
      problem = "not in the manifest — classify it in scripts/src/env-inventory.ts";
      failures++;
    } else if (vercel && !set && entry.kind === "required") {
      problem = "REQUIRED but missing from Vercel production";
      failures++;
    } else if (vercel && !set && entry.kind === "recommended") {
      problem = "recommended for launch, not set";
    } else if (vercel && !set && entry.kind === "feature") {
      problem = `${entry.feature} not configured`;
    } else if (files.length === 0 && !["build", "platform", "local"].includes(kind)) {
      problem = "in the manifest but no longer read by any code";
    }
    if (problem) problems.push(`${name}: ${problem}`);
    rows.push({
      name,
      kind,
      feature: entry?.feature ?? "",
      note: entry?.note ?? "",
      inVercel: vercel ? (set ? "yes" : "—") : "?",
      files: files.map((f) => f.replace(/^artifacts\//, "")).slice(0, 3).join(", ") + (files.length > 3 ? ` (+${files.length - 3})` : ""),
      problem,
    });
  }

  const stale = vercel ? [...vercel].filter((k) => !names.has(k)) : [];

  const lines: string[] = [];
  lines.push(`# Environment inventory`);
  lines.push("");
  lines.push(`Generated ${new Date().toISOString().slice(0, 10)} by \`pnpm env:inventory\` — ${refs.size} variables read by the code, ${Object.keys(MANIFEST).length} in the manifest${vercel ? `, ${vercel.size} set in Vercel production` : " (Vercel side not checked)"}.`);
  lines.push("");
  lines.push(`Kinds: **required** (boot/core flows) · **recommended** (launch expectation, degraded without) · **feature** (integration reports "not configured") · **deferred** (partner access pending, intentionally unset) · legacy / build / platform / local.`);
  lines.push("");
  for (const kind of [...ORDER, "UNKNOWN" as const]) {
    const group = rows.filter((r) => r.kind === kind);
    if (!group.length) continue;
    lines.push(`## ${kind}`);
    lines.push("");
    lines.push(`| Variable | Vercel | Feature | Note | Read by | Problem |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const r of group) lines.push(`| \`${r.name}\` | ${r.inVercel} | ${r.feature} | ${r.note} | ${r.files} | ${r.problem} |`);
    lines.push("");
  }
  if (stale.length) {
    lines.push(`## Set in Vercel but read by nothing`);
    lines.push("");
    for (const k of stale) lines.push(`- \`${k}\` — stale secret; remove or document`);
    lines.push("");
  }
  lines.push(`## Summary`);
  lines.push("");
  if (problems.length === 0) lines.push("No problems.");
  for (const p of problems) lines.push(`- ${p}`);
  lines.push("");

  const out = lines.join("\n");
  const write = flag("--write");
  if (write) {
    writeFileSync(resolve(ROOT, write), out); // relative to the repo root, whatever package runs it
    console.log(`wrote ${write}`);
  }
  console.log(out);
  if (failures) {
    console.error(`\n${failures} failure(s): unknown variable(s) or required variable(s) missing from Vercel.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
