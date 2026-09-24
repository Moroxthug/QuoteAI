// Phase 98 (docs/LAUNCH-FINISH-PLAN.md): every Phase 99 owner item that can be
// detected from the outside, green or red, with its item number.
//
// Where each answer comes from:
//   the deployment    GET /api/healthz/ops (public), /api/payments/{plans,pilot} (public),
//                     GET /api/healthz/owner (CRON_SECRET bearer): which launch variables are
//                     set there and whether the Stripe price ids + pilot code are valid for
//                     the Stripe key that deployment uses
//   GitHub            `gh` (logged in): repository secret names, the last Backup run and its artifact
//   Vercel            VERCEL_TOKEN + VERCEL_PROJECT_ID [+ VERCEL_TEAM_ID]: which secrets are Sensitive
//   this checkout     LEGAL_ENTITY, the cron schedule in vercel.json, docs/RESTORE-REHEARSALS.md,
//                     the decision table in docs/LAUNCH-GO-NO-GO.md §5
//
// Items only a person can close (the lawyer, the device pass, key escrow…) are
// listed as MANUAL so the report is the whole list, not just the checkable half.
//
//   CRON_SECRET=… pnpm ops:owner-check [--url https://quoteai.ca] [--json]
//
// Only reads. Exit 1 while any "blocks launch" item (L-*) is open.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LEGAL_ENTITY, isLegalEntityConfigured } from "@workspace/legal-entity";
import { loadDotenv, STAGING_ENV_PATH } from "../src/e2e/qaEnv.js";
import type { OwnerReadiness } from "../src/lib/ownerReadiness.js";

const cronSecretFromShell = process.env.CRON_SECRET; // before .env.staging, whose Sensitive values are blank
loadDotenv(STAGING_ENV_PATH);

const ROOT = resolve(import.meta.dirname, "../../..");
const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const BASE = (flag("--url") ?? process.env.QUOTEAI_BASE_URL ?? "https://quoteai.ca").replace(/\/$/, "");
const JSON_OUT = argv.includes("--json");
const CRON_SECRET = cronSecretFromShell || process.env.CRON_SECRET || "";

type Status = "done" | "todo" | "partial" | "manual" | "unknown";
type Row = { item: string; title: string; status: Status; detail: string; next?: string };
const rows: Row[] = [];
const add = (r: Row) => rows.push(r);

// ── Sources ──────────────────────────────────────────────────────────────────

async function getJson<T>(path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: T | null }> {
  try {
    const res = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    try {
      return { status: res.status, body: JSON.parse(text) as T };
    } catch {
      return { status: res.status, body: null };
    }
  } catch {
    return { status: 0, body: null };
  }
}

function gh(args: string[]): { ok: boolean; out: string } {
  const r = spawnSync("gh", args, { cwd: ROOT, encoding: "utf8", shell: false });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim() };
}

const owner = CRON_SECRET ? await getJson<OwnerReadiness>("/api/healthz/owner", { authorization: `Bearer ${CRON_SECRET}` }) : { status: -1, body: null };
const ready = owner.status === 200 ? owner.body : null;
const ownerNote =
  owner.status === -1
    ? "run with CRON_SECRET=… to check this on the deployment"
    : owner.status === 404
      ? "the deployment predates Phase 98 — deploy, then re-run"
      : owner.status === 401
        ? "CRON_SECRET does not match the deployment's"
        : `GET /api/healthz/owner answered ${owner.status}`;

const ghAuthed = gh(["auth", "status"]).ok;
const secretNames = new Set(ghAuthed ? gh(["secret", "list", "--json", "name", "--jq", ".[].name"]).out.split(/\s+/).filter(Boolean) : []);
const ghNote = ghAuthed ? "" : "`gh` is not logged in — `gh auth login`, then re-run";

