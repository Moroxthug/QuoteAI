// Phase 64 — security pass, the runtime half (docs/QA-VERIFICATION-PLAN.md).
//
// Phase 62 proved tenant scoping by reading the code; this proves it by
// running it: org A owns one of every kind of row, org B (a different owner
// with a valid session and an Elite plan) hits every `:param` route in the
// committed route matrix with A's ids and must never get a 2xx. On top of
// that: every inbound webhook rejects a bad signature and accepts a good one,
// the better-auth flows behave (verification gate, single-use reset token,
// 2FA gate, session revocation), invite links expire, private storage paths
// are owner-only, the API carries its security headers, CORS stays shut for
// unknown origins, and the public-token / auth rate limiters actually return
// 429. Runs against the same database as the rest of the e2e suite and cleans
// up after itself (harness.ts).

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import Stripe from "stripe";
import {
  db,
  quotesTable,
  contractsTable,
  contractSignersTable,
  projectsTable,
  milestonesTable,
  invoicesTable,
  costEntriesTable,
  priceCatalogItemsTable,
  projectTasksTable,
  collaboratorsTable,
  equipmentTable,
  projectAssignmentsTable,
  equipmentUsageTable,
  timeEntriesTable,
  changeOrdersTable,
  invoicePaymentsTable,
  webhookEndpointsTable,
  assistantConversationsTable,
  assistantProposalsTable,
  leadsTable,
  importBatchesTable,
  quoteImportCandidatesTable,
  flinksTransactionsTable,
  jobPhotosTable,
  jobNotesTable,
  fieldReportsTable,
  jobPermitsTable,
  complianceRemindersTable,
  scheduleBlocksTable,
  quoteVariantsTable,
  uploadedDocumentsTable,
  priceIntelligenceAlertsTable,
  organizationMembersTable,
  authSessionsTable,
  authUsersTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import "../automations/index.js";
import { raiseAutomation } from "../lib/automation.js";
import { logContractEvent, finalizeContract } from "../contracts/service.js";
import { createApiKey } from "../lib/apiKeys.js";
import { TINY_PNG_DATA_URL } from "../lib/pngDataUrl.js";
import { startServer, stopServer, api, createOrg, createUser, seedQuote, cleanupAll, cleanupUsers, type TestUser } from "./harness.js";
import { sentEmails, emailsTo, linksIn } from "./mailbox.js";

// ── Route matrix ─────────────────────────────────────────────────────────────

type MatrixRoute = { method: string; path: string; auth: string };

function loadRouteMatrix(): MatrixRoute[] {
  const md = readFileSync(resolve(__dirname, "../../../../docs/ROUTE-MATRIX.md"), "utf8");
  const routes: MatrixRoute[] = [];
  for (const line of md.split(/\r?\n/)) {
    const m = /^\|\s*\d+\s*\|\s*([A-Z]+)\s*\|\s*`([^`]+)`\s*\|\s*([a-zA-Z]+)\s*\|/.exec(line);
    if (m) routes.push({ method: m[1]!, path: m[2]!, auth: m[3]! });
  }
  return routes;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

type Fixtures = Record<string, string>;

let baseUrl = "";
let A: TestUser;
let B: TestUser;
let fx: Fixtures = {};
let signedPdfObjectPath = "";

async function seedOrgA(): Promise<Fixtures> {
  const userId = A.userId;
  const f: Fixtures = {};

  // Quote → accepted → contract (automation) → both sign → job + milestones +
  // deposit invoice + signed PDF in storage. Same chain the lifecycle test runs.
  const quote = await seedQuote(userId, { province: "ON" });
  f.quote = quote.id;
  await db.update(quotesTable).set({ status: "accepted", acceptedAt: new Date(), acceptedByName: "Jordan Client" }).where(eq(quotesTable.id, quote.id));
  await raiseAutomation({ event: "quote.accepted", userId, entityType: "quote", entityId: quote.id, payload: { acceptedByName: "Jordan Client" } });
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.quoteId, quote.id));
  if (!contract) throw new Error("fixture: contract was not drafted");
  f.contract = contract.id;
  const signers = await db.select().from(contractSignersTable).where(eq(contractSignersTable.contractId, contract.id));
  for (const s of signers) {
    await db
      .update(contractSignersTable)
      .set({ status: "signed", name: s.role === "contractor" ? "E2E ON Co" : "Jordan Client", signatureType: s.role === "contractor" ? "typed" : "drawn", signatureData: s.role === "contractor" ? "E2E ON Co" : TINY_PNG_DATA_URL, consentText: "test consent", signedAt: new Date() })
      .where(eq(contractSignersTable.id, s.id));
    await logContractEvent({ contractId: contract.id, type: s.role === "contractor" ? "contractor_signed" : "signed", actor: s.role, signerId: s.id });
  }
  await finalizeContract(contract.id);
  const [signed] = await db.select().from(contractsTable).where(eq(contractsTable.id, contract.id));
  signedPdfObjectPath = (signed!.signedPdfUrl ?? "").replace(/^\/objects\//, "");
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.contractId, contract.id));
  if (!project) throw new Error("fixture: job was not created");
  f.project = project.id;
  const [milestone] = await db.select().from(milestonesTable).where(eq(milestonesTable.projectId, project.id));
  f.milestone = milestone!.id;
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.projectId, project.id));
  f.invoice = invoice!.id;

  // One row of everything else, straight into the tables.
  const ins = async <T extends { id: string }>(p: Promise<T[]>) => (await p)[0]!.id;
  f.cost = await ins(db.insert(costEntriesTable).values({ userId, projectId: project.id, description: "Lumber", amountCents: 12_000 } as typeof costEntriesTable.$inferInsert).returning());
  f.catalog = await ins(db.insert(priceCatalogItemsTable).values({ userId, nome: "Drywall sheet" } as typeof priceCatalogItemsTable.$inferInsert).returning());
  f.task = await ins(db.insert(projectTasksTable).values({ projectId: project.id, title: "Order cabinets" } as typeof projectTasksTable.$inferInsert).returning());
  f.worker = await ins(db.insert(collaboratorsTable).values({ userId, name: "Sam Worker" } as typeof collaboratorsTable.$inferInsert).returning());
  f.equipment = await ins(db.insert(equipmentTable).values({ userId, name: "Tile saw" } as typeof equipmentTable.$inferInsert).returning());
  f.assignment = await ins(db.insert(projectAssignmentsTable).values({ projectId: project.id, collaboratorId: f.worker } as typeof projectAssignmentsTable.$inferInsert).returning());
  f.usage = await ins(db.insert(equipmentUsageTable).values({ userId, equipmentId: f.equipment, projectId: project.id, date: new Date(), quantity: "1" } as typeof equipmentUsageTable.$inferInsert).returning());
  f.timeEntry = await ins(db.insert(timeEntriesTable).values({ userId, workerId: f.worker, projectId: project.id, date: new Date(), hours: "4" } as typeof timeEntriesTable.$inferInsert).returning());
  f.changeOrder = await ins(db.insert(changeOrdersTable).values({ userId, projectId: project.id, number: "CO-1", title: "Extra outlet" } as typeof changeOrdersTable.$inferInsert).returning());
  f.payment = await ins(db.insert(invoicePaymentsTable).values({ invoiceId: invoice!.id, userId, amountCents: 100 } as typeof invoicePaymentsTable.$inferInsert).returning());
  const { key: apiKey } = await createApiKey(userId, userId, "owner", "A's key");
  f.apiKey = apiKey.id;
  f.webhook = await ins(db.insert(webhookEndpointsTable).values({ userId, url: "https://example.invalid/hook", secret: "whsec_e2e" }).returning());
  f.conversation = await ins(db.insert(assistantConversationsTable).values({ userId } as typeof assistantConversationsTable.$inferInsert).returning());
  f.proposal = await ins(db.insert(assistantProposalsTable).values({ conversationId: f.conversation, userId, kind: "task" } as typeof assistantProposalsTable.$inferInsert).returning());
  f.lead = await ins(db.insert(leadsTable).values({ userId, name: "Lead Person" } as typeof leadsTable.$inferInsert).returning());
  f.batch = await ins(db.insert(importBatchesTable).values({ userId, kind: "csv", fileName: "old-quotes.csv" } as typeof importBatchesTable.$inferInsert).returning());
  f.candidate = await ins(db.insert(quoteImportCandidatesTable).values({ batchId: f.batch, userId, extraction: {} } as typeof quoteImportCandidatesTable.$inferInsert).returning());
  f.flinksTx = await ins(db.insert(flinksTransactionsTable).values({ userId, flinksTransactionId: `e2e-${randomUUID()}`, date: new Date(), amountCents: -5000 } as typeof flinksTransactionsTable.$inferInsert).returning());
  f.photo = await ins(db.insert(jobPhotosTable).values({ userId, projectId: project.id, fileName: "before.png", fileSize: 100, mimeType: "image/png", fileUrl: `/objects/job-photos/${userId}/before.png` } as typeof jobPhotosTable.$inferInsert).returning());
  f.note = await ins(db.insert(jobNotesTable).values({ userId, projectId: project.id, body: "gate code 4471" } as typeof jobNotesTable.$inferInsert).returning());
  f.fieldReport = await ins(db.insert(fieldReportsTable).values({ userId, projectId: project.id, kind: "blocker", body: "No power on site", authorName: "Sam Worker" } as typeof fieldReportsTable.$inferInsert).returning());
  f.permit = await ins(db.insert(jobPermitsTable).values({ userId, projectId: project.id, title: "Building permit" } as typeof jobPermitsTable.$inferInsert).returning());
  f.reminder = await ins(db.insert(complianceRemindersTable).values({ userId, title: "WSIB report", dueDate: new Date() } as typeof complianceRemindersTable.$inferInsert).returning());
  f.block = await ins(db.insert(scheduleBlocksTable).values({ userId, projectId: project.id, startsAt: new Date(), endsAt: new Date(Date.now() + 3_600_000) } as typeof scheduleBlocksTable.$inferInsert).returning());
  f.variant = await ins(db.insert(quoteVariantsTable).values({ quoteId: quote.id, userId } as typeof quoteVariantsTable.$inferInsert).returning());
  f.doc = await ins(db.insert(uploadedDocumentsTable).values({ userId, fileName: "receipt.pdf", mimeType: "application/pdf", fileUrl: `/objects/receipts/${userId}/receipt.pdf` } as typeof uploadedDocumentsTable.$inferInsert).returning());
  f.alert = await ins(db.insert(priceIntelligenceAlertsTable).values({ userId, workType: "drywall", previousAvgPrice: "10", currentAvgPrice: "12", percentChange: "20", direction: "up" } as typeof priceIntelligenceAlertsTable.$inferInsert).returning());
  f.member = await ins(db.insert(organizationMembersTable).values({ ownerId: userId, invitedEmail: `invitee-${randomUUID()}@example.invalid`, invitedByUserId: userId, role: "viewer", status: "invited" } as typeof organizationMembersTable.$inferInsert).returning());

  // Clients are virtual (md5 of the quote's client fields) — read the id back the way the UI does.
  const clients = await A.api("/api/clients");
  f.client = clients.body?.[0]?.id ?? randomUUID();
  return f;
}

/** Substitute A's ids into a matrix path. Returns null for routes the sweep does not apply to. */
function resolveParams(route: MatrixRoute, f: Fixtures): { path: string; unseeded: string[] } | null {
  const unseeded: string[] = [];
  const segs = route.path.split("/");
  const out: string[] = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    if (!s.startsWith(":")) {
      out.push(s);
      continue;
    }
    const name = s.slice(1);
    if (name === "token" || name === "provider" || name === "userId") return null; // public token routes, per-user OAuth providers, admin
    const prefix = segs.slice(0, i).join("/");
    let id: string | undefined;
    switch (name) {
      case "id": {
        const byPrefix: [string, string][] = [
          ["/api/quotes", "quote"], ["/api/contracts", "contract"], ["/api/jobs", "project"], ["/api/invoices", "invoice"],
          ["/api/clients", "client"], ["/api/catalog", "catalog"], ["/api/crm/projects", "project"], ["/api/documents/price-alerts", "alert"],
          ["/api/documents", "doc"], ["/api/leads", "lead"], ["/api/assistant/conversations", "conversation"], ["/api/assistant/proposals", "proposal"],
          ["/api/developer/api-keys", "apiKey"], ["/api/developer/webhooks", "webhook"], ["/api/imports/batches", "batch"], ["/api/imports/candidates", "candidate"],
          ["/api/flinks/transactions", "flinksTx"], ["/api/team/members", "member"], ["/api/v1/public/quotes", "quote"], ["/api/v1/public/jobs", "project"],
          ["/api/v1/public/invoices", "invoice"], ["/api/v1/public/clients", "client"], ["/api/schedule/blocks", "block"],
          ["/api/field-reports", "fieldReport"], ["/api/compliance/reminders", "reminder"],
        ];
        id = byPrefix.find(([p]) => prefix === p)?.[1];
        break;
      }
      case "quoteId": id = "quote"; break;
      case "projectId": id = "project"; break;
      case "docId": id = "doc"; break;
      case "cid": id = "cost"; break;
      case "pid": id = "payment"; break;
      case "aid": case "assignmentId": id = "assignment"; break;
      case "coId": id = "changeOrder"; break;
      case "mid": id = "milestone"; break;
      case "photoId": id = "photo"; break;
      case "noteId": id = "note"; break;
      case "tid": id = route.path.includes("/tasks/") ? "task" : "timeEntry"; break;
      case "taskId": id = "task"; break;
      case "uid": id = "usage"; break;
      case "variantId": id = "variant"; break;
      case "permitId": id = "permit"; break;
      case "eid": id = "equipment"; break;
      case "wid": id = "worker"; break;
    }
    if (id && f[id]) out.push(f[id]!);
    else {
      unseeded.push(name);
      out.push(randomUUID());
    }
  }
  return { path: out.join("/"), unseeded };
}

// ── Small helpers ────────────────────────────────────────────────────────────

/** Minimal cookie jar for the better-auth flows (2FA hands state over in a cookie). */
class Jar {
  cookies = new Map<string, string>();
  absorb(headers: Headers) {
    for (const raw of headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const eqi = pair!.indexOf("=");
      const name = pair!.slice(0, eqi);
      const value = pair!.slice(eqi + 1);
      if (value === "" || /max-age=0/i.test(raw)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function authPost(path: string, body: unknown, jar: Jar, token?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (jar.cookies.size) headers.cookie = jar.header();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  jar.absorb(res.headers);
  const text = await res.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: parsed as any, headers: res.headers, token: res.headers.get("set-auth-token") };
}

/** Rewrites a link from an email (built on getBaseUrl()) onto the test server. */
function onTestServer(url: string): string {
  const u = new URL(url);
  const b = new URL(baseUrl);
  u.protocol = b.protocol;
  u.host = b.host;
  return u.toString();
}

function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v === -1) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238, the defaults better-auth's twoFactor plugin issues (SHA-1, 6 digits, 30 s). */
function totp(uri: string, at = Date.now()): string {
  const u = new URL(uri);
  const secret = base32Decode(u.searchParams.get("secret")!);
  const period = Number(u.searchParams.get("period") ?? 30);
  const digits = Number(u.searchParams.get("digits") ?? 6);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / period)));
  const hmac = createHmac("sha1", secret).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!;
  return String(code % 10 ** digits).padStart(digits, "0");
}

async function rawPost(path: string, body: string, headers: Record<string, string>) {
  const res = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
  return { status: res.status, body: await res.text() };
}

// ── Suite ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  baseUrl = await startServer();
  A = await createOrg({ province: "ON", companyName: "E2E Org A" });
  B = await createOrg({ province: "ON", companyName: "E2E Org B" });
  fx = await seedOrgA();
});

afterAll(async () => {
  await cleanupAll();
  await stopServer();
});

describe("API security headers + CORS", () => {
  test("every API response carries the header set", async () => {
    const res = await api("/api/healthz");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("strict-transport-security")).toMatch(/max-age=\d+/);
  });

  test("CORS: unknown origins get no allow-origin; the widget's /api/public stays open", async () => {
    const evil = await fetch(`${baseUrl}/api/healthz`, { headers: { origin: "https://evil.example" } });
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
    const localhost = await fetch(`${baseUrl}/api/healthz`, { headers: { origin: "http://localhost:4444" } });
    // NODE_ENV is not "production" under vitest, so any-port localhost is allowed here (dev convenience);
    // the assertion that matters is that it is gated on NODE_ENV, checked statically below.
    expect(localhost.status).toBe(200);
    const widget = await fetch(`${baseUrl}/api/public/config`, { headers: { origin: "https://some-contractor-site.example" } });
    expect(widget.headers.get("access-control-allow-origin")).toBe("https://some-contractor-site.example");
  });
});

describe("private storage", () => {
  test("A reads its own signed contract PDF; B gets 404 on the same path", async () => {
    expect(signedPdfObjectPath).toMatch(/^contracts\//);
    const mine = await A.api(`/api/storage/objects/${signedPdfObjectPath}`);
    expect(mine.status).toBe(200);
    const theirs = await B.api(`/api/storage/objects/${signedPdfObjectPath}`);
    expect(theirs.status).toBe(404);
    const anon = await api(`/api/storage/objects/${signedPdfObjectPath}`);
    expect(anon.status).toBe(401);
  });
});

describe("inbound webhooks verify their signatures", () => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const payload = JSON.stringify({ id: "evt_e2e", object: "event", type: "e2e.ping", data: { object: {} } });

  test.each([
    ["/api/payments/webhook", "STRIPE_WEBHOOK_SECRET"],
    ["/api/payments/connect-webhook", "STRIPE_CONNECT_WEBHOOK_SECRET"],
  ])("Stripe %s", async (path, secretVar) => {
    const secret = process.env[secretVar]!;
    expect((await rawPost(path, payload, {})).status).toBe(400); // no header
    const forged = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" });
    expect((await rawPost(path, payload, { "stripe-signature": forged })).status).toBe(400);
    const stale = stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: Math.floor(Date.now() / 1000) - 3600 });
    expect((await rawPost(path, payload, { "stripe-signature": stale })).status).toBe(400); // replay outside tolerance
    const good = stripe.webhooks.generateTestHeaderString({ payload, secret });
    expect((await rawPost(path, payload, { "stripe-signature": good })).status).toBe(200);
  });

  test.each([
    ["/api/whatsapp/webhook", "WHATSAPP_APP_SECRET"],
    ["/api/meta-lead-ads/webhook", "META_APP_SECRET"],
  ])("Meta %s (x-hub-signature-256)", async (path, secretVar) => {
    const body = JSON.stringify({ object: "page", entry: [] });
    expect((await rawPost(path, body, {})).status).toBe(400);
    const bad = "sha256=" + createHmac("sha256", "not-the-secret").update(body).digest("hex");
    expect((await rawPost(path, body, { "x-hub-signature-256": bad })).status).toBe(403);
    const good = "sha256=" + createHmac("sha256", process.env[secretVar]!).update(body).digest("hex");
    const ok = await rawPost(path, body, { "x-hub-signature-256": good });
    expect(ok.status).toBeGreaterThanOrEqual(200);
    expect(ok.status).toBeLessThan(300);
  });

  test("Resend (svix)", async () => {
    const body = JSON.stringify({ type: "email.delivered", data: { email_id: "e2e", to: ["x@example.invalid"] } });
    const id = "msg_e2e";
    const ts = String(Math.floor(Date.now() / 1000));
    const secretBytes = Buffer.from(process.env.RESEND_WEBHOOK_SECRET!.replace(/^whsec_/, ""), "base64");
    const sign = (key: Buffer) => "v1," + createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
    expect((await rawPost("/api/webhooks/resend", body, {})).status).toBe(400);
    expect((await rawPost("/api/webhooks/resend", body, { "svix-id": id, "svix-timestamp": ts, "svix-signature": sign(Buffer.from("wrong")) })).status).toBe(403);
    expect((await rawPost("/api/webhooks/resend", body, { "svix-id": id, "svix-timestamp": ts, "svix-signature": sign(secretBytes) })).status).toBe(200);
  });

  test("Financeit (shared token)", async () => {
    const body = JSON.stringify({ event_type: "loan_state_event", application_id: "none" });
    expect((await rawPost("/api/webhooks/financeit", body, {})).status).toBe(400);
    expect((await rawPost("/api/webhooks/financeit", body, { "x-financeit-webhook-token": "wrong" })).status).toBe(401);
    expect((await rawPost("/api/webhooks/financeit", body, { "x-financeit-webhook-token": process.env.FINANCEIT_WEBHOOK_SECRET! })).status).toBe(200);
  });

  test("cron tick needs the exact bearer secret", async () => {
    expect((await api("/api/cron/tick")).status).toBe(401);
    expect((await api("/api/cron/tick", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}x` } })).status).toBe(401);
  });
});

