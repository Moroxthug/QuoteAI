// Phase 77 — offline field mode + web push, server side:
//  • the worker page's queued ops replayed with `clientRef` + `at`: clock-in
//    at the real tap time (audited as an offline sync), duplicate deliveries
//    return the same row, clock-out by the clock-in's clientRef, last-write-
//    wins on an entry someone closed elsewhere (audited), locked once reviewed,
//    timestamps outside the window rejected
//  • the dashboard's queued cost / time / photo creates replayed by clientRef
//  • push: subscribe → a pushable notification is encrypted to the browser key
//    and delivered (decrypted here with the subscriber's private key); a 410
//    from the push service drops the row; bell-only types stay silent;
//    unsubscribe; 503 when VAPID is not configured.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { createECDH, randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, projectsTable, timeEntriesTable, costEntriesTable, jobPhotosTable, auditLogTable, pushSubscriptionsTable } from "@workspace/db";
import { createNotification } from "../lib/notifications.js";
import { generateVapidKeys, decryptPayloadForTest, verifyVapidForTest } from "../lib/webPush.js";
import { startServer, stopServer, createOrg, cleanupAll, api } from "./harness.js";
import { installVendorStubs, stubHost, unstubHost, requestsTo, resetRecorded } from "./vendorStub.js";

const PUSH_HOST = "https://push.e2e-test.invalid/";
const H = 3_600_000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

async function workerLink(org: Awaited<ReturnType<typeof createOrg>>) {
  const worker = await org.api("/api/team/workers", { body: { name: "Sam Field", email: `sam-${org.userId}@example.invalid`, hourlyRateCents: 3500 } });
  expect(worker.status, JSON.stringify(worker.body)).toBe(201);
  const invite = await org.api(`/api/team/workers/${worker.body.worker.id}/invite`, { body: {} });
  expect(invite.status).toBe(200);
  return { workerId: worker.body.worker.id as string, token: invite.body.url.split("/t/")[1] as string };
}

const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