type VercelEnv = { key: string; type: string; target?: string[] };
async function vercelEnvs(): Promise<VercelEnv[] | null> {
  const token = process.env.VERCEL_TOKEN;
  const project = process.env.VERCEL_PROJECT_ID;
  if (!token || !project) return null;
  const team = process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : "";
  try {
    const res = await fetch(`https://api.vercel.com/v10/projects/${project}/env?target=production${team}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return ((await res.json()) as { envs: VercelEnv[] }).envs;
  } catch {
    return null;
  }
}
const vercel = await vercelEnvs();

const setOnDeployment = (names: string[]) => (ready ? names.filter((n) => ready.vars[n]) : null);

// ── Blocks launch ────────────────────────────────────────────────────────────

{
  const need = ["BACKUP_DATABASE_URL", "BACKUP_SUPABASE_URL", "BACKUP_SUPABASE_SERVICE_ROLE_KEY", "BACKUP_PASSPHRASE"];
  if (!ghAuthed) add({ item: "L-1", title: "Database backups", status: "unknown", detail: ghNote });
  else {
    const missing = need.filter((n) => !secretNames.has(n));
    // A run without secrets still finishes green in ~10 s ("backup skipped"); only an artifact proves a backup.
    const run = gh(["run", "list", "--workflow", "backup.yml", "--status", "success", "-L", "1", "--json", "databaseId,createdAt", "--jq", ".[0] // empty | [.databaseId, .createdAt] | @tsv"]).out;
    const [runId, runAt] = run.split("\t");
    const artifacts = runId ? Number(gh(["api", `repos/{owner}/{repo}/actions/runs/${runId}/artifacts`, "--jq", ".total_count"]).out || 0) : 0;
    const ageH = runAt ? (Date.now() - Date.parse(runAt)) / 3_600_000 : Infinity;
    if (missing.length) add({ item: "L-1", title: "Database backups", status: missing.length === need.length ? "todo" : "partial", detail: `GitHub secrets missing: ${missing.join(", ")}`, next: "RUNBOOKS §5 — set them, then Actions → Backup → Run workflow" });
    else if (!artifacts) add({ item: "L-1", title: "Database backups", status: "todo", detail: "secrets set, but the last successful Backup run left no artifact", next: "Actions → Backup → Run workflow, then check the run's log" });
    else add({ item: "L-1", title: "Database backups", status: ageH > 48 ? "partial" : "done", detail: `last backup artifact ${runAt}${ageH > 48 ? " — over 2 days old, is the nightly run failing?" : ""}` });
  }
}

{
  const log = resolve(ROOT, "docs/RESTORE-REHEARSALS.md");
  const entries = existsSync(log) ? readFileSync(log, "utf8").split(/\r?\n/).filter((l) => /^\| \d{4}-\d{2}-\d{2} /.test(l)) : [];
  const last = entries.at(-1);
  const passed = entries.filter((l) => /\| pass \|/.test(l)).at(-1);
  add(
    passed
      ? { item: "L-2", title: "Restore rehearsal", status: "done", detail: `last passing rehearsal ${passed.slice(2, 12)}` }
      : { item: "L-2", title: "Restore rehearsal", status: "todo", detail: last ? `last rehearsal ${last.slice(2, 12)} did not pass` : "never run against a real second database", next: "give the assistant the July project's pooler URL; it runs `ops:rehearse`" },
  );
}

add({ item: "L-3", title: "Legal review", status: "manual", detail: "send docs/legal-packet/QuoteAI-legal-packet.pdf to the lawyer", next: "the assistant applies their changes and bumps TEMPLATE_VERSION" });

add(
  isLegalEntityConfigured()
    ? { item: "L-4", title: "Registered business identity", status: LEGAL_ENTITY.addressLines.length ? "done" : "partial", detail: `${LEGAL_ENTITY.legalName}${LEGAL_ENTITY.addressLines.length ? "" : " — no mailing address yet (CASL needs one)"}` }
    : { item: "L-4", title: "Registered business identity", status: "todo", detail: "lib/legal-entity is blank — every legal surface says plain \"QuoteAI\"", next: "give the assistant the name, address, tax numbers, privacy officer" },
);

{
  const need = ["E2E_DATABASE_URL", "E2E_SUPABASE_URL", "E2E_SUPABASE_SERVICE_ROLE_KEY"];
  if (!ghAuthed) add({ item: "L-5", title: "Staging Supabase project", status: "unknown", detail: ghNote });
  else {
    const missing = need.filter((n) => !secretNames.has(n));
    add(
      missing.length
        ? { item: "L-5", title: "Staging Supabase project", status: missing.length === need.length ? "todo" : "partial", detail: `GitHub secrets missing: ${missing.join(", ")} — CI's e2e job skips and the suite still runs against production` }
        : { item: "L-5", title: "Staging Supabase project", status: "done", detail: "E2E_* secrets set; CI runs the e2e job against staging" },
    );
  }
}