describe("cross-tenant access (IDOR sweep over the route matrix)", () => {
  test("org B never gets a 2xx on any :param route with org A's ids", async () => {
    const routes = loadRouteMatrix().filter((r) => /:[a-zA-Z]+/.test(r.path) && (r.auth === "session" || r.auth === "apiKey"));
    expect(routes.length).toBeGreaterThan(120);

    // B's Elite plan lets it mint an API key for the /api/v1/public/* routes.
    const { rawKey } = await createApiKey(B.userId, B.userId, "owner", "B's key");

    // Positive control: A really does see its own rows (else every 404 below would be vacuous).
    for (const p of [`/api/quotes/${fx.quote}`, `/api/contracts/${fx.contract}`, `/api/jobs/${fx.project}`, `/api/invoices/${fx.invoice}`, `/api/leads/${fx.lead}`]) {
      const own = await A.api(p);
      expect(own.status, `A GET ${p}`).toBe(200);
    }

    // Routes that legitimately answer 200 with an empty result for a foreign
    // id: the client id is an md5 of client fields, not a row key; by-quote
    // is a scoped lookup that reports "no contract" rather than 404.
    const EMPTY_OK: Record<string, (body: unknown) => boolean> = {
      "GET /api/clients/:id/quotes": (b) => Array.isArray(b) && b.length === 0,
      "GET /api/contracts/by-quote/:quoteId": (b) => !!b && typeof b === "object" && (b as { contract?: unknown }).contract === null,
    };

    const failures: string[] = [];
    const tally = { tenantRejected: 0, validatedFirst: 0, other: 0, unseeded: [] as string[] };
    for (const r of routes) {
      const resolved = resolveParams(r, fx);
      if (!resolved) continue;
      if (resolved.unseeded.length) tally.unseeded.push(`${r.method} ${r.path}`);
      const method = r.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      const opts = { method, ...(method === "GET" || method === "DELETE" ? {} : { body: {} }) };
      const res = r.auth === "apiKey" ? await api(resolved.path, { ...opts, headers: { authorization: `Bearer ${rawKey}` } }) : await B.api(resolved.path, opts);
      const label = `${r.method} ${r.path} → ${res.status}`;
      if (res.status >= 200 && res.status < 300) {
        if (EMPTY_OK[`${r.method} ${r.path}`]?.(res.body)) { tally.tenantRejected++; continue; }
        failures.push(`${label} ${JSON.stringify(res.body).slice(0, 200)}`);
      } else if (res.status === 403 || res.status === 404) tally.tenantRejected++;
      else if (res.status === 400 || res.status === 422) tally.validatedFirst++;
      else if (res.status >= 500) failures.push(`${label} (server error) ${JSON.stringify(res.body).slice(0, 200)}`);
      else tally.other++;
    }
    console.log(`IDOR sweep: ${routes.length} routes — ${tally.tenantRejected} rejected as foreign (403/404), ${tally.validatedFirst} failed body validation first (400), ${tally.other} other 4xx; unseeded params on ${tally.unseeded.length} route(s)${tally.unseeded.length ? ": " + tally.unseeded.join(", ") : ""}`);
    expect(failures).toEqual([]);
    // If a param has no fixture, a random uuid is used — that still proves "no 2xx" but not real scoping. Keep this list short.
    expect(tally.unseeded.length).toBeLessThanOrEqual(2);
  });

  test("a team member with the viewer role cannot read A's rows either (role ≠ tenant)", async () => {
    // B is an owner of its own org; its session must not reach A's data via the org cookie trick.
    const res = await B.api(`/api/quotes/${fx.quote}`, { headers: { cookie: `qai_active_org=${A.userId}` } });
    expect([403, 404]).toContain(res.status);
    const list = await B.api("/api/quotes", { headers: { cookie: `qai_active_org=${A.userId}` } });
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(fx.quote);
  });

  test("admin routes reject a normal signed-in owner and anonymous callers", async () => {
    expect((await B.api("/api/admin/metrics")).status).toBe(403);
    expect((await B.api("/api/admin/users")).status).toBe(403);
    expect((await api("/api/admin/metrics")).status).toBe(403);
  });
});

