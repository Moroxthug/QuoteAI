// Phase 62 (docs/QA-VERIFICATION-PLAN.md): the route-matrix regression guard.
//
// Every rule below was true of the codebase when this landed. A new route that
// breaks one fails CI with the offending row; the fix is either to gate the
// route or to add an allowlist entry *with a reason* — never to loosen a rule.
// docs/ROUTE-MATRIX.md must be regenerated whenever routes change:
//   pnpm --filter @workspace/api-server route-matrix

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildRouteMatrix, renderMarkdown, MATRIX_PATH, type RouteRow } from "./route-matrix.js";

const rows = buildRouteMatrix();
const key = (r: RouteRow) => `${r.method} ${r.path}`;
const find = (method: string, path: string) => rows.find((r) => r.method === method && r.path === path);

/** Allowlist entry: a path pattern plus the reason it is exempt from a rule. */
type Allow = { match: RegExp; reason: string };
const allowed = (list: Allow[], r: RouteRow) => list.some((a) => a.match.test(key(r)));
const violations = (filter: (r: RouteRow) => boolean, list: Allow[]) => rows.filter((r) => filter(r) && !allowed(list, r)).map(key);

// ── Rule 1: every route without requireAuth/requireApiKey/requireAdmin is deliberately public ──

const PUBLIC_ROUTES: Allow[] = [
  { match: /^POST \/api\/(payments\/(connect-)?webhook|webhooks\/(financeit|resend)|whatsapp\/webhook|meta-lead-ads\/webhook|sms\/webhook)$/, reason: "inbound provider webhook — signature verified (Rule 7)" },
  { match: /^GET \/api\/(whatsapp|meta-lead-ads)\/webhook$/, reason: "Meta hub.challenge verification handshake (hub.verify_token checked)" },
  { match: /^GET \/api\/healthz(\/db|\/ops)?$/, reason: "liveness/readiness/ops probes (Phase 69: /ops is rate limited and reveals counts + timestamps only)" },
  { match: /^GET \/api\/tax-profiles$/, reason: "Phase 71: static Canadian sales-tax table for the quote builder; no data, cache-control 1 day" },
  { match: /^GET \/api\/settings\/registration$/, reason: "public 'is sign-up open' flag read by the auth pages" },
  { match: /^GET \/api\/payments\/plans$/, reason: "public pricing table" },
  { match: /^GET \/api\/cron\/tick$/, reason: "Vercel cron — handler checks `Authorization: Bearer $CRON_SECRET` itself" },
  { match: /^GET \/api\/storage\/public-objects\/\*filePath$/, reason: "public bucket (logos etc.) by design" },
  { match: /^GET \/api\/support\/admin-status$/, reason: "widget reads whether a human is online; no data" },
  { match: /^(GET|POST) \/api\/support\/conversations(\/:id\/(messages|request-human|close))?$/, reason: "anonymous support widget — per-conversation token via requireConversationAccess, IP rate limited" },
  { match: /^GET \/api\/team\/invite\/:token$/, reason: "invite preview — hashed token lookup, rate limited" },
  { match: /^(GET|POST|DELETE) \/api\/(i|sign|t)\/:token/, reason: "customer/worker magic links — hashed token lookup, rate limited (Rule 6)" },
  { match: /^(GET|POST) \/api\/public\//, reason: "public quote widget + unsubscribe links — rate limited (Rule 6)" },
  { match: /^GET \/api\/account\/deletion\/cancel\/:token$/, reason: "Phase 72: cancel-deletion link from the confirmation email — the person is signed out by then; hashed single-use token, IP rate limited" },
];

// ── Rule 2: every mutating session route names a permission ──────────────────

const PERMISSIONLESS_MUTATIONS: Allow[] = [
  { match: /^POST \/api\/notifications\/read$/, reason: "marks the actor's own notifications read — any role" },
  { match: /^POST \/api\/storage\/uploads\/request-url$/, reason: "signed upload URL scoped to the acting org; the consuming route enforces its own permission" },
  { match: /^POST \/api\/team\/invite\/:token\/accept$/, reason: "the invitee is joining — has no role in the org yet" },
  { match: /^POST \/api\/team\/switch$/, reason: "switches the actor's own active org" },
  { match: /^POST \/api\/team\/members\/leave$/, reason: "Phase 72: the actor removes their own membership — no role needed" },
  { match: /^(POST|DELETE) \/api\/account(\/export)?$/, reason: "Phase 72: acts on the actor's own account (owner check inline for the export); password re-auth on DELETE" },
];

// ── Rule 3: feature entry points check the plan flag ─────────────────────────
// Policy (Phase 62): the route that *creates* a gated resource or *connects* an
// integration checks the flag; reading/editing/deleting rows that already exist
// is allowed after a downgrade so nobody is locked out of their own data.

const FEATURE_ENTRY_ROUTES: [string, string, string][] = [
  ["POST", "/api/contracts/from-quote/:quoteId", "contracts"],
  ["POST", "/api/jobs", "jobs"],
  ["POST", "/api/jobs/:id/change-orders", "jobs"],
  ["POST", "/api/jobs/:id/costs", "costs"],
  ["POST", "/api/costs/receipts", "costs"],
  ["POST", "/api/invoices", "invoicing"],
  ["POST", "/api/jobs/:id/invoices", "invoicing"],
  ["POST", "/api/invoices/:id/send", "invoicing"],
  ["POST", "/api/invoices/:id/credit-note", "invoicing"],
  ["POST", "/api/team/workers", "team_time"],
  ["POST", "/api/team/workers/:wid/invite", "team_time"],
  ["POST", "/api/team/equipment", "team_time"],
  ["POST", "/api/jobs/:id/time-entries", "team_time"],
  ["POST", "/api/assistant/conversations/:id/messages", "assistant"],
  ["GET", "/api/analytics/company", "analytics_pro"],
  ["POST", "/api/team/members/invite", "team_accounts"],
  ["GET", "/api/quickbooks/connect", "quickbooks_sync"],
  ["GET", "/api/calendar/:provider/connect", "calendar_sync"],
  ["POST", "/api/invoice-payments/connect/onboard", "invoice_card_payments"],
  ["PUT", "/api/financeit/dealer", "financeit"],
  ["POST", "/api/developer/api-keys", "public_api"],
  ["POST", "/api/developer/webhooks", "public_api"],
  ["GET", "/api/email-connections/:provider/connect", "gmail_send"],
  ["GET", "/api/wave/connect", "wave_sync"],
  ["GET", "/api/flinks/connect-url", "flinks_bank_feed"],
  ["POST", "/api/flinks/connect", "flinks_bank_feed"],
  ["POST", "/api/flinks/sync", "flinks_bank_feed"],
  ["GET", "/api/meta-lead-ads/connect", "meta_lead_ads"],
  ["GET", "/api/google-lsa/connect", "google_lsa"],
];

// ── Rule 4: every `:param` handler is tied to the acting org ─────────────────

const UNSCOPED_PARAM_ROUTES: Allow[] = [
  { match: /^POST \/api\/team\/invite\/:token\/accept$/, reason: "looked up by hashed invite token and matched against the actor's email — there is no org to scope by yet" },
];

// ── Rule 5: list endpoints exclude archived rows ─────────────────────────────

const ARCHIVE_EXCEPTIONS: Allow[] = [
  { match: /^GET \/api\/clients$/, reason: "virtual aggregation over quotes (Phase 47's documented exception)" },
  { match: /^GET \/api\/invoices$/, reason: "invoicesForUser() in invoices/service.ts filters isNull(archivedAt)" },
  { match: /^GET \/api\/(invoices|v1\/public)\/clients$/, reason: "clients pickers keep parity with /api/clients — archived clients stay selectable" },
];

describe("route matrix (Phase 62)", () => {
  it("parses a sane number of routes", () => {
    expect(rows.length).toBeGreaterThan(300);
    expect(new Set(rows.map((r) => r.file)).size).toBeGreaterThan(45);
  });

  it("rule 1: every route without auth middleware is on the public allowlist", () => {
    expect(violations((r) => r.auth === "none", PUBLIC_ROUTES)).toEqual([]);
  });

  it("rule 1b: nothing on the public allowlist has quietly grown auth (keep the list honest)", () => {
    const stale = PUBLIC_ROUTES.filter((a) => !rows.some((r) => r.auth === "none" && a.match.test(key(r)))).map((a) => a.match.source);
    expect(stale).toEqual([]);
  });

  it("rule 2: every mutating session route names a permission", () => {
    expect(violations((r) => r.auth === "session" && r.mutating && !r.permission, PERMISSIONLESS_MUTATIONS)).toEqual([]);
  });

  it("rule 2b: every public-API route is permissioned and rate limited", () => {
    const bad = rows.filter((r) => r.auth === "apiKey" && (!r.permission || !r.rateLimit)).map(key);
    expect(bad).toEqual([]);
  });

  it("rule 3: feature entry points check the plan flag", () => {
    const missing: string[] = [];
    for (const [method, path, feature] of FEATURE_ENTRY_ROUTES) {
      const row = find(method, path);
      if (!row) missing.push(`${method} ${path} (route not found — update FEATURE_ENTRY_ROUTES)`);
      else if (!row.featureGate?.includes(feature) && !row.featureGate?.startsWith("require") && !row.featureGate?.startsWith("assert")) missing.push(`${method} ${path} → ${row.featureGate ?? "no gate"} (expected ${feature})`);
    }
    expect(missing).toEqual([]);
  });

  it("rule 4: every :param handler scopes by the acting org", () => {
    expect(violations((r) => r.tenantScope === "NONE", UNSCOPED_PARAM_ROUTES)).toEqual([]);
  });

  it("rule 5: list endpoints over archivable tables exclude archived rows", () => {
    expect(violations((r) => r.archived !== null && r.archived.status !== "ok", ARCHIVE_EXCEPTIONS)).toEqual([]);
  });

  it("rule 6: every public token route is rate limited and never compares secrets with ===", () => {
    const tokenRoutes = rows.filter((r) => r.auth === "none" && r.tokenCompare !== null);
    expect(tokenRoutes.length).toBeGreaterThan(20);
    expect(tokenRoutes.filter((r) => !r.rateLimit).map(key)).toEqual([]);
    expect(rows.filter((r) => r.tokenCompare === "PLAIN").map(key)).toEqual([]);
  });

  it("rule 7: every inbound webhook verifies its signature", () => {
    const byPath = new Map<string, RouteRow[]>();
    for (const r of rows) if (r.webhookVerify !== null) byPath.set(r.path, [...(byPath.get(r.path) ?? []), r]);
    expect(byPath.size).toBeGreaterThanOrEqual(6);
    // app.ts verifies WhatsApp/Meta before express.json() and calls next() into
    // the router's own POST — so at least one registration per path must verify.
    const unverified = [...byPath].filter(([, group]) => !group.some((r) => r.webhookVerify !== "NONE")).map(([p]) => p);
    expect(unverified).toEqual([]);
  });

  it("docs/ROUTE-MATRIX.md is up to date", () => {
    const committed = readFileSync(MATRIX_PATH, "utf8").replace(/\r\n/g, "\n");
    expect(committed).toBe(renderMarkdown(rows));
  });
});