{
  const names = ["SENTRY_DSN", "VITE_SENTRY_DSN", "SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT", "CRON_HEARTBEAT_URL", "OPS_ALERT_EMAIL"];
  const ops = await getJson<{ status?: string; problems?: string[] }>("/api/healthz/ops");
  const opsLine = ops.status === 200 ? "/api/healthz/ops 200" : `/api/healthz/ops ${ops.status || "unreachable"}${ops.body?.problems ? ` (${ops.body.problems.join("; ")})` : ""}`;
  const set = setOnDeployment(names);
  if (!set) add({ item: "L-6", title: "Error tracking + alerts", status: "unknown", detail: `${opsLine}; variables: ${ownerNote}` });
  else {
    const missing = names.filter((n) => !set.includes(n));
    add({
      item: "L-6",
      title: "Error tracking + alerts",
      status: missing.length === 0 && ops.status === 200 ? "done" : missing.length === names.length ? "todo" : "partial",
      detail: `${opsLine}; ${missing.length ? `unset: ${missing.join(", ")}` : "all 7 variables set — send a test error and watch it arrive (RUNBOOKS §1)"}`,
      next: missing.length ? "RUNBOOKS §1-§2; also point an uptime monitor at /api/healthz/ops" : undefined,
    });
  }
}

add({ item: "L-7", title: "Encryption key escrow", status: "manual", detail: "is TOKEN_ENCRYPTION_KEY in the password manager?", next: "if not, tell the assistant — it rotates the key (RUNBOOKS §6)" });

function priceRow(item: string, title: string, names: string[], script: string) {
  if (!ready) {
    add({ item, title, status: "unknown", detail: ownerNote });
    return;
  }
  const checks = names.map((n) => [n, ready.stripe.prices[n]!] as const);
  const bad = checks.filter(([, c]) => !c.ok);
  const unset = bad.filter(([, c]) => !c.set);
  add({
    item,
    title,
    status: bad.length === 0 ? "done" : unset.length === names.length ? "todo" : "partial",
    detail: bad.length === 0 ? `${names.length} price ids valid for the ${ready.stripe.mode}-mode key` : bad.map(([n, c]) => `${n}: ${c.problem}`).join("; "),
    next: bad.length ? `pnpm --filter @workspace/scripts ${script} with the ${ready.stripe.mode} key, paste into Vercel, redeploy` : undefined,
  });
}
priceRow("L-8", "Stripe add-on prices", ["STRIPE_PRICE_GROUP_COMPANY", "STRIPE_PRICE_GROUP_COMPANY_YEARLY", "STRIPE_PRICE_EXTRA_SEAT", "STRIPE_PRICE_EXTRA_SEAT_YEARLY"], "stripe-addon-prices");

if (ready) {
  priceRow("L-9", "Stripe annual prices", ["STRIPE_PRICE_YEARLY_STARTER", "STRIPE_PRICE_YEARLY_PRO", "STRIPE_PRICE_YEARLY_ELITE"], "stripe-annual-prices");
  const p = ready.stripe.promo;
  add({
    item: "L-9",
    title: "Pilot promotion code",
    status: p.ok ? "done" : "todo",
    detail: p.ok ? `${p.code} active${p.percentOff ? ` (${p.percentOff} % off)` : p.amountOff ? ` (${p.amountOff / 100} $ off)` : ""}` : `PILOT_PROMO_CODE: ${p.problem}`,
    next: p.ok ? undefined : `create the promotion code in Stripe (${ready.stripe.mode} mode), set PILOT_PROMO_CODE, redeploy`,
  });
} else {
  // Without the secret the public API still answers the yes/no.
  const plans = await getJson<{ plans?: Array<{ id: string; yearlyAvailable?: boolean }> } | Array<{ id: string; yearlyAvailable?: boolean }>>("/api/payments/plans");
  const list = Array.isArray(plans.body) ? plans.body : (plans.body?.plans ?? []);
  const paid = list.filter((x) => x.id !== "free");
  const annual = paid.length > 0 && paid.every((x) => x.yearlyAvailable);
  const pilot = await getJson<{ enabled?: boolean; code?: string }>("/api/payments/pilot");
  add({ item: "L-9", title: "Stripe annual prices", status: annual ? "partial" : "todo", detail: annual ? `annual offered on the site (ids not validated: ${ownerNote})` : "the site says annual billing is \"coming soon\" — STRIPE_PRICE_YEARLY_* unset" });
  add({ item: "L-9", title: "Pilot promotion code", status: pilot.body?.enabled ? "partial" : "todo", detail: pilot.body?.enabled ? `/pilot shows ${pilot.body.code} (not checked against Stripe: ${ownerNote})` : "/pilot says no code is running — PILOT_PROMO_CODE unset" });
}

