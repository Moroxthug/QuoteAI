// Phase 65 — integrations live smoke, the half that needs no vendor account.
//
// What this file proves, against the real app + real database:
//  1. `/api/cron/tick` end-to-end (Phase 63 only exercised the maintainers it
//     calls): every due item kind fires once, and a second tick is a no-op.
//  2. Stripe webhook *side effects* (Phase 64 only checked signatures):
//     one-shot unlock, subscription activation + email, cancellation, Connect
//     card payment → invoice paid + receipt, and replay idempotency.
//  3. Vendor round-trips with the vendor answered at the `fetch` boundary
//     (src/e2e/vendorStub.ts): WhatsApp template rejected → email fallback and
//     accepted → WhatsApp channel; Gmail connected send → the contractor's own
//     address, and Gmail failure → platform sender + lastSendError; Google
//     Calendar milestone → all-day event, date change → PATCH; QuickBooks
//     sent invoice → Invoice, payment → Payment on it (Phase 88; was one
//     SalesReceipt on paid), cost.confirmed → Purchase, all logged.
//  4. Integrations with no app registration are honest: `available: false`
//     on status, 503 NOT_CONFIGURED on connect, never a vendor bounce.
//  5. Every transactional email captured during the run renders clean in the
//     language it was sent in (no `undefined` / `NaN` / `[object Object]`).
//
// What it cannot prove — the vendor's half — is the user-driven checklist in
// docs/QA-VERIFICATION-PLAN.md §3 Phase 65.

import { describe, test, expect, beforeAll, afterAll, afterEach } from "vitest";
import Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  quotesTable,
  clientsTable,
  contractsTable,
  projectsTable,
  invoicesTable,
  invoicePaymentsTable,
  leadsTable,
  businessProfilesTable,
  automationRunsTable,
  notificationsTable,
  whatsappConnectionsTable,
  emailConnectionsTable,
  calendarConnectionsTable,
  calendarSyncedEventsTable,
  quickbooksConnectionsTable,
  quickbooksSyncLogTable,
  milestonesTable,
} from "@workspace/db";
import "../automations/index.js";
import { encryptSecret } from "../lib/crypto.js";
import { REVIEW_REQUEST_DELAY_DAYS } from "../lib/jobMessaging.js";
import { runJobReviewRequestMaintenance } from "../jobs/maintenance.js";
import { syncMilestoneToCalendar } from "../calendar/sync.js";
import { INTEGRATION_ENV, type IntegrationName } from "../lib/integrationAvailability.js";
import { startServer, stopServer, createOrg, seedQuote, cleanupAll, api, daysAgo, daysFromNow, type TestUser } from "./harness.js";
import { sentEmails, emailsTo } from "./mailbox.js";
import { stubHost, unstubHost, requestsTo, resetRecorded, json } from "./vendorStub.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function stripeEvent(type: string, object: Record<string, unknown>, opts: { account?: string } = {}) {
  return JSON.stringify({ id: `evt_${Math.random().toString(36).slice(2)}`, object: "event", type, ...(opts.account ? { account: opts.account } : {}), data: { object } });
}


// harness.api() JSON-encodes `body`; Stripe needs the exact bytes it signed.
async function rawPost(path: string, payload: string, headers: Record<string, string>) {
  const base = await startServer();
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: payload });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function stripeWebhook(payload: string) {
  return rawPost("/api/payments/webhook", payload, { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! }) });
}
async function connectWebhook(payload: string) {
  return rawPost("/api/payments/connect-webhook", payload, { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET! }) });
}

async function seedClient(org: TestUser, opts: { name?: string; email?: string; phone?: string | null; lang?: "en" | "fr" } = {}) {
  const [client] = await db
    .insert(clientsTable)
    .values({
      userId: org.userId,
      name: opts.name ?? "Integration Client",
      email: opts.email ?? `client-${Math.random().toString(36).slice(2)}-${org.userId}@example.invalid`,
      phone: opts.phone ?? null,
      preferredLanguage: opts.lang ?? "en",
      dedupKey: `int-${Math.random().toString(36).slice(2)}-${org.userId}`,
    })
    .returning();
  return client!;
}

