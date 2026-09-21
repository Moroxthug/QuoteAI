// Phase 74 — the SMS channel end to end, with api.twilio.com answered by the
// vendor stub (src/e2e/vendorStub.ts): every send's exact form body is
// recorded, so the CASL block, the gates (allowance, opt-out, not
// configured), the lead sequence over SMS, the job "on my way" text and the
// signed inbound webhook (STOP → everything unsubscribed, START → back) are
// all exercised without a real number.

import { describe, test, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, leadsTable, leadEventsTable, clientsTable, projectsTable, smsMessagesTable, smsOptOutsTable, usageEventsTable, notificationsTable } from "@workspace/db";
import "../automations/index.js";
import { runLeadMaintenance } from "../leads/maintenance.js";
import { twilioSignature } from "../lib/sms.js";
import { startServer, stopServer, createOrg, cleanupAll, daysAgo } from "./harness.js";
import { emailsTo } from "./mailbox.js";
import { stubHost, json, requestsTo, resetRecorded } from "./vendorStub.js";

const TWILIO = "https://api.twilio.com/";

/** A distinct NANP number per test so phone-keyed opt-outs never bleed between tests or runs. */
let seq = 0;
const freshPhone = () => `613555${String(1000 + ((Date.now() + seq++) % 9000)).padStart(4, "0")}`;

function twilioForm(): URLSearchParams {
  const last = requestsTo(TWILIO).at(-1);
  expect(last, "a Twilio send should have been made").toBeDefined();
  return new URLSearchParams(last!.body ?? "");
}

async function postWebhook(baseUrl: string, fields: Record<string, string>, opts: { sign?: boolean } = {}): Promise<Response> {
  const url = process.env.TWILIO_WEBHOOK_URL!;
  const signature = opts.sign === false ? "bogus" : twilioSignature(process.env.TWILIO_AUTH_TOKEN!, url, fields);
  return fetch(`${baseUrl}/api/sms/webhook`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": signature },
    body: new URLSearchParams(fields),
  });
}