{
  const doc = readFileSync(resolve(ROOT, "docs/LAUNCH-GO-NO-GO.md"), "utf8");
  const section = doc.slice(doc.indexOf("## 5. Decision record"));
  const decided = section.split(/\r?\n/).filter((l) => /^\| \d{4}-\d{2}-\d{2} /.test(l));
  add(
    decided.length
      ? { item: "L-10", title: "Go / no-go decision", status: "done", detail: decided.at(-1)!.split("|").slice(1, 3).map((s) => s.trim()).join(" — ") }
      : { item: "L-10", title: "Go / no-go decision", status: "todo", detail: "docs/LAUNCH-GO-NO-GO.md §5 has no dated row", next: "last: fill §5 once L-1…L-9 are done or consciously deferred" },
  );
}

// ── Before the first pilot customer ─────────────────────────────────────────

add({ item: "P-1", title: "Real-device pass", status: "manual", detail: "iPhone Safari + Android Chrome through sign-up → quote → /p → /sign → /t → /join", next: "send the assistant the list of what was awkward" });
add({ item: "P-2", title: "A person with a screen reader", status: "manual", detail: "NVDA or VoiceOver through the same path" });
add({ item: "P-3", title: "Live AI pass", status: "manual", detail: "three real jobs in production: AI quote, contract, receipt, assistant" });

{
  const want = ["STRIPE_CONNECT_WEBHOOK_SECRET", "GOOGLE_CALENDAR_CLIENT_SECRET", "QUICKBOOKS_CLIENT_SECRET"];
  if (!vercel) add({ item: "P-4", title: "Vercel secrets as Sensitive", status: "unknown", detail: "run with VERCEL_TOKEN + VERCEL_PROJECT_ID (+ VERCEL_TEAM_ID) to check the variable types" });
  else {
    const readable = want.filter((k) => vercel.some((e) => e.key === k && e.type !== "sensitive"));
    add(readable.length ? { item: "P-4", title: "Vercel secrets as Sensitive", status: "todo", detail: `still readable: ${readable.join(", ")}`, next: "recreate each as Sensitive, redeploy" } : { item: "P-4", title: "Vercel secrets as Sensitive", status: "done", detail: "all three are Sensitive" });
  }
}

function varsRow(item: string, title: string, names: string[], next: string) {
  const set = setOnDeployment(names);
  if (!set) {
    add({ item, title, status: "unknown", detail: ownerNote });
    return;
  }
  const missing = names.filter((n) => !set.includes(n));
  add({ item, title, status: missing.length === 0 ? "done" : set.length === 0 ? "todo" : "partial", detail: missing.length ? `unset: ${missing.join(", ")}` : `${names.length} variable(s) set`, next: missing.length ? next : undefined });
}
varsRow("P-5", "Analytics + email events", ["POSTHOG_KEY", "VITE_POSTHOG_KEY", "RESEND_WEBHOOK_SECRET"], "PostHog project keys; Resend webhook → POST /api/webhooks/resend");

{
  const vj = JSON.parse(readFileSync(resolve(ROOT, "vercel.json"), "utf8")) as { crons?: Array<{ path: string; schedule: string }> };
  const tick = vj.crons?.find((c) => c.path === "/api/cron/tick");
  const hourly = !!tick && /^\S+ \* \* \* \*$/.test(tick.schedule);
  const stale = ready?.cron.staleAfterHours;
  add(
    hourly
      ? { item: "P-6", title: "Vercel Pro (hourly cron)", status: stale !== undefined && stale > 2 ? "partial" : "done", detail: `tick "${tick!.schedule}"${stale !== undefined ? `, stale after ${stale} h` : ""}`, next: stale !== undefined && stale > 2 ? "set CRON_STALE_AFTER_HOURS=2" : undefined }
      : { item: "P-6", title: "Vercel Pro (hourly cron)", status: "todo", detail: `tick "${tick?.schedule ?? "missing"}" — daily (Hobby plan)`, next: "upgrade to Pro, then tell the assistant: it moves the cron to hourly and CRON_STALE_AFTER_HOURS to 2" },
  );
}
add({ item: "P-7", title: "Help centre read-through", status: "manual", detail: "read the ten guides at /help in your own voice", next: "send the assistant what reads wrong" });