async function createManualInvoice(org: TestUser, clientId: string, opts: { unitCents?: number; dueDays?: number; language?: "en" | "fr" } = {}) {
  const res = await org.api("/api/invoices", {
    body: { clientId, lines: [{ description: "Deck boards", quantity: 1, unitCents: opts.unitCents ?? 250_000 }], dueDays: opts.dueDays ?? 15, language: opts.language },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.invoice as { id: string; number: string; totalCents: number; status: string };
}

/** Polls until `probe` returns a truthy value (fire-and-forget calendar sync, automations that run after the response). */
async function waitFor<T>(probe: () => Promise<T | null | undefined | false>, label: string, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await probe();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

const HTML_TEXT = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");

describe("Phase 65 — integrations", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });
  afterEach(resetRecorded);

  // ── 1. cron tick ───────────────────────────────────────────────────────────

  describe("/api/cron/tick", () => {
    test("every due item kind fires once; a second tick is a no-op", async () => {
      // QC/FR so the reminder / follow-up / receipt templates render in French here (the rest of the file is EN).
      const org = await createOrg({ province: "QC", companyName: "Cron QC Inc", profile: { sendReviewRequests: true, googleReviewUrl: "https://g.page/r/e2e/review" } });
      const client = await seedClient(org, { name: "Client Tick", lang: "fr" });

      // a. Sent invoice 5 days past due → overdue + first (3-day) reminder in the same tick.
      const overdue = await createManualInvoice(org, client.id, { language: "fr" });
      expect((await org.api(`/api/invoices/${overdue.id}/send`, { body: {} })).status).toBe(200);
      await db.update(invoicesTable).set({ dueDate: daysAgo(5) }).where(eq(invoicesTable.id, overdue.id));

      // b. Draft whose review window elapsed → auto-sent.
      const autoSend = await createManualInvoice(org, client.id, { language: "fr" });
      await db.update(invoicesTable).set({ autoSendAt: daysAgo(0.01) }).where(eq(invoicesTable.id, autoSend.id));

      // c. Holdback release whose lien period ended → in-app notification (autoSendInvoices is off on the fixture profile).
      const release = await createManualInvoice(org, client.id, { language: "fr" });
      await db.update(invoicesTable).set({ type: "holdback_release", scheduledFor: daysAgo(1) }).where(eq(invoicesTable.id, release.id));

      // d. Contract sent 4 days ago, unsigned → 3-day reminder (re-issued token).
      const quote = await seedQuote(org.userId, { province: "QC", clientEmail: client.email! });
      await db.update(quotesTable).set({ status: "accepted", acceptedAt: new Date(), acceptedByName: client.name }).where(eq(quotesTable.id, quote.id));
      const { raiseAutomation } = await import("../lib/automation.js");
      await raiseAutomation({ event: "quote.accepted", userId: org.userId, entityType: "quote", entityId: quote.id, payload: { acceptedByName: client.name } });
      const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.quoteId, quote.id));
      expect(contract, "contract auto-drafted").toBeTruthy();
      await db.update(contractsTable).set({ status: "sent", sentAt: daysAgo(4), expiresAt: daysFromNow(10) }).where(eq(contractsTable.id, contract!.id));

      // e. Sent quote whose follow-up is due.
      const followQuote = await seedQuote(org.userId, { province: "QC", clientEmail: `quote-fu-${org.userId}@example.invalid`, status: "unlocked" });
      await db.update(quotesTable).set({ nextFollowUpAt: daysAgo(0.01) }).where(eq(quotesTable.id, followQuote.id));

      // f. Lead whose first follow-up is due.
      const leadEmail = `lead-tick-${org.userId}@example.invalid`;
      const lead = await org.api("/api/leads", { body: { name: "Lead Tick", email: leadEmail, preferredLanguage: "fr" } });
      expect(lead.status).toBe(201);
      await db.update(leadsTable).set({ nextFollowUpAt: daysAgo(0.01) }).where(eq(leadsTable.id, lead.body.lead.id));

      // g. Job completed 4 days ago → review request.
      const [project] = await db
        .insert(projectsTable)
        .values({ userId: org.userId, clientId: client.id, name: "Finished patio", status: "completed", completedAt: daysAgo(REVIEW_REQUEST_DELAY_DAYS + 1) })
        .returning();

      const before = { emails: sentEmails.length };
      const countFor = async () => ({
        runs: Number((await db.select({ n: sql<number>`count(*)::int` }).from(automationRunsTable).where(eq(automationRunsTable.userId, org.userId)))[0]!.n),
        notifications: Number((await db.select({ n: sql<number>`count(*)::int` }).from(notificationsTable).where(eq(notificationsTable.userId, org.userId)))[0]!.n),
        emails: sentEmails.filter((m) => m.to.some((t) => t.endsWith(`${org.userId}@example.invalid`))).length,
      });

      const unauthorized = await api("/api/cron/tick", { headers: { authorization: "Bearer nope" } });
      expect(unauthorized.status).toBe(401);

      const t1 = await api("/api/cron/tick", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
      expect(t1.status, JSON.stringify(t1.body)).toBe(200);
      expect(t1.body.ok).toBe(true);
      for (const key of ["automations", "contracts", "invoices", "leads", "reviewRequests", "incentives", "priceTrends", "quoteFollowups", "flinksSync", "googleLsaPoll", "usage", "tookMs"]) {
        expect(t1.body, `tick response has ${key}`).toHaveProperty(key);
      }
      expect(t1.body.invoices.overdue).toBeGreaterThanOrEqual(1);
      expect(t1.body.invoices.reminded).toBeGreaterThanOrEqual(1);
      expect(t1.body.invoices.autoSent).toBeGreaterThanOrEqual(1);
      expect(t1.body.invoices.releasesDue).toBeGreaterThanOrEqual(1);
      expect(t1.body.contracts.reminded).toBeGreaterThanOrEqual(1);
      expect(t1.body.leads.raised).toBeGreaterThanOrEqual(1);
      expect(t1.body.reviewRequests.raised).toBeGreaterThanOrEqual(1);
      expect(t1.body.quoteFollowups.raised).toBeGreaterThanOrEqual(1);
      // Flinks / LSA have no connections in this org — they must report a clean skip, not throw.
      expect(t1.body.flinksSync).toMatchObject({ transactionsFetched: expect.any(Number) });
      expect(t1.body.googleLsaPoll).toMatchObject({ leadsImported: expect.any(Number) });

      // Effects, one per seed.
      const [ov] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, overdue.id));
      expect(ov!.status).toBe("overdue");
      expect(ov!.reminderCount).toBe(1);
      const [as] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, autoSend.id));
      expect(as!.status).toBe("sent");
      const [rel] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, release.id));
      expect(rel!.scheduledNotifiedAt).not.toBeNull();
      expect(rel!.status).toBe("draft");
      const [c] = await db.select().from(contractsTable).where(eq(contractsTable.id, contract!.id));
      expect(c!.reminderCount).toBe(1);
      const [fq] = await db.select().from(quotesTable).where(eq(quotesTable.id, followQuote.id));
      expect(fq!.followUpStage).toBe(1);
      // A Quebec quote follows up in French (was hard-wired to English before Phase 65).
      expect(emailsTo(`quote-fu-${org.userId}@example.invalid`).map((m) => m.subject).join(" | ")).toMatch(/soumission/i);
      const [ld] = await db.select().from(leadsTable).where(eq(leadsTable.id, lead.body.lead.id));
      expect(ld!.followUpStage).toBe(1);
      const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, project!.id));
      expect(p!.reviewRequestSentAt).not.toBeNull();
      expect(emailsTo(client.email!).length, "client got reminder + auto-sent invoice + review request").toBeGreaterThanOrEqual(3);
      expect(emailsTo(leadEmail)).toHaveLength(1);
      expect(sentEmails.length).toBeGreaterThan(before.emails);

      // Idempotency: the same tick again changes nothing for this tenant.
      const snap = await countFor();
      const t2 = await api("/api/cron/tick", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
      expect(t2.status).toBe(200);
      expect(await countFor()).toEqual(snap);
      const [ov2] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, overdue.id));
      expect(ov2!.reminderCount).toBe(1);
      const [c2] = await db.select().from(contractsTable).where(eq(contractsTable.id, contract!.id));
      expect(c2!.reminderCount).toBe(1);
    }, 240_000);
  });

  // ── 2. Stripe ──────────────────────────────────────────────────────────────

  describe("Stripe webhooks (signed synthetic events)", () => {
    test("checkout.session.completed: one-shot unlock flips the quote; subscription mode activates the plan and emails the owner", async () => {
      const org = await createOrg({ plan: "free", companyName: "Stripe Buyer Co" });
      const quote = await seedQuote(org.userId, { status: "pending_payment" });

      const unlock = await stripeWebhook(stripeEvent("checkout.session.completed", { id: "cs_e2e_unlock", mode: "payment", payment_status: "paid", metadata: { quoteId: quote.id, userId: org.userId, planType: "oneshot_clean" } }));
      expect(unlock.status).toBe(200);
      const [q] = await db.select().from(quotesTable).where(eq(quotesTable.id, quote.id));
      expect(q!.status).toBe("unlocked");
      expect(q!.unlockedWithPlan).toBe("oneshot_clean");

      const customerId = `cus_e2e_${org.userId.slice(-8)}`;
      const sub = await stripeWebhook(stripeEvent("checkout.session.completed", { id: "cs_e2e_sub", mode: "subscription", payment_status: "paid", customer: customerId, metadata: { userId: org.userId, planType: "monthly_pro" } }));
      expect(sub.status).toBe(200);
      let [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, org.userId));
      expect(profile!.subscriptionPlan).toBe("monthly_pro");
      expect(profile!.subscriptionStatus).toBe("active");
      expect(profile!.stripeCustomerId).toBe(customerId);
      const welcome = emailsTo(org.email);
      expect(welcome).toHaveLength(1);
      expect(welcome[0]!.subject.toLowerCase()).toContain("pro");

      // Plan change from the Stripe dashboard / portal → synced by customer id (no Stripe API call needed).
      const upgraded = await stripeWebhook(stripeEvent("customer.subscription.updated", { id: "sub_e2e", customer: customerId, status: "active", items: { data: [{ price: { id: "price_1UEgdVEI5cvpdr6NHbrrdO88" } }] } }));
      expect(upgraded.status).toBe(200);
      [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, org.userId));
      expect(profile!.subscriptionPlan).toBe("monthly_elite");

      // Unknown price → logged and skipped, never a 5xx and never a downgrade.
      const unknown = await stripeWebhook(stripeEvent("customer.subscription.updated", { id: "sub_e2e", customer: customerId, status: "active", items: { data: [{ price: { id: "price_not_ours" } }] } }));
      expect(unknown.status).toBe(200);
      [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, org.userId));
      expect(profile!.subscriptionPlan).toBe("monthly_elite");

      const cancelled = await stripeWebhook(stripeEvent("customer.subscription.deleted", { id: "sub_e2e", customer: customerId, status: "canceled" }));
      expect(cancelled.status).toBe(200);
      [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, org.userId));
      expect(profile!.subscriptionPlan).toBeNull();
      expect(profile!.subscriptionStatus).toBe("cancelled");
    });

    test("Connect checkout.session.completed pays the invoice once, emails a receipt, and a replay is ignored", async () => {
      const org = await createOrg({ companyName: "Card Payments Co" });
      const client = await seedClient(org);
      const inv = await createManualInvoice(org, client.id, { unitCents: 100_000 });
      expect((await org.api(`/api/invoices/${inv.id}/send`, { body: {} })).status).toBe(200);
      const [sent] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, inv.id));
      const emailsBefore = emailsTo(client.email!).length;

      const payload = stripeEvent("checkout.session.completed", { id: "cs_e2e_card", payment_status: "paid", amount_total: sent!.totalCents, metadata: { invoiceId: inv.id } }, { account: "acct_e2e" });
      expect((await connectWebhook(payload)).status).toBe(200);

      const [paid] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, inv.id));
      expect(paid!.status).toBe("paid");
      expect(paid!.paidCents).toBe(sent!.totalCents);
      const payments = await db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, inv.id));
      expect(payments).toHaveLength(1);
      expect(payments[0]!.method).toBe("card");
      expect(payments[0]!.reference).toBe("cs_e2e_card");
      expect(emailsTo(client.email!).length, "receipt email").toBe(emailsBefore + 1);

      // Stripe retries deliveries; the same session id must not be recorded twice.
      expect((await connectWebhook(payload)).status).toBe(200);
      expect(await db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, inv.id))).toHaveLength(1);
      expect(emailsTo(client.email!).length).toBe(emailsBefore + 1);

      // A session for an invoice that isn't ours / doesn't exist is a no-op 200 (Stripe must not retry forever).
      expect((await connectWebhook(stripeEvent("checkout.session.completed", { id: "cs_e2e_ghost", payment_status: "paid", amount_total: 100, metadata: { invoiceId: "00000000-0000-0000-0000-000000000000" } }))).status).toBe(200);
    });
  });

  // ── 3. Vendor round-trips ──────────────────────────────────────────────────

  describe("WhatsApp Cloud API", () => {
    const GRAPH = "https://graph.facebook.com/";

    test("a rejected template (unapproved) degrades to email without failing the automation; an accepted one goes out on WhatsApp", async () => {
      const org = await createOrg({ companyName: "WA Fallback Co", profile: { sendReviewRequests: true, googleReviewUrl: "https://g.page/r/e2e/review" } });
      await db.insert(whatsappConnectionsTable).values({ userId: org.userId, phoneNumber: `+1613555${org.userId.slice(-4).replace(/\D/g, "0").padStart(4, "0")}`, isEnabled: true });

      // Meta's answer for a template that was never submitted/approved.
      stubHost(GRAPH, () => json(400, { error: { message: "(#132001) Template name does not exist in the translation", type: "OAuthException", code: 132001 } }));
      const client1 = await seedClient(org, { name: "Phone Client", phone: "+16135550101" });
      const [job1] = await db.insert(projectsTable).values({ userId: org.userId, clientId: client1.id, name: "Fence", status: "completed", completedAt: daysAgo(REVIEW_REQUEST_DELAY_DAYS + 1) }).returning();
      await runJobReviewRequestMaintenance();

      const waCalls = requestsTo(GRAPH);
      expect(waCalls.length, "one template send attempted").toBe(1);
      expect(waCalls[0]!.json).toMatchObject({ messaging_product: "whatsapp", to: "+16135550101", type: "template", template: { name: process.env.WHATSAPP_REVIEW_REQUEST_TEMPLATE, language: { code: "en_US" } } });
      const [p1] = await db.select().from(projectsTable).where(eq(projectsTable.id, job1!.id));
      expect(p1!.reviewRequestSentAt, "still marked sent (via email)").not.toBeNull();
      expect(emailsTo(client1.email!)).toHaveLength(1);
      const [run1] = await db.select().from(automationRunsTable).where(and(eq(automationRunsTable.entityId, job1!.id), eq(automationRunsTable.event, "job.review_request_due")));
      expect(run1!.status).toBe("succeeded");
      expect(run1!.result).toMatchObject({ channel: "email" });

      // Approved template: Meta accepts → no email.
      resetRecorded();
      stubHost(GRAPH, () => json(200, { messaging_product: "whatsapp", contacts: [{ wa_id: "16135550102" }], messages: [{ id: "wamid.e2e" }] }));
      const client2 = await seedClient(org, { name: "Client FR", phone: "+16135550102", lang: "fr" });
      const [job2] = await db.insert(projectsTable).values({ userId: org.userId, clientId: client2.id, name: "Toiture", status: "completed", completedAt: daysAgo(REVIEW_REQUEST_DELAY_DAYS + 1) }).returning();
      await runJobReviewRequestMaintenance();
      expect(requestsTo(GRAPH)).toHaveLength(1);
      expect(requestsTo(GRAPH)[0]!.json).toMatchObject({ template: { language: { code: "fr" } } });
      expect(emailsTo(client2.email!)).toHaveLength(0);
      const [run2] = await db.select().from(automationRunsTable).where(and(eq(automationRunsTable.entityId, job2!.id), eq(automationRunsTable.event, "job.review_request_due")));
      expect(run2!.result).toMatchObject({ channel: "whatsapp" });

      // Lead follow-up over WhatsApp with the template rejected → email fallback, sequence still advances.
      resetRecorded();
      stubHost(GRAPH, () => json(400, { error: { code: 132001, message: "Template name does not exist" } }));
      const leadEmail = `wa-lead-${org.userId}@example.invalid`;
      const lead = await org.api("/api/leads", { body: { name: "WA Lead", email: leadEmail, phone: "+16135550103", preferredChannel: "whatsapp", preferredLanguage: "en" } });
      expect(lead.status).toBe(201);
      await db.update(leadsTable).set({ nextFollowUpAt: daysAgo(0.01) }).where(eq(leadsTable.id, lead.body.lead.id));
      const { runLeadMaintenance } = await import("../leads/maintenance.js");
      await runLeadMaintenance();
      expect(requestsTo(GRAPH)).toHaveLength(1);
      expect(emailsTo(leadEmail)).toHaveLength(1);
      const [ld] = await db.select().from(leadsTable).where(eq(leadsTable.id, lead.body.lead.id));
      expect(ld!.followUpStage).toBe(1);
    });

    test("connect: the OTP goes out as a plain text message (no template), verify links the number", async () => {
      const org = await createOrg({ plan: "monthly_pro", companyName: "WA Connect Co" });
      let otpText = "";
      stubHost(GRAPH, (req) => {
        const body = req.json as { type?: string; text?: { body?: string } };
        if (body?.type === "text") otpText = body.text?.body ?? "";
        return json(200, { messages: [{ id: "wamid.otp" }] });
      });
      const phone = `+1613555${(Date.now() % 10000).toString().padStart(4, "0")}`;
      const connect = await org.api("/api/whatsapp/connect", { body: { phoneNumber: phone } });
      expect(connect.status, JSON.stringify(connect.body)).toBe(200);
      expect(requestsTo(GRAPH)).toHaveLength(1);
      expect(requestsTo(GRAPH)[0]!.json).toMatchObject({ type: "text" });
      const code = /\*(\d{4,8})\*/.exec(otpText)?.[1];
      expect(code, `OTP present in the text: ${otpText}`).toBeTruthy();

      expect((await org.api("/api/whatsapp/verify", { body: { phoneNumber: phone, otp: "000000" } })).status).toBeGreaterThanOrEqual(400);
      const verify = await org.api("/api/whatsapp/verify", { body: { phoneNumber: phone, otp: code } });
      expect(verify.status, JSON.stringify(verify.body)).toBe(200);
      const status = await org.api("/api/whatsapp/status");
      expect(status.body).toMatchObject({ connected: true, available: true });
      // normalizePhone stores E.164 digits without the leading "+".
      expect(String(status.body.phoneNumber).replace(/\D/g, "")).toBe(phone.replace(/\D/g, ""));
    });

    afterAll(() => unstubHost(GRAPH));
  });

  describe("Gmail connected sending", () => {
    const GMAIL = "https://gmail.googleapis.com/";

    test("with a connection the invoice goes out from the contractor's address; when Gmail fails it falls back to the platform sender and records the error", async () => {
      const org = await createOrg({ companyName: "Gmail Sender Co" });
      const account = `owner-gmail-${org.userId.slice(-6)}@gmail.example`;
      await db.insert(emailConnectionsTable).values({
        userId: org.userId,
        provider: "google",
        accountEmail: account,
        accessTokenEnc: encryptSecret("ya29.e2e-access"),
        refreshTokenEnc: encryptSecret("1//e2e-refresh"),
        tokenExpiresAt: daysFromNow(1),
      });
      const client = await seedClient(org, { name: "Gmail Client" });

      stubHost(GMAIL, () => json(200, { id: "msg_e2e", threadId: "thr_e2e" }));
      const inv = await createManualInvoice(org, client.id);
      const emailsBefore = emailsTo(client.email!).length;
      expect((await org.api(`/api/invoices/${inv.id}/send`, { body: {} })).status).toBe(200);

      const sends = requestsTo(GMAIL);
      expect(sends, "exactly one Gmail send").toHaveLength(1);
      expect(sends[0]!.url).toContain("/gmail/v1/users/me/messages/send");
      expect(sends[0]!.headers.authorization).toBe("Bearer ya29.e2e-access");
      const raw = Buffer.from((sends[0]!.json as { raw: string }).raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      expect(raw).toMatch(new RegExp(`^From: .*<${account.replace(".", "\\.")}>`, "m"));
      expect(raw).toMatch(new RegExp(`^To: .*${client.email!.replace(".", "\\.")}`, "m"));
      expect(raw).toMatch(/^Subject: /m);
      expect(raw, "PDF attached").toMatch(/application\/pdf/);
      expect(emailsTo(client.email!).length, "nothing went through Resend").toBe(emailsBefore);
      let [conn] = await db.select().from(emailConnectionsTable).where(eq(emailConnectionsTable.userId, org.userId));
      expect(conn!.lastSendAt).not.toBeNull();
      expect(conn!.lastSendError).toBeNull();

      // Token revoked on Google's side → platform sender, contractor address as Reply-To, error surfaced on the connection.
      resetRecorded();
      stubHost(GMAIL, () => json(401, { error: { code: 401, message: "Invalid Credentials", status: "UNAUTHENTICATED" } }));
      const inv2 = await createManualInvoice(org, client.id);
      expect((await org.api(`/api/invoices/${inv2.id}/send`, { body: {} })).status).toBe(200);
      expect(requestsTo(GMAIL)).toHaveLength(1);
      const fallback = emailsTo(client.email!);
      expect(fallback.length).toBe(emailsBefore + 1);
      expect(fallback.at(-1)!.from).toMatch(/via QuoteAI <no-reply@quoteai\.ca>$/);
      [conn] = await db.select().from(emailConnectionsTable).where(eq(emailConnectionsTable.userId, org.userId));
      expect(conn!.lastSendError).toMatch(/401/);

      // Disabled connection → platform sender, Gmail never called.
      resetRecorded();
      expect((await org.api("/api/email-connections/google/toggle", { method: "PATCH", body: { isEnabled: false } })).status).toBe(200);
      const inv3 = await createManualInvoice(org, client.id);
      expect((await org.api(`/api/invoices/${inv3.id}/send`, { body: {} })).status).toBe(200);
      expect(requestsTo(GMAIL)).toHaveLength(0);
      expect(emailsTo(client.email!).length).toBe(emailsBefore + 2);
    });

    afterAll(() => unstubHost(GMAIL));
  });

  describe("Google Calendar", () => {
    const GCAL = "https://www.googleapis.com/";

    test("a dated milestone becomes an all-day event; moving the date PATCHes the same event; deleting it DELETEs", async () => {
      const org = await createOrg({ companyName: "Calendar Co" });
      await db.insert(calendarConnectionsTable).values({
        userId: org.userId,
        provider: "google",
        accountEmail: `cal-${org.userId.slice(-6)}@gmail.example`,
        accessTokenEnc: encryptSecret("ya29.e2e-cal"),
        refreshTokenEnc: encryptSecret("1//e2e-cal-refresh"),
        tokenExpiresAt: daysFromNow(1),
      });
      let nextId = 0;
      stubHost(GCAL, (req) => {
        if (req.method === "POST") return json(200, { id: `gevt_${++nextId}` });
        if (req.method === "PATCH") return json(200, { id: req.url.split("/events/")[1]!.split("?")[0] });
        if (req.method === "DELETE") return new Response(null, { status: 204 });
        return json(404, {});
      });

      const job = await org.api("/api/jobs", { body: { name: "Basement finish", plannedStart: "2030-03-01" } });
      expect(job.status, JSON.stringify(job.body)).toBe(201);
      const jobId = job.body.job.id as string;
      const ms = await org.api(`/api/jobs/${jobId}/milestones`, { body: { title: "Framing", plannedStart: "2030-03-04", plannedEnd: "2030-03-06" } });
      expect(ms.status, JSON.stringify(ms.body)).toBe(201);
      const milestoneId = ms.body.milestone.id as string;

      const synced = await waitFor(async () => (await db.select().from(calendarSyncedEventsTable).where(eq(calendarSyncedEventsTable.milestoneId, milestoneId)))[0], "calendar_synced_events row");
      expect(synced.status).toBe("synced");
      expect(synced.externalEventId).toBe("gevt_1");
      const created = requestsTo(GCAL).find((r) => r.method === "POST")!;
      expect(created.url).toContain("/calendar/v3/calendars/primary/events");
      expect(created.headers.authorization).toBe("Bearer ya29.e2e-cal");
      // All-day: date-only start, exclusive end = day after the last day.
      expect(created.json).toMatchObject({ summary: expect.stringContaining("Framing"), start: { date: "2030-03-04" }, end: { date: "2030-03-07" } });

      resetRecorded();
      const moved = await org.api(`/api/jobs/${jobId}/milestones/${milestoneId}`, { method: "PUT", body: { plannedStart: "2030-03-10", plannedEnd: "2030-03-10" } });
      expect(moved.status, JSON.stringify(moved.body)).toBe(200);
      const patch = await waitFor(async () => requestsTo(GCAL).find((r) => r.method === "PATCH"), "PATCH to Google");
      expect(patch.url).toContain("/events/gevt_1");
      expect(patch.json).toMatchObject({ start: { date: "2030-03-10" }, end: { date: "2030-03-11" } });
      const [after] = await db.select().from(calendarSyncedEventsTable).where(eq(calendarSyncedEventsTable.milestoneId, milestoneId));
      expect(after!.externalEventId).toBe("gevt_1");
      expect(requestsTo(GCAL).filter((r) => r.method === "POST"), "no duplicate event").toHaveLength(0);

      // Provider outage → row marked failed with the reason, nothing thrown to the caller.
      resetRecorded();
      stubHost(GCAL, () => json(503, { error: { message: "Backend Error" } }));
      const [row] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, milestoneId));
      await syncMilestoneToCalendar(org.userId, row!, "Basement finish");
      const [failed] = await db.select().from(calendarSyncedEventsTable).where(eq(calendarSyncedEventsTable.milestoneId, milestoneId));
      expect(failed!.status).toBe("failed");
      expect(failed!.error).toMatch(/503/);
      expect(failed!.externalEventId, "keeps the event id for the next retry").toBe("gevt_1");

      resetRecorded();
      stubHost(GCAL, (req) => (req.method === "DELETE" ? new Response(null, { status: 204 }) : json(200, { id: "gevt_1" })));
      expect((await org.api(`/api/jobs/${jobId}/milestones/${milestoneId}`, { method: "DELETE" })).status).toBe(200);
      const del = await waitFor(async () => requestsTo(GCAL).find((r) => r.method === "DELETE"), "DELETE to Google");
      expect(del.url).toContain("/events/gevt_1");
    });

    afterAll(() => unstubHost(GCAL));
  });

  describe("QuickBooks (sandbox host)", () => {
    const QBO = "https://sandbox-quickbooks.api.intuit.com/";

    test("a sent invoice posts one Invoice, its payment one Payment applied to it; cost.confirmed posts one Purchase from the mapped accounts; all land in the sync log", async () => {
      const org = await createOrg({ companyName: "Books Co" });
      const realmId = "9130000000000001";
      await db.insert(quickbooksConnectionsTable).values({
        userId: org.userId,
        realmId,
        environment: "sandbox",
        companyName: "Books Co Sandbox",
        accessTokenEnc: encryptSecret("qbo-access"),
        refreshTokenEnc: encryptSecret("qbo-refresh"),
        tokenExpiresAt: daysFromNow(1),
        paymentAccount: { id: "35", name: "Chequing" },
        categoryMap: { materials: { id: "64", name: "Job Materials" } },
      });
      stubHost(QBO, (req) => {
        const u = new URL(req.url);
        expect(u.pathname.startsWith(`/v3/company/${realmId}/`)).toBe(true);
        expect(req.headers.authorization).toBe("Bearer qbo-access");
        if (u.pathname.endsWith("/query")) {
          const q = u.searchParams.get("query") ?? "";
          if (q.includes("from Customer")) return json(200, { QueryResponse: {} }); // not found → create
          if (q.includes("from Item")) return json(200, { QueryResponse: { Item: [{ Id: "17", Name: "QuoteAI Job Revenue" }] } });
          if (q.includes("from Vendor")) return json(200, { QueryResponse: { Vendor: [{ Id: "V-9", DisplayName: "Home Depot" }] } });
          return json(200, { QueryResponse: {} });
        }
        if (u.pathname.endsWith("/customer")) return json(200, { Customer: { Id: "58", Name: (req.json as { DisplayName: string }).DisplayName } });
        if (u.pathname.endsWith("/invoice")) return json(200, { Invoice: { Id: "INV-1001", SyncToken: "0", TotalAmt: Math.round((req.json as { Line: { Amount: number }[] }).Line.reduce((s, l) => s + l.Amount * 100, 0)) / 100, Balance: 0 } });
        if (u.pathname.endsWith("/payment")) return json(200, { Payment: { Id: "PAY-3003" } });
        if (u.pathname.endsWith("/purchase")) return json(200, { Purchase: { Id: "P-2002" } });
        return json(404, { Fault: { Error: [{ Message: `unscripted ${u.pathname}` }] } });
      });

      const client = await seedClient(org, { name: "Books Client" });
      const inv = await createManualInvoice(org, client.id, { unitCents: 123_456 });
      expect((await org.api(`/api/invoices/${inv.id}/send`, { body: {} })).status).toBe(200);
      const [sent] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, inv.id));
      const pay = await org.api(`/api/invoices/${inv.id}/payments`, { body: { amountCents: sent!.totalCents, method: "etransfer" } });
      expect(pay.status, JSON.stringify(pay.body)).toBe(201);

      const invoiceCall = requestsTo(QBO).find((r) => r.url.endsWith("/invoice"))!;
      expect(invoiceCall, "Invoice posted").toBeTruthy();
      // No tax code mapped (Phase 96): the item line pre-tax, then the tax as a line of its own — the total still matches.
      expect(invoiceCall.json).toMatchObject({
        CustomerRef: { value: "58" },
        DocNumber: sent!.number,
        GlobalTaxCalculation: "NotApplicable",
        Line: [
          { Amount: sent!.subtotalCents / 100, DetailType: "SalesItemLineDetail", SalesItemLineDetail: { ItemRef: { value: "17" } } },
          ...sent!.taxLines.map((t) => ({ Amount: t.amountCents / 100, Description: `${t.label} ${t.rate}%` })),
        ],
      });
      expect(Math.round((invoiceCall.json as { Line: { Amount: number }[] }).Line.reduce((s, l) => s + l.Amount * 100, 0))).toBe(sent!.totalCents);
      const paymentCall = requestsTo(QBO).find((r) => r.url.endsWith("/payment"))!;
      expect(paymentCall.json).toMatchObject({ CustomerRef: { value: "58" }, TotalAmt: sent!.totalCents / 100, Line: [{ Amount: sent!.totalCents / 100, LinkedTxn: [{ TxnId: "INV-1001", TxnType: "Invoice" }] }] });
      expect(requestsTo(QBO).filter((r) => r.url.endsWith("/customer")), "one customer, reused for the payment").toHaveLength(1);
      expect(requestsTo(QBO).filter((r) => r.url.endsWith("/salesreceipt"))).toHaveLength(0);
      const invLog = await db.select().from(quickbooksSyncLogTable).where(and(eq(quickbooksSyncLogTable.userId, org.userId), eq(quickbooksSyncLogTable.entityId, inv.id)));
      expect(invLog).toHaveLength(1);
      expect(invLog[0]).toMatchObject({ status: "synced", qboId: "INV-1001", qboType: "Invoice" });
      const payLog = await db.select().from(quickbooksSyncLogTable).where(and(eq(quickbooksSyncLogTable.userId, org.userId), eq(quickbooksSyncLogTable.entityType, "invoice_payment")));
      expect(payLog).toMatchObject([{ status: "synced", qboId: "PAY-3003", qboType: "Payment" }]);

      resetRecorded();
      const job = await org.api("/api/jobs", { body: { name: "Books job" } });
      expect(job.status).toBe(201);
      const jobId = job.body.job.id as string;
      const cost = await org.api(`/api/jobs/${jobId}/costs`, { body: { category: "materials", vendor: "Home Depot", description: "Lumber", totalCents: 54_321, taxCents: 0 } });
      expect(cost.status, JSON.stringify(cost.body)).toBe(201);
      const purchase = requestsTo(QBO).find((r) => r.url.endsWith("/purchase"))!;
      expect(purchase, "Purchase posted").toBeTruthy();
      expect(purchase.json).toMatchObject({ PaymentType: "Cash", AccountRef: { value: "35" }, EntityRef: { value: "V-9", type: "Vendor" }, Line: [{ Amount: 543.21, DetailType: "AccountBasedExpenseLineDetail", AccountBasedExpenseLineDetail: { AccountRef: { value: "64" } } }] });
      const costLog = await db.select().from(quickbooksSyncLogTable).where(and(eq(quickbooksSyncLogTable.userId, org.userId), eq(quickbooksSyncLogTable.entityType, "cost_entry")));
      expect(costLog).toHaveLength(1);
      expect(costLog[0]).toMatchObject({ status: "synced", qboId: "P-2002", qboType: "Purchase" });

      // Unmapped category → the automation fails loudly into the sync log (retryable from Settings), the cost itself is still saved.
      resetRecorded();
      const unmapped = await org.api(`/api/jobs/${jobId}/costs`, { body: { category: "labour", vendor: "Crew", totalCents: 10_000, taxCents: 0 } });
      expect(unmapped.status).toBe(201);
      expect(requestsTo(QBO)).toHaveLength(0);
      const failedLog = await db.select().from(quickbooksSyncLogTable).where(and(eq(quickbooksSyncLogTable.userId, org.userId), eq(quickbooksSyncLogTable.status, "failed")));
      expect(failedLog).toHaveLength(1);
      expect(failedLog[0]!.error).toMatch(/labour/);
      const log = await org.api("/api/quickbooks/sync-log");
      expect(log.status).toBe(200);
      expect(JSON.stringify(log.body)).toContain("P-2002");
    });

    afterAll(() => unstubHost(QBO));
  });

  // ── 4. Honest "not configured" states ──────────────────────────────────────

  describe("integrations without an app registration", () => {
    const CASES: { name: IntegrationName; status: string; connect: { method?: "GET" | "POST" | "PUT"; path: string; body?: unknown }; statusPath?: (b: Record<string, unknown>) => unknown }[] = [
      { name: "wave", status: "/api/wave/status", connect: { path: "/api/wave/connect" } },
      { name: "quickbooks", status: "/api/quickbooks/status", connect: { path: "/api/quickbooks/connect" } },
      { name: "meta_lead_ads", status: "/api/meta-lead-ads/status", connect: { path: "/api/meta-lead-ads/connect" } },
      { name: "google_lsa", status: "/api/google-lsa/status", connect: { path: "/api/google-lsa/connect?lsaCustomerId=1234567890" } },
      { name: "flinks", status: "/api/flinks/status", connect: { path: "/api/flinks/connect-url" } },
      { name: "financeit", status: "/api/financeit/status", connect: { method: "PUT", path: "/api/financeit/dealer", body: { dealerId: "D-1" } } },
      { name: "whatsapp", status: "/api/whatsapp/status", connect: { method: "POST", path: "/api/whatsapp/connect", body: { phoneNumber: "+16135550199" } } },
      { name: "stripe", status: "/api/invoice-payments/connect/status", connect: { method: "POST", path: "/api/invoice-payments/connect/onboard" } },
      { name: "google_calendar", status: "/api/calendar/status", connect: { path: "/api/calendar/google/connect" }, statusPath: (b) => (b.available as Record<string, unknown>).google },
      { name: "outlook_calendar", status: "/api/calendar/status", connect: { path: "/api/calendar/outlook/connect" }, statusPath: (b) => (b.available as Record<string, unknown>).outlook },
      { name: "gmail_send", status: "/api/email-connections/status", connect: { path: "/api/email-connections/google/connect" }, statusPath: (b) => (b.available as Record<string, unknown>).google },
    ];

    let org: TestUser;
    beforeAll(async () => {
      org = await createOrg({ companyName: "Unconfigured Co" });
    });

    test.each(CASES)("$name: status says available=false and connect is a 503 NOT_CONFIGURED, never a vendor redirect", async ({ name, status, connect, statusPath }) => {
      const saved: Record<string, string | undefined> = {};
      for (const k of INTEGRATION_ENV[name]) {
        saved[k] = process.env[k];
        delete process.env[k];
      }
      try {
        const s = await org.api(status);
        expect(s.status, JSON.stringify(s.body)).toBe(200);
        expect(statusPath ? statusPath(s.body) : s.body.available).toBe(false);
        const c = await org.api(connect.path, { method: connect.method ?? "GET", body: connect.body });
        expect(c.status, JSON.stringify(c.body)).toBe(503);
        expect(c.body).toMatchObject({ error: "NOT_CONFIGURED", integration: name });
        expect(c.body.message).toMatch(/isn't available yet/i);
      } finally {
        for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
      }
    });

    test("with credentials present the same status reports available=true (QuickBooks + Google Calendar are registered in production)", async () => {
      const withEnv = async (name: IntegrationName, fn: () => Promise<void>) => {
        const saved: Record<string, string | undefined> = {};
        for (const k of INTEGRATION_ENV[name]) {
          saved[k] = process.env[k];
          process.env[k] ??= `e2e-${k.toLowerCase()}`;
        }
        try {
          await fn();
        } finally {
          for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k];
        }
      };
      await withEnv("quickbooks", async () => {
        expect((await org.api("/api/quickbooks/status")).body.available).toBe(true);
        expect((await org.api("/api/quickbooks/connect")).status).toBe(200);
      });
      await withEnv("google_calendar", async () => {
        expect((await org.api("/api/calendar/status")).body.available.google).toBe(true);
        expect((await org.api("/api/calendar/google/connect")).status).toBe(200);
      });
      await withEnv("wave", async () => {
        expect((await org.api("/api/wave/status")).body.available).toBe(true);
      });
    });
  });

  // ── 5. Template hygiene ────────────────────────────────────────────────────

  describe("transactional emails captured during this run", () => {
    test("render without leaked placeholders, in both languages", () => {
      expect(sentEmails.length).toBeGreaterThan(10);
      const leaks: string[] = [];
      for (const m of sentEmails) {
        const text = `${m.subject}\n${HTML_TEXT(m.html)}`;
        if (/\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b|\{\{|\$\{/.test(text)) leaks.push(`${m.subject} → ${text.match(/.{0,40}(undefined|NaN|\[object Object\]|null|\{\{|\$\{).{0,40}/)?.[0]}`);
        if (!m.from.includes("<no-reply@quoteai.ca>")) leaks.push(`${m.subject} → unexpected From ${m.from}`);
      }
      expect(leaks, leaks.join("\n")).toEqual([]);
      const subjects = new Set(sentEmails.map((m) => m.subject));
      const fr = [...subjects].filter((s) => /[àâçéèêëîïôûùüÿœ]|facture|contrat|rappel|devis/i.test(s));
      const en = [...subjects].filter((s) => /invoice|contract|reminder|quote|receipt|review/i.test(s));
      expect(fr.length, `French subjects: ${fr.join(" | ")}`).toBeGreaterThan(0);
      expect(en.length, `English subjects: ${en.join(" | ")}`).toBeGreaterThan(0);
      console.log(`\n${subjects.size} distinct transactional subjects rendered clean:\n  ${[...subjects].join("\n  ")}`);
    });
  });
});