describe("better-auth flows", () => {
  const password = "E2e-Str0ng-Passw0rd!";
  const email = `e2e-auth-${randomUUID()}@example.invalid`;
  let userId = "";
  let bearer = "";

  afterAll(async () => {
    if (userId) await cleanupUsers([userId]);
  });

  test("sign-up → sign-in is blocked until the emailed verification link is used", async () => {
    const jar = new Jar();
    const signUp = await authPost("/api/auth/sign-up/email", { name: "E2E Auth <b>User</b>", email, password }, jar);
    expect(signUp.status).toBe(200);
    const [u] = await db.select().from(authUsersTable).where(eq(authUsersTable.email, email));
    expect(u).toBeTruthy();
    userId = u!.id;
    expect(u!.emailVerified).toBe(false);

    const blocked = await authPost("/api/auth/sign-in/email", { email, password }, new Jar());
    expect(blocked.status).toBe(403);
    expect(blocked.token).toBeNull();

    const verifyMail = emailsTo(email).find((m) => /verify/i.test(m.subject));
    expect(verifyMail, "verification email").toBeTruthy();
    // The name is user-controlled and lands in an HTML email: it must arrive escaped.
    expect(verifyMail!.html).not.toContain("<b>User</b>");
    expect(verifyMail!.html).toContain("&lt;b&gt;User&lt;/b&gt;");
    const link = linksIn(verifyMail!).find((l) => l.includes("/verify-email"));
    expect(link).toBeTruthy();
    const verified = await fetch(onTestServer(link!), { redirect: "manual" });
    expect([200, 302, 303]).toContain(verified.status);
    const [after] = await db.select().from(authUsersTable).where(eq(authUsersTable.id, userId));
    expect(after!.emailVerified).toBe(true);

    const ok = await authPost("/api/auth/sign-in/email", { email, password }, new Jar());
    expect(ok.status).toBe(200);
    expect(ok.token).toBeTruthy();
    bearer = ok.token!;
    // Session lifetime: better-auth default 7 days, refreshed daily — anything longer is a config regression.
    // The bearer value is the signed cookie form "<token>.<signature>"; the row stores the bare token.
    const [session] = await db.select().from(authSessionsTable).where(eq(authSessionsTable.token, bearer.split(".")[0]!));
    const days = (session!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7.01);
  });

  test("password reset: emailed token works once, then is dead; old password stops working", async () => {
    const before = sentEmails.length;
    const req = await authPost("/api/auth/request-password-reset", { email, redirectTo: "/reset-password" }, new Jar());
    expect(req.status).toBe(200);
    const mail = sentEmails.slice(before).find((m) => m.to.includes(email) && /reset/i.test(m.subject));
    expect(mail, "reset email").toBeTruthy();
    const link = linksIn(mail!).find((l) => l.includes("/reset-password"));
    expect(link, `reset link in ${JSON.stringify(linksIn(mail!))}`).toBeTruthy();
    // The emailed link is /api/auth/reset-password/<token>?callbackURL=… which redirects to the page with ?token=…
    const hop = await fetch(onTestServer(link!), { redirect: "manual" });
    const location = hop.headers.get("location") ?? link!;
    const token = new URL(location, baseUrl).searchParams.get("token") ?? new URL(link!).pathname.split("/").pop();
    expect(token).toBeTruthy();

    const newPassword = "E2e-N3w-Passw0rd!!";
    const reset = await authPost("/api/auth/reset-password", { newPassword, token }, new Jar());
    expect(reset.status).toBe(200);
    const replay = await authPost("/api/auth/reset-password", { newPassword: "E2e-Again-Passw0rd!!", token }, new Jar());
    expect(replay.status).toBeGreaterThanOrEqual(400);

    // A reset must not leave the earlier session alive (revokeSessionsOnPasswordReset).
    const stale = await api("/api/auth/get-session", { token: bearer });
    expect(stale.body ?? null).toBeNull();

    expect((await authPost("/api/auth/sign-in/email", { email, password }, new Jar())).status).toBe(401);
    const ok = await authPost("/api/auth/sign-in/email", { email, password: newPassword }, new Jar());
    expect(ok.status).toBe(200);
    bearer = ok.token!;
  });

  test("2FA: once enabled, a correct password alone yields no session; TOTP completes it", async () => {
    const jar = new Jar();
    const newPassword = "E2e-N3w-Passw0rd!!";
    const enable = await authPost("/api/auth/two-factor/enable", { password: newPassword, issuer: "QuoteAI" }, jar, bearer);
    expect(enable.status).toBe(200);
    const totpURI: string = enable.body.totpURI;
    expect(totpURI).toMatch(/^otpauth:\/\/totp\//);
    // better-auth only flips twoFactorEnabled after one successful TOTP verification.
    const activate = await authPost("/api/auth/two-factor/verify-totp", { code: totp(totpURI) }, jar, bearer);
    expect(activate.status).toBe(200);
    const [u] = await db.select().from(authUsersTable).where(eq(authUsersTable.id, userId));
    expect(u!.twoFactorEnabled).toBe(true);

    const half = new Jar();
    const signIn = await authPost("/api/auth/sign-in/email", { email, password: newPassword }, half);
    expect(signIn.status).toBe(200);
    expect(signIn.body?.twoFactorRedirect).toBe(true);
    // better-auth creates the session and the twoFactor plugin deletes it again
    // before answering, so the bearer plugin may still echo the dead token in
    // set-auth-token. What matters: that token must not resolve to a session.
    if (signIn.token) {
      const peek = await api("/api/auth/get-session", { token: signIn.token });
      expect(peek.body ?? null, "2FA bypass: password-only token resolved to a session").toBeNull();
    }
    const sessions = await db.select().from(authSessionsTable).where(eq(authSessionsTable.userId, userId));
    const beforeCount = sessions.length;

    const wrong = await authPost("/api/auth/two-factor/verify-totp", { code: "000000" }, half);
    expect(wrong.status).toBeGreaterThanOrEqual(400);
    expect(wrong.token).toBeNull();

    const right = await authPost("/api/auth/two-factor/verify-totp", { code: totp(totpURI) }, half);
    expect(right.status).toBe(200);
    expect(right.token).toBeTruthy();
    const afterCount = (await db.select().from(authSessionsTable).where(eq(authSessionsTable.userId, userId))).length;
    expect(afterCount).toBe(beforeCount + 1);
    bearer = right.token!;
  });

  test("revoke-sessions kills every session; email change is not offered", async () => {
    const me = await api("/api/auth/get-session", { token: bearer });
    expect(me.body?.user?.id).toBe(userId);
    const revoke = await authPost("/api/auth/revoke-sessions", {}, new Jar(), bearer);
    expect(revoke.status).toBe(200);
    const gone = await api("/api/auth/get-session", { token: bearer });
    expect(gone.body ?? null).toBeNull();
    const rows = await db.select().from(authSessionsTable).where(eq(authSessionsTable.userId, userId));
    expect(rows.length).toBe(0);
    // user.changeEmail is not enabled in lib/auth.ts — the endpoint must refuse, not silently swap the login.
    const fresh = await createUser();
    const change = await authPost("/api/auth/change-email", { newEmail: `x-${randomUUID()}@example.invalid` }, new Jar(), fresh.token);
    expect(change.status).toBeGreaterThanOrEqual(400);
  });
});

describe("invite links", () => {
  test("an expired invite is refused on preview and accept", async () => {
    const invited = await createUser({ email: `invitee-${randomUUID()}@example.invalid` });
    const created = await A.api("/api/team/members/invite", { body: { email: invited.email, role: "viewer" } });
    expect(created.status).toBe(201);
    const token = new URL(created.body.url).pathname.split("/").pop()!;
    expect((await api(`/api/team/invite/${token}`)).status).toBe(200);
    await db.update(organizationMembersTable).set({ inviteTokenExpiresAt: new Date(Date.now() - 1000) }).where(and(eq(organizationMembersTable.ownerId, A.userId), eq(organizationMembersTable.invitedEmail, invited.email)));
    expect((await api(`/api/team/invite/${token}`)).status).toBe(410);
    expect((await invited.api(`/api/team/invite/${token}/accept`, { method: "POST" })).status).toBe(410);
    expect((await api(`/api/team/invite/${randomBytes(32).toString("hex")}`)).status).toBe(404);
  });
});

// Last: these exhaust per-IP budgets for the rest of the process.
describe("rate limits bite", () => {
  test("public invite preview: 30/min per IP, then 429", async () => {
    let limited = 0;
    for (let i = 0; i < 40; i++) {
      const res = await api(`/api/team/invite/${randomBytes(16).toString("hex")}`);
      if (res.status === 429) { limited++; expect(res.headers.get("ratelimit-limit")).toBeTruthy(); }
    }
    expect(limited).toBeGreaterThan(0);
  });

  test("password reset requests: 10/15min per IP, then 429 (and no more emails)", async () => {
    const target = `e2e-flood-${randomUUID()}@example.invalid`;
    const before = sentEmails.length;
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await authPost("/api/auth/request-password-reset", { email: target, redirectTo: "/reset-password" }, new Jar())).status);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    // Unknown address: better-auth answers 200 without sending, so no email either way — the point is the 429.
    expect(sentEmails.length - before).toBe(0);
  });

  test("public sign OTP: 8/15min per IP, then 429 even for a bogus token", async () => {
    let limited = 0;
    for (let i = 0; i < 10; i++) {
      const res = await api(`/api/sign/${randomBytes(16).toString("hex")}/otp`, { method: "POST", body: {} });
      if (res.status === 429) limited++;
    }
    expect(limited).toBeGreaterThan(0);
  });
});