// ── When you want the feature live ───────────────────────────────────────────

varsRow("F-1", "WhatsApp", ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_NUMBER", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_LEAD_FOLLOWUP_TEMPLATE", "WHATSAPP_REVIEW_REQUEST_TEMPLATE", "WHATSAPP_PHOTO_SHARE_TEMPLATE"], "Meta Business Manager: submit the three templates, set the 8 vars");
varsRow("F-2", "SMS (Twilio)", ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"], "Twilio number + toll-free verification (PILOT-LAUNCH-PLAN O9)");
varsRow("F-3", "Gmail sending", ["GMAIL_SEND_CLIENT_ID", "GMAIL_SEND_CLIENT_SECRET", "GMAIL_SEND_REDIRECT_URI"], "Google Cloud OAuth app");
varsRow("F-4", "Outlook calendar", ["OUTLOOK_CALENDAR_CLIENT_ID", "OUTLOOK_CALENDAR_CLIENT_SECRET", "OUTLOOK_CALENDAR_REDIRECT_URI"], "Microsoft Entra app registration");
add({ item: "F-4b", title: "Google Calendar list scope", status: "manual", detail: "add calendar.calendarlist.readonly to the consent screen" });
varsRow("F-5", "Meta Lead Ads + Search Console", ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI", "META_LEADGEN_VERIFY_TOKEN", "GSC_SERVICE_ACCOUNT_KEY", "GSC_SITE_URL"], "app registrations");
add({ item: "F-6", title: "Partner access", status: "manual", detail: "Wave, Financeit, Flinks, Google LSA — each waits on the partner" });
add({ item: "F-7", title: "Payroll file layouts", status: "manual", detail: "import an export into a real Wagepoint / Payworks / QuickBooks Payroll account", next: "send the assistant their error or template" });

// ── Report ───────────────────────────────────────────────────────────────────

const openBlockers = [...new Set(rows.filter((r) => r.item.startsWith("L-") && r.status !== "done").map((r) => r.item))];

if (JSON_OUT) {
  console.log(JSON.stringify({ base: BASE, checkedAt: new Date().toISOString(), deployment: ready ? "checked" : ownerNote, rows }, null, 2));
} else {
  const mark: Record<Status, string> = { done: "DONE   ", todo: "TODO   ", partial: "PARTIAL", manual: "MANUAL ", unknown: "?      " };
  const w = Math.max(...rows.map((r) => r.title.length));
  const groups: Array<[string, string]> = [
    ["L-", "Blocks launch"],
    ["P-", "Before the first pilot customer"],
    ["F-", "When you want the feature live"],
  ];
  console.log(`\nQuoteAI owner check — ${BASE}  (docs/LAUNCH-FINISH-PLAN.md, Phase 99)`);
  if (!ready) console.log(`  deployment variables not checked: ${ownerNote}`);
  for (const [prefix, heading] of groups) {
    console.log(`\n${heading}`);
    for (const r of rows.filter((x) => x.item.startsWith(prefix))) {
      console.log(`  ${mark[r.status]}  ${r.item.padEnd(4)}  ${r.title.padEnd(w)}  ${r.detail}`);
      if (r.next && r.status !== "done") console.log(`  ${" ".repeat(7)}  ${" ".repeat(4)}  ${" ".repeat(w)}  → ${r.next}`);
    }
  }
  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  console.log(`\n${count("done")} done · ${count("partial")} partial · ${count("todo")} to do · ${count("manual")} manual · ${count("unknown")} not checked`);
  console.log(openBlockers.length ? `${openBlockers.length} launch blocker(s) open: ${openBlockers.join(", ")}\n` : "No launch blockers open — fill LAUNCH-GO-NO-GO §5.\n");
}

process.exit(openBlockers.length ? 1 : 0);