describe("Offline field mode (Phase 77)", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("worker queue replay: clock-in at the tap time, idempotent by clientRef, clock-out by the clock-in ref", async () => {
    const org = await createOrg({ plan: "monthly_elite" });
    const [job] = await db.insert(projectsTable).values({ userId: org.userId, name: "Offline job", status: "active" }).returning();
    const { workerId, token } = await workerLink(org);

    // Tapped "clock in" three hours ago without signal; the phone replays it now.
    const ref = randomUUID();
    const at = iso(3 * H);
    const first = await api(`/api/t/${token}/clock-in`, { body: { projectId: job!.id, at, clientRef: ref } });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.entry.clockInAt).toBe(at);
    // Delivered twice (the reply was lost the first time) → same row, no second clock-in.
    const again = await api(`/api/t/${token}/clock-in`, { body: { projectId: job!.id, at, clientRef: ref } });
    expect(again.status).toBe(200);
    expect(again.body.replayed).toBe(true);
    expect(again.body.entry.id).toBe(first.body.entry.id);
    expect((await db.select().from(timeEntriesTable).where(eq(timeEntriesTable.workerId, workerId))).length).toBe(1);
    // A different op while one is open is still refused.
    expect((await api(`/api/t/${token}/clock-in`, { body: { projectId: job!.id, clientRef: randomUUID() } })).status).toBe(409);
    // The offline replay is audited.
    const audits = await db.select().from(auditLogTable).where(and(eq(auditLogTable.entityId, first.body.entry.id), eq(auditLogTable.action, "offline_sync")));
    expect(audits).toHaveLength(1);
    expect((audits[0]!.diff as { field: string }).field).toBe("clockInAt");

    // Clock-out queued without knowing the server id: by the clock-in's clientRef, one hour ago.
    const outAt = iso(1 * H);
    const out = await api(`/api/t/${token}/clock-out`, { body: { entryClientRef: ref, at: outAt } });
    expect(out.status, JSON.stringify(out.body)).toBe(200);
    expect(out.body.entry.hours).toBe(2);
    expect(out.body.entry.clockOutAt).toBe(outAt);
    // Replayed clock-out → same row, no change.
    const outAgain = await api(`/api/t/${token}/clock-out`, { body: { entryClientRef: ref, at: outAt } });
    expect(outAgain.status).toBe(200);
    expect(outAgain.body.replayed).toBe(true);
    // Nothing open any more.
    expect((await api(`/api/t/${token}/clock-out`, { body: {} })).status).toBe(409);

    // Timestamps outside the window and before the clock-in are rejected.
    expect((await api(`/api/t/${token}/clock-in`, { body: { projectId: job!.id, at: iso(8 * 24 * H), clientRef: randomUUID() } })).body.error).toBe("BAD_TIMESTAMP");
    expect((await api(`/api/t/${token}/clock-in`, { body: { projectId: job!.id, at: new Date(Date.now() + H).toISOString(), clientRef: randomUUID() } })).body.error).toBe("BAD_TIMESTAMP");
    const live = await api(`/api/t/${token}/clock-in`, { body: { projectId: job!.id, clientRef: randomUUID() } });
    expect(live.status).toBe(201);
    expect((await api(`/api/t/${token}/clock-out`, { body: { entryId: live.body.entry.id, at: iso(2 * H) } })).body.error).toBe("BEFORE_CLOCK_IN");
    expect((await api(`/api/t/${token}/entries/${live.body.entry.id}/clock-out`, { body: {} })).status).toBe(200);

    // Manual entry queued offline → replay returns the same row.
    const mref = randomUUID();
    const manual = await api(`/api/t/${token}/entries`, { body: { projectId: job!.id, date: new Date().toISOString().slice(0, 10), hours: 2, note: "offline", clientRef: mref } });
    expect(manual.status).toBe(201);
    const manualAgain = await api(`/api/t/${token}/entries`, { body: { projectId: job!.id, date: new Date().toISOString().slice(0, 10), hours: 2, note: "offline", clientRef: mref } });
    expect(manualAgain.status).toBe(200);
    expect(manualAgain.body.entry.id).toBe(manual.body.entry.id);
  });

  test("last write wins on an entry closed elsewhere while unreviewed; locked once approved", async () => {
    const org = await createOrg({ plan: "monthly_elite" });
    const [job] = await db.insert(projectsTable).values({ userId: org.userId, name: "Overwrite job", status: "active" }).returning();
    const { token } = await workerLink(org);
    const ref = randomUUID();
    const clockIn = await api(`/api/t/${token}/clock-in`, { body: { projectId: job!.id, at: iso(5 * H), clientRef: ref } });
    expect(clockIn.status).toBe(201);
    const entryId = clockIn.body.entry.id as string;
    // Someone closed it (live) meanwhile — e.g. the worker on another phone.
    const closedElsewhere = await api(`/api/t/${token}/entries/${entryId}/clock-out`, { body: {} });
    expect(closedElsewhere.status).toBe(200);
    expect(closedElsewhere.body.entry.hours).toBe(5);
    // The offline clock-out from the first phone lands later, stamped an hour ago → it wins, audited.
    const late = await api(`/api/t/${token}/clock-out`, { body: { entryClientRef: ref, at: iso(1 * H) } });
    expect(late.status, JSON.stringify(late.body)).toBe(200);
    expect(late.body.entry.hours).toBe(4);
    const audits = await db.select().from(auditLogTable).where(and(eq(auditLogTable.entityId, entryId), eq(auditLogTable.action, "offline_overwrite")));
    expect(audits).toHaveLength(1);
    expect((audits[0]!.diff as { previousHours: number }).previousHours).toBe(5);
    // A live clock-out of a closed entry is still a 409 (nothing to overwrite with).
    expect((await api(`/api/t/${token}/entries/${entryId}/clock-out`, { body: {} })).body.error).toBe("NOT_OPEN");
    // Approved by the company → a later offline clock-out cannot rewrite it.
    const approve = await org.api(`/api/team/time-entries/${entryId}`, { method: "PUT", body: { status: "approved" } });
    expect(approve.status, JSON.stringify(approve.body)).toBe(200);
    const afterApproval = await api(`/api/t/${token}/clock-out`, { body: { entryClientRef: ref, at: iso(0.5 * H) } });
    expect(afterApproval.status).toBe(409);
    expect(afterApproval.body.error).toBe("LOCKED");
  });

  test("dashboard queue replay: cost, time entry and photo creates are idempotent by clientRef", async () => {
    const org = await createOrg({ plan: "monthly_elite" });
    const [job] = await db.insert(projectsTable).values({ userId: org.userId, name: "Dashboard job", status: "active" }).returning();
    const worker = await org.api("/api/team/workers", { body: { name: "Alex", hourlyRateCents: 4000 } });
    expect(worker.status).toBe(201);

    const costRef = randomUUID();
    const costBody = { category: "materials", vendor: "Home Depot", description: "drywall", totalCents: 34_000, clientRef: costRef };
    const c1 = await org.api(`/api/jobs/${job!.id}/costs`, { body: costBody });
    expect(c1.status, JSON.stringify(c1.body)).toBe(201);
    const c2 = await org.api(`/api/jobs/${job!.id}/costs`, { body: costBody });
    expect(c2.status).toBe(200);
    expect(c2.body.replayed).toBe(true);
    expect(c2.body.entry.id).toBe(c1.body.entry.id);
    expect((await db.select().from(costEntriesTable).where(eq(costEntriesTable.projectId, job!.id))).length).toBe(1);

    const timeRef = randomUUID();
    const timeBody = { workerId: worker.body.worker.id, date: new Date().toISOString().slice(0, 10), hours: 3, clientRef: timeRef };
    const t1 = await org.api(`/api/jobs/${job!.id}/time-entries`, { body: timeBody });
    expect(t1.status, JSON.stringify(t1.body)).toBe(201);
    const t2 = await org.api(`/api/jobs/${job!.id}/time-entries`, { body: timeBody });
    expect(t2.status).toBe(200);
    expect(t2.body.entry.id).toBe(t1.body.entry.id);
    // One labour cost, not two.
    expect((await db.select().from(costEntriesTable).where(and(eq(costEntriesTable.projectId, job!.id), eq(costEntriesTable.source, "time_entry")))).length).toBe(1);

    const photoRef = randomUUID();
    const upload = () => {
      const fd = new FormData();
      fd.append("file", new Blob([pngBytes], { type: "image/png" }), "site.png");
      fd.append("clientRef", photoRef);
      fd.append("caption", "offline photo");
      return org.api(`/api/jobs/${job!.id}/photos`, { method: "POST", form: fd });
    };
    const p1 = await upload();
    expect(p1.status, JSON.stringify(p1.body)).toBe(201);
    const p2 = await upload();
    expect(p2.status).toBe(200);
    expect(p2.body.photo.id).toBe(p1.body.photo.id);
    expect((await db.select().from(jobPhotosTable).where(eq(jobPhotosTable.projectId, job!.id))).length).toBe(1);
  });
});

