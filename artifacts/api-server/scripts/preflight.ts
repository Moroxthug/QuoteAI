// Phase 82 (docs/PILOT-LAUNCH-PLAN.md): the pilot preflight.
//
// `LAUNCH-GO-NO-GO.md` §1 is a table a human reads and ticks. This asks the
// running deployment the same questions and answers them from what it
// actually does — so "is this ready for a paying contractor?" stops being a
// memory exercise the morning of the launch.
//
// It only reads: every check is a GET against the public surface, plus a few
// counting queries when a DATABASE_URL is given. Nothing is written, nothing
// is sent, no secret is printed.
//
//   pnpm --filter @workspace/api-server ops:preflight                        # QUOTEAI_BASE_URL from .env.staging
//   pnpm --filter @workspace/api-server ops:preflight -- --url https://quoteai.ca
//   pnpm --filter @workspace/api-server ops:preflight -- --url … --db "postgresql://…"
//   pnpm --filter @workspace/api-server ops:preflight -- --json
//
// Exit 1 if any check FAILS (a launch blocker), 0 with WARNs (things to know).
// The environment half — which vars Vercel is missing — is `pnpm env:inventory`;
// this is the deployment half, and the two together are the §1 table.

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import pg from "pg";
import { LEGAL_ENTITY, isLegalEntityConfigured } from "@workspace/legal-entity";
import { loadDotenv, STAGING_ENV_PATH } from "../src/e2e/qaEnv.js";

loadDotenv(STAGING_ENV_PATH);

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]!;
  if (!a.startsWith("--")) continue;
  const [k, inline] = a.slice(2).split("=") as [string, string | undefined];
  args.set(k, inline ?? (process.argv[i + 1]?.startsWith("--") === false ? process.argv[++i]! : "true"));
}

const BASE = (args.get("url") ?? process.env.QUOTEAI_BASE_URL ?? "http://localhost:5000").replace(/\/$/, "");
const DB_URL = args.get("db") ?? process.env.DATABASE_URL ?? "";
const JSON_OUT = args.has("json");
const TIMEOUT = Number(args.get("timeout") ?? 15_000);

type Status = "pass" | "warn" | "fail" | "skip";
type Check = { id: string; title: string; status: Status; detail: string; blocker?: string };
const checks: Check[] = [];
const add = (c: Check) => checks.push(c);

async function get(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT), redirect: "manual" });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  return { res, body };
}

async function check(id: string, title: string, blocker: string | undefined, fn: () => Promise<Omit<Check, "id" | "title" | "blocker">>) {
  try {
    add({ id, title, blocker, ...(await fn()) });
  } catch (err) {
    add({ id, title, blocker, status: "fail", detail: `unreachable: ${(err as Error).message}` });
  }
}

// ── The deployment answers ───────────────────────────────────────────────────

await check("api", "API is up", "1.7", async () => {
  const { res } = await get("/api/healthz");
  return res.ok ? { status: "pass", detail: `GET /api/healthz ${res.status}` } : { status: "fail", detail: `GET /api/healthz ${res.status}` };
});

await check("db", "Database reachable from the API", "1.7", async () => {
  const { res, body } = await get("/api/healthz/db");
  return res.ok ? { status: "pass", detail: `GET /api/healthz/db ${res.status}` } : { status: "fail", detail: `GET /api/healthz/db ${res.status} ${JSON.stringify(body).slice(0, 160)}` };
});

await check("cron", "Scheduler ran and the automation queue is clear", "1.7", async () => {
  const { res, body } = await get("/api/healthz/ops");
  const h = body as { status?: string; cron?: { lastOkAt?: string | null; stale?: boolean; staleAfterHours?: number }; automations?: { failed?: number; dead?: number }; problems?: string[] };
  if (res.status === 200 && h.status === "ok") return { status: "pass", detail: `last successful tick ${h.cron?.lastOkAt ?? "?"} (stale after ${h.cron?.staleAfterHours}h)` };
  if (res.status === 503) return { status: "fail", detail: (h.problems ?? ["degraded"]).join("; ") };
  return { status: "fail", detail: `GET /api/healthz/ops ${res.status}` };
});