describe("SMS channel (Phase 74)", () => {
  let baseUrl = "";
  beforeAll(async () => {
    baseUrl = await startServer();
    stubHost(TWILIO, () => json(201, { sid: `SM${Date.now()}`, status: "queued" }));
  });
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });
  beforeEach(() => resetRecorded());

  test("status reports availability, defaults and allowance; settings persist", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const status = await org.api("/api/sms/status");
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ available: true, smsEnabled: false, smsReminders: false, usage: { used: 0, allowance: 300 }, ownPhone: "(613) 555-0100", fromNumberHint: "+1 ••• ••• 0199" });
    expect(status.body.identityLine).toBe("E2E ON Co ((613) 555-0100)");

    const put = await org.api("/api/sms/settings", { method: "PUT", body: { smsEnabled: true } });
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ smsEnabled: true, smsReminders: false, scheduleReminders: true });
    const profile = await org.api("/api/business-profile");
    expect(profile.body.automationSettings).toMatchObject({ smsEnabled: true, smsReminders: false, invoiceReminders: true });

    const free = await createOrg({ plan: "free" });
    const freeStatus = await free.api("/api/sms/status");
    expect(freeStatus.body.usage.allowance).toBe(0);
  });

  test("test send: CASL block on the wire, logged, metered; free plan is refused by allowance", async () => {
    const org = await createOrg({ plan: "monthly_starter", companyName: "Acme Reno Inc." });
    const sent = await org.api("/api/sms/test", { body: { lang: "fr" } });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect(sent.body.body).toBe("Acme Reno Inc. ((613) 555-0100): Ceci est un texto de test envoyé depuis QuoteAI. Vos clients recevront vos messages dans ce format. Répondez STOP pour ne plus recevoir de textos.");

    const form = twilioForm();
    expect(form.get("To")).toBe("+16135550100");
    expect(form.get("From")).toBe("+18005550199");
    expect(form.get("Body")).toBe(sent.body.body);
    const last = requestsTo(TWILIO).at(-1)!;
    expect(last.url).toBe("https://api.twilio.com/2010-04-01/Accounts/ACe2e0000000000000000000000000000/Messages.json");
    expect(last.headers.authorization).toMatch(/^Basic /);

    const rows = await db.select().from(smsMessagesTable).where(eq(smsMessagesTable.userId, org.userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ direction: "outbound", purpose: "test", status: "sent", phone: "+16135550100", language: "fr" });
    expect(rows[0]!.providerSid).toMatch(/^SM/);
    const usage = await db.select().from(usageEventsTable).where(and(eq(usageEventsTable.userId, org.userId), eq(usageEventsTable.kind, "sms")));
    expect(usage).toHaveLength(1);
    expect(Number(usage[0]!.quantity)).toBe(rows[0]!.segments);
    const status = await org.api("/api/sms/status");
    expect(status.body.usage).toEqual({ used: rows[0]!.segments, allowance: 50 });
    const log = await org.api("/api/sms/messages");
    expect(log.body.items[0]).toMatchObject({ phone: "(613) 555-0100", status: "sent" });

    // Free plan: allowance 0 → refused before Twilio is called, logged as skipped.
    resetRecorded();
    const free = await createOrg({ plan: "free" });
    const refused = await free.api("/api/sms/test", { body: {} });
    expect(refused.status).toBe(402);
    expect(refused.body).toEqual({ error: "SEND_FAILED", reason: "allowance_exceeded" });
    expect(requestsTo(TWILIO)).toHaveLength(0);
    const skipped = await db.select().from(smsMessagesTable).where(eq(smsMessagesTable.userId, free.userId));
    expect(skipped[0]).toMatchObject({ status: "skipped", error: "allowance_exceeded" });

    // No phone on the profile → 400, nothing sent.
    const noPhone = await createOrg({ plan: "monthly_pro", profile: { phone: null } });
    expect((await noPhone.api("/api/sms/test", { body: {} })).status).toBe(400);
  });

  test("not configured: honest 503, sends logged as skipped, nothing leaves", async () => {
    const saved = process.env.TWILIO_FROM_NUMBER;
    process.env.TWILIO_FROM_NUMBER = "";
    try {
      const org = await createOrg({ plan: "monthly_pro" });
      expect((await org.api("/api/sms/status")).body.available).toBe(false);
      const r = await org.api("/api/sms/test", { body: {} });
      expect(r.status).toBe(503);
      expect(r.body.error).toBe("NOT_CONFIGURED");
      expect(requestsTo(TWILIO)).toHaveLength(0);
    } finally {
      process.env.TWILIO_FROM_NUMBER = saved;
    }
  });

  test("lead who prefers texts: consent recorded, sequence goes out by SMS, STOP ends it everywhere", async () => {
    const org = await createOrg({ plan: "monthly_pro", profile: { automationSettings: { smsEnabled: true } } });
    const phone = freshPhone();
    const email = `sms-lead-${org.userId}@example.invalid`;
    const created = await org.api("/api/leads", { body: { name: "Texty Prospect", email, phone: `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`, preferredChannel: "sms", preferredLanguage: "en" } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const leadId = created.body.lead.id as string;
    const consent = await db.select().from(leadEventsTable).where(and(eq(leadEventsTable.leadId, leadId), eq(leadEventsTable.type, "consent_recorded")));
    expect(consent).toHaveLength(2);
    expect(consent.filter((e) => e.channel === "sms")).toHaveLength(1);

    // Stage 0 due → SMS, not email.
    await db.update(leadsTable).set({ nextFollowUpAt: daysAgo(0.01) }).where(eq(leadsTable.id, leadId));
    await runLeadMaintenance();
    const [after] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
    expect(after!.followUpStage).toBe(1);
    expect(emailsTo(email)).toHaveLength(0);
    const form = twilioForm();
    expect(form.get("To")).toBe(`+1${phone}`);
    expect(form.get("Body")).toMatch(/^E2E ON Co \(\(613\) 555-0100\): Still interested in your project\? .* Reply STOP to opt out\.$/);
    const sentEvents = await db.select().from(leadEventsTable).where(and(eq(leadEventsTable.leadId, leadId), eq(leadEventsTable.type, "message_sent")));
    expect(sentEvents).toHaveLength(1);
    expect(sentEvents[0]!.channel).toBe("sms");

    // A tampered webhook is rejected outright.
    const bad = await postWebhook(baseUrl, { From: `+1${phone}`, Body: "STOP", MessageSid: "SMbad" }, { sign: false });
    expect(bad.status).toBe(403);
    expect((await db.select().from(smsOptOutsTable).where(eq(smsOptOutsTable.phone, `+1${phone}`))).length).toBe(0);

    // The real STOP: opt-out row, lead unsubscribed on every channel, contractor notified.
    const stop = await postWebhook(baseUrl, { From: `+1${phone}`, Body: "Stop", MessageSid: "SMstop1", To: "+18005550199" });
    expect(stop.status).toBe(200);
    expect(stop.headers.get("content-type")).toMatch(/xml/);
    const [optOut] = await db.select().from(smsOptOutsTable).where(eq(smsOptOutsTable.phone, `+1${phone}`));
    expect(optOut).toMatchObject({ source: "stop_keyword", keyword: "STOP", userId: org.userId });
    const [stopped] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
    expect(stopped!.status).toBe("unsubscribed");
    expect(stopped!.unsubscribedAt).not.toBeNull();
    expect(stopped!.nextFollowUpAt).toBeNull();
    const unsub = await db.select().from(leadEventsTable).where(and(eq(leadEventsTable.leadId, leadId), eq(leadEventsTable.type, "unsubscribed")));
    expect(unsub).toHaveLength(1);
    const notes = await db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, org.userId), eq(notificationsTable.type, "sms_opt_out")));
    expect(notes).toHaveLength(1);
    const inbound = await db.select().from(smsMessagesTable).where(and(eq(smsMessagesTable.userId, org.userId), eq(smsMessagesTable.direction, "inbound")));
    expect(inbound[0]).toMatchObject({ purpose: "opt_out", status: "received", body: "Stop" });

    // Any later send to that number is skipped before Twilio, and the sequence does not resume.
    resetRecorded();
    await runLeadMaintenance();
    expect(requestsTo(TWILIO)).toHaveLength(0);
    const manual = await org.api(`/api/leads/${leadId}/send`, { body: {} });
    expect(manual.status).toBe(409);

    // START lifts the opt-out (the lead stays unsubscribed until re-consented — that is a human decision).
    await postWebhook(baseUrl, { From: `+1${phone}`, Body: "START", MessageSid: "SMstart1" });
    expect((await db.select().from(smsOptOutsTable).where(eq(smsOptOutsTable.phone, `+1${phone}`))).length).toBe(0);

    // A plain reply is stored and surfaced as a notification.
    await postWebhook(baseUrl, { From: `+1${phone}`, Body: "Can you come Tuesday?", MessageSid: "SMreply1" });
    const replies = await db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, org.userId), eq(notificationsTable.type, "sms_reply")));
    expect(replies).toHaveLength(1);
    expect(replies[0]!.body).toBe("Can you come Tuesday?");
  });

  test("sms toggle off: a lead who prefers texts still gets email (fallback, never silence)", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const email = `sms-off-${org.userId}@example.invalid`;
    const created = await org.api("/api/leads", { body: { name: "Quiet Prospect", email, phone: freshPhone(), preferredChannel: "sms" } });
    const leadId = created.body.lead.id as string;
    await db.update(leadsTable).set({ nextFollowUpAt: daysAgo(0.01) }).where(eq(leadsTable.id, leadId));
    await runLeadMaintenance();
    expect(requestsTo(TWILIO)).toHaveLength(0);
    expect(emailsTo(email)).toHaveLength(1);
  });

  test("job page: 'on my way' texts the client with name, address and ETA; refused without a phone", async () => {
    const org = await createOrg({ plan: "monthly_pro", companyName: "Acme Reno" });
    const phone = freshPhone();
    const [client] = await db.insert(clientsTable).values({ userId: org.userId, name: "Site Client", phone, preferredLanguage: "fr", dedupKey: `omw-${org.userId}` }).returning();
    const [project] = await db.insert(projectsTable).values({ userId: org.userId, clientId: client!.id, name: "Kitchen", status: "active", address: "12 Rue Principale, Gatineau" }).returning();

    const r = await org.api(`/api/jobs/${project!.id}/sms/on-my-way`, { body: { etaMinutes: 30 } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.body).toBe(`Acme Reno ((613) 555-0100): ${org.name} est en route à 12 Rue Principale, Gatineau, arrivée prévue dans environ 30 minutes. Répondez STOP pour ne plus recevoir de textos.`);
    expect(twilioForm().get("To")).toBe(`+1${phone}`);
    const [row] = await db.select().from(smsMessagesTable).where(and(eq(smsMessagesTable.userId, org.userId), eq(smsMessagesTable.purpose, "on_my_way")));
    expect(row).toMatchObject({ status: "sent", relatedEntityType: "project", relatedEntityId: project!.id });

    // Out of range ETA → 400; client without a phone → 409; another org's job → 404.
    expect((await org.api(`/api/jobs/${project!.id}/sms/on-my-way`, { body: { etaMinutes: 1 } })).status).toBe(400);
    const [noPhone] = await db.insert(clientsTable).values({ userId: org.userId, name: "No Phone", dedupKey: `omw2-${org.userId}` }).returning();
    const [p2] = await db.insert(projectsTable).values({ userId: org.userId, clientId: noPhone!.id, name: "Bath", status: "active" }).returning();
    expect((await org.api(`/api/jobs/${p2!.id}/sms/on-my-way`, { body: {} })).status).toBe(409);
    const other = await createOrg();
    expect((await other.api(`/api/jobs/${project!.id}/sms/on-my-way`, { body: {} })).status).toBe(404);
  });

  test("manual opt-out from the dashboard blocks the number like a STOP", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const phone = freshPhone();
    const r = await org.api("/api/sms/opt-out", { body: { phone } });
    expect(r.status).toBe(200);
    expect(r.body.phone).toBe(`(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`);
    const [client] = await db.insert(clientsTable).values({ userId: org.userId, name: "Opted", phone, dedupKey: `opt-${org.userId}` }).returning();
    const [project] = await db.insert(projectsTable).values({ userId: org.userId, clientId: client!.id, name: "Deck", status: "active" }).returning();
    const blocked = await org.api(`/api/jobs/${project!.id}/sms/on-my-way`, { body: {} });
    expect(blocked.status).toBe(409);
    expect(blocked.body.reason).toBe("opted_out");
    expect(requestsTo(TWILIO)).toHaveLength(0);
  });
});