describe("Web push (Phase 77)", () => {
  const keys = generateVapidKeys();
  const saved = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY };
  beforeAll(async () => {
    await startServer();
    installVendorStubs();
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  });
  afterAll(async () => {
    unstubHost(PUSH_HOST);
    if (saved.pub) process.env.VAPID_PUBLIC_KEY = saved.pub; else delete process.env.VAPID_PUBLIC_KEY;
    if (saved.priv) process.env.VAPID_PRIVATE_KEY = saved.priv; else delete process.env.VAPID_PRIVATE_KEY;
    await cleanupAll();
    await stopServer();
  });

  function browser() {
    const ua = createECDH("prime256v1");
    ua.generateKeys();
    const auth = randomBytes(16);
    const endpoint = `${PUSH_HOST}send/${randomUUID()}`;
    return { ua, auth, endpoint, subscription: { endpoint, keys: { p256dh: ua.getPublicKey().toString("base64url"), auth: auth.toString("base64url") } } };
  }

  async function waitForPushes(n: number) {
    for (let i = 0; i < 40 && requestsTo(PUSH_HOST).length < n; i++) await new Promise((r) => setTimeout(r, 50));
    return requestsTo(PUSH_HOST);
  }

  test("subscribe → pushable notification delivered encrypted → bell-only type silent → 410 drops the row → unsubscribe", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const b = browser();
    let status = 201;
    stubHost(PUSH_HOST, () => new Response(null, { status }));

    const cfg = await org.api("/api/push/config");
    expect(cfg.body).toMatchObject({ configured: true, publicKey: keys.publicKey, subscribed: false });

    const sub = await org.api("/api/push/subscriptions", { body: { ...b.subscription, language: "fr" } });
    expect(sub.status, JSON.stringify(sub.body)).toBe(201);
    // Same browser again → same row.
    expect((await org.api("/api/push/subscriptions", { body: b.subscription })).status).toBe(201);
    expect((await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, org.userId))).length).toBe(1);
    expect((await org.api(`/api/push/config?endpoint=${encodeURIComponent(b.endpoint)}`)).body.subscribed).toBe(true);

    resetRecorded();
    await createNotification({ userId: org.userId, type: "invoice_payment_reported", title: "Marie says she paid", body: "$1,250.00 by e-Transfer", link: "/dashboard/invoices/1", entityType: "invoice", entityId: "1" });
    const sent = await waitForPushes(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.headers["content-encoding"]).toBe("aes128gcm");
    expect(sent[0]!.headers.ttl).toBe("86400");
    expect(sent[0]!.headers.topic).toBe("invoice1");
    expect(verifyVapidForTest(sent[0]!.headers.authorization!, keys.publicKey).aud).toBe("https://push.e2e-test.invalid");

    // Bell-only type: nothing pushed.
    await createNotification({ userId: org.userId, type: "invoice_drafted", title: "Draft ready" });
    await new Promise((r) => setTimeout(r, 300));
    expect(requestsTo(PUSH_HOST)).toHaveLength(1);

    // Test endpoint reaches only this member's browsers.
    const t = await org.api("/api/push/test", { body: { language: "fr" } });
    expect(t.status).toBe(200);
    expect(t.body).toMatchObject({ sent: 1, failed: 0, removed: 0 });
    const [row] = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, b.endpoint));
    expect(row!.lastUsedAt).not.toBeNull();
    expect(row!.failureCount).toBe(0);

    // The push service says the browser is gone → the row is deleted.
    status = 410;
    await createNotification({ userId: org.userId, type: "contract_signed", title: "Signed" });
    await waitForPushes(3);
    for (let i = 0; i < 40 && (await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, b.endpoint))).length; i++) await new Promise((r) => setTimeout(r, 50));
    expect((await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, b.endpoint))).length).toBe(0);

    // Re-subscribe, then unsubscribe explicitly.
    status = 201;
    expect((await org.api("/api/push/subscriptions", { body: b.subscription })).status).toBe(201);
    const del = await org.api("/api/push/subscriptions", { method: "DELETE", body: { endpoint: b.endpoint } });
    expect(del.body).toEqual({ success: true, removed: true });
    expect((await org.api("/api/push/test", { body: {} })).body.skipped).toBe("no_subscriptions");
    // Malformed keys are refused.
    expect((await org.api("/api/push/subscriptions", { body: { endpoint: "http://insecure.invalid/x", keys: b.subscription.keys } })).status).toBe(400);
  });

  test("the payload decrypts with the subscriber's private key", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const b = browser();
    const raw: Buffer[] = [];
    // Capture the bytes before vendorStub's string conversion: replace fetch for this endpoint only.
    const real = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(b.endpoint)) {
        raw.push(Buffer.from(init!.body as Uint8Array));
        return new Response(null, { status: 201 });
      }
      return real(input, init);
    }) as typeof fetch;
    try {
      expect((await org.api("/api/push/subscriptions", { body: b.subscription })).status).toBe(201);
      await createNotification({ userId: org.userId, type: "client_message", title: "New message from Marie", body: "Can you come Tuesday?", link: "/dashboard/clients/x" });
      for (let i = 0; i < 40 && raw.length < 1; i++) await new Promise((r) => setTimeout(r, 50));
      expect(raw).toHaveLength(1);
      const payload = JSON.parse(decryptPayloadForTest(raw[0]!, b.ua, b.auth).toString());
      expect(payload).toMatchObject({ title: "New message from Marie", body: "Can you come Tuesday?", link: "/dashboard/clients/x", tag: "client_message", lang: "en" });
    } finally {
      globalThis.fetch = real;
    }
  });

  test("503 when VAPID is not configured", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const b = browser();
    delete process.env.VAPID_PUBLIC_KEY;
    try {
      expect((await org.api("/api/push/config")).body).toMatchObject({ configured: false, publicKey: null });
      expect((await org.api("/api/push/subscriptions", { body: b.subscription })).status).toBe(503);
      expect((await org.api("/api/push/test", { body: {} })).status).toBe(503);
    } finally {
      process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    }
  });
});