await check("headers", "Security headers on every API response", undefined, async () => {
  const { res } = await get("/api/healthz");
  const want: Array<[string, (v: string | null) => boolean, string]> = [
    ["x-content-type-options", (v) => v === "nosniff", "nosniff"],
    ["x-frame-options", (v) => v === "DENY", "DENY"],
    ["content-security-policy", (v) => !!v?.includes("frame-ancestors 'none'"), "frame-ancestors 'none'"],
    ["referrer-policy", (v) => v === "no-referrer", "no-referrer"],
    ["strict-transport-security", (v) => !!v && /max-age=\d+/.test(v), "max-age"],
  ];
  const missing = want.filter(([h, ok]) => !ok(res.headers.get(h))).map(([h, , expect]) => `${h} (want ${expect})`);
  // HSTS is added by the platform on https only; over http locally it is absent by design.
  const overHttp = BASE.startsWith("http://");
  const real = missing.filter((m) => !(overHttp && m.startsWith("strict-transport-security")));
  return real.length ? { status: "fail", detail: `missing//wrong: ${real.join(", ")}` } : { status: "pass", detail: `${want.length - (overHttp ? 1 : 0)} headers present` };
});

await check("cors", "CORS refuses an unknown origin", undefined, async () => {
  const { res } = await get("/api/healthz", { headers: { origin: "https://not-a-quoteai-origin.example" } });
  const allow = res.headers.get("access-control-allow-origin");
  return allow ? { status: "fail", detail: `access-control-allow-origin: ${allow}` } : { status: "pass", detail: "no access-control-allow-origin for an unknown origin" };
});

await check("plans", "Subscription plans are priced", "1.7", async () => {
  const { res, body } = await get("/api/payments/plans");
  if (!res.ok) return { status: "fail", detail: `GET /api/payments/plans ${res.status}` };
  type Plan = { id: string; price?: number; yearlyAvailable?: boolean };
  const raw = Array.isArray(body) ? (body as Plan[]) : ((body as { plans?: Plan[] }).plans ?? []);
  const plans = raw.filter((p) => p.id !== "free");
  const unpriced = plans.filter((p) => !p.price);
  if (!plans.length || unpriced.length) return { status: "fail", detail: unpriced.length ? `no price on ${unpriced.map((p) => p.id).join(", ")}` : "no paid plans returned" };
  const annual = plans.every((p) => p.yearlyAvailable);
  return {
    status: annual ? "pass" : "warn",
    detail: annual
      ? `${plans.length} paid plans, annual available`
      : `${plans.length} paid plans priced; annual unavailable — STRIPE_PRICE_YEARLY_* unset (owner track O9), the toggle says "coming soon"`,
  };
});

await check("pilot", "Pilot promo code", undefined, async () => {
  const { res, body } = await get("/api/payments/pilot");
  if (!res.ok) return { status: "fail", detail: `GET /api/payments/pilot ${res.status}` };
  const p = body as { enabled?: boolean; code?: string | null; provinces?: string[] };
  return p.enabled
    ? { status: "pass", detail: `code ${p.code} in ${(p.provinces ?? []).join("/")}` }
    : { status: "warn", detail: "no code running — PILOT_PROMO_CODE unset (owner track O12); /pilot says so and checkout falls back to Stripe's promo box" };
});

await check("tax", "Statutory tax profiles for the pilot provinces", "1.8", async () => {
  const { res, body } = await get("/api/tax-profiles");
  if (!res.ok) return { status: "fail", detail: `GET /api/tax-profiles ${res.status}` };
  const profiles = (body as { profiles?: Array<{ province: string; totalRate: number }> }).profiles ?? [];
  const want: Record<string, number> = { BC: 12, ON: 13, QC: 14.975 };
  const wrong = Object.entries(want)
    .map(([p, rate]) => ({ p, rate, got: profiles.find((x) => x.province === p)?.totalRate }))
    .filter((x) => x.got !== x.rate);
  return wrong.length
    ? { status: "fail", detail: wrong.map((x) => `${x.p}: ${x.got ?? "missing"} ≠ ${x.rate}`).join(", ") }
    : { status: "pass", detail: "BC 12 %, ON 13 %, QC 14.975 %" };
});

await check("tokens", "A bogus public token is refused, not crashed", undefined, async () => {
  const probes = ["/api/p/00000000-0000-0000-0000-000000000000", `/api/t/${"z".repeat(43)}`, `/api/i/${"z".repeat(43)}`];
  const bad: string[] = [];
  for (const p of probes) {
    const { res } = await get(p);
    if (res.status >= 500) bad.push(`${p} → ${res.status}`);
  }
  return bad.length ? { status: "fail", detail: bad.join(", ") } : { status: "pass", detail: `${probes.length} token routes answer 4xx` };
});

// Source-side, not deployment-side: LEGAL_ENTITY is a constant in the repo,
// so this reports what the next deploy will say, not what is live.
await check("legal", "Registered legal identity is filled in (this checkout)", "1.4", async () => {
  return isLegalEntityConfigured()
    ? { status: "pass", detail: `${LEGAL_ENTITY.legalName} — policies, footers and emails name the business` }
    : { status: "fail", detail: 'LEGAL_ENTITY blank — every legal surface says plain "QuoteAI" (owner track O5)' };
});

// ── The database ─────────────────────────────────────────────────────────────

if (!DB_URL) {
  add({ id: "fixtures", title: "No test fixtures in the target database", status: "skip", detail: "no --db / DATABASE_URL given" });
} else {
  const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await check("fixtures", "No test fixtures in the target database", "1.6", async () => {
      const { rows } = await client.query<{ n: string }>("select count(*)::text as n from auth_user where email like '%@example.invalid' or id like 'e2e\\_%'");
      const n = Number(rows[0]?.n ?? 0);
      return n === 0
        ? { status: "pass", detail: "no e2e accounts" }
        : { status: "fail", detail: `${n} e2e account(s) — the suite has been run against this database; give CI its own project (owner track O3)` };
    });
    // Migrations here are applied by hand (`supabase db query --linked`), so
    // there is no journal table to read: the honest question is whether the
    // database still has everything the schema declares.
    await check("schema", "Database schema matches the code", "1.6", async () => {
      const drift = spawnSync("pnpm", ["--filter", "@workspace/db", "schema-drift"], {
        cwd: resolve(import.meta.dirname, "../../.."),
        env: { ...process.env, DATABASE_URL: DB_URL },
        encoding: "utf8",
        shell: process.platform === "win32", // pnpm is a .cmd here
      });
      if (drift.status === 0) return { status: "pass", detail: "no missing tables, columns, enums, keys or indexes" };
      const lines = `${drift.stdout ?? ""}${drift.stderr ?? ""}`.split(/\r?\n/).filter((l) => /missing|MISSING|✗/.test(l));
      return { status: "fail", detail: lines.slice(0, 3).join(" · ") || "schema-drift exited non-zero — run it for the detail" };
    });
    await check("accounts", "Live accounts", undefined, async () => {
      const { rows } = await client.query<{ n: string }>("select count(*)::text as n from auth_user where email not like '%@example.invalid'");
      return { status: "pass", detail: `${rows[0]?.n ?? "?"} non-test account(s)` };
    });
  } catch (err) {
    add({ id: "db-connect", title: "Database connection", status: "fail", detail: (err as Error).message.slice(0, 200) });
  } finally {
    await client.end().catch(() => {});
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

const failed = checks.filter((c) => c.status === "fail");
const warned = checks.filter((c) => c.status === "warn");

if (JSON_OUT) {
  console.log(JSON.stringify({ base: BASE, checkedAt: new Date().toISOString(), ok: failed.length === 0, checks }, null, 2));
} else {
  const mark = { pass: "PASS", warn: "WARN", fail: "FAIL", skip: "SKIP" } as const;
  const w = Math.max(...checks.map((c) => c.title.length));
  console.log(`\nQuoteAI preflight — ${BASE}${DB_URL ? " + database" : ""}\n`);
  for (const c of checks) console.log(`  ${mark[c.status]}  ${c.title.padEnd(w)}  ${c.detail}${c.blocker && c.status === "fail" ? `  [go/no-go ${c.blocker}]` : ""}`);
  console.log(
    failed.length
      ? `\n${failed.length} blocker(s): ${failed.map((c) => c.id).join(", ")}${warned.length ? ` · ${warned.length} warning(s)` : ""}\n` +
          "Not ready for a paying customer. Also run `pnpm env:inventory` for the environment half.\n"
      : `\nNo blockers${warned.length ? `, ${warned.length} warning(s) to know about` : ""}. Also run \`pnpm env:inventory\` for the environment half.\n`,
  );
}

process.exit(failed.length ? 1 : 0);
