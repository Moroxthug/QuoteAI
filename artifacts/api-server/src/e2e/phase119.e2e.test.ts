// Phase 119 (docs/APP-PLAN.md "Native powers"): push to the phone app through
// Firebase Cloud Messaging, proven on the real server with FCM and Google's
// token endpoint stubbed at the fetch boundary:
//  • an installed app registers its token (503 until FIREBASE_SERVICE_ACCOUNT
//    is set, 400 on a bad body); the same install re-registering moves its row
//  • a pushable notification reaches the app: a signed service-account
//    assertion is swapped for an access token, the v1 message carries the
//    title, the body and the in-app link the tap opens
//  • a bell-only type stays silent; a person who muted the category gets
//    nothing while their teammates still do; the preferences round-trip
//  • FCM answering UNREGISTERED drops the row; unregister removes it
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { generateKeyPairSync, createVerify, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, deviceTokensTable } from "@workspace/db";
import { createNotification } from "../lib/notifications.js";
import { resetFcmTokenCache } from "../lib/fcm.js";
import { startServer, stopServer, createOrg, cleanupAll } from "./harness.js";
import { installVendorStubs, stubHost, unstubHost, requestsTo, resetRecorded, json } from "./vendorStub.js";

const TOKEN_HOST = "https://oauth2.googleapis.com/";
const FCM_HOST = "https://fcm.googleapis.com/";
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "quoteai-e2e",
  client_email: "push@quoteai-e2e.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  token_uri: "https://oauth2.googleapis.com/token",
};

const installId = () => randomUUID().replace(/-/g, "");
const fcmToken = () => `fcm-${randomUUID()}-${randomUUID()}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until<T>(read: () => T | Promise<T>, ok: (v: T) => boolean, ms = 3000): Promise<T> {
  const end = Date.now() + ms;
  let v = await read();
  while (!ok(v) && Date.now() < end) {
    await wait(50);
    v = await read();
  }
  return v;
}

const sends = () => requestsTo(FCM_HOST).filter((r) => r.url.endsWith("/messages:send"));

describe("App push through FCM (Phase 119)", () => {
  const saved = process.env.FIREBASE_SERVICE_ACCOUNT;
  let unregistered = new Set<string>();

  beforeAll(async () => {
    installVendorStubs();
    await startServer();
  });
  afterAll(async () => {
    unstubHost(TOKEN_HOST);
    unstubHost(FCM_HOST);
    if (saved) process.env.FIREBASE_SERVICE_ACCOUNT = saved;
    else delete process.env.FIREBASE_SERVICE_ACCOUNT;
    await cleanupAll();
    await stopServer();
  });

  test("503 until the service account is set; bad bodies refused", async () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    const org = await createOrg({ plan: "monthly_elite" });
    const cfg = await org.api("/api/push/config");
    expect(cfg.body.appConfigured).toBe(false);
    const res = await org.api("/api/push/devices", { body: { token: fcmToken(), installId: installId(), platform: "android" } });
    expect(res.status).toBe(503);

    process.env.FIREBASE_SERVICE_ACCOUNT = Buffer.from(JSON.stringify(SERVICE_ACCOUNT)).toString("base64");
    expect((await org.api("/api/push/config")).body.appConfigured).toBe(true);
    expect((await org.api("/api/push/devices", { body: { token: "short", installId: installId(), platform: "android" } })).status).toBe(400);
    expect((await org.api("/api/push/devices", { body: { token: fcmToken(), installId: "bad id!", platform: "android" } })).status).toBe(400);
    expect((await org.api("/api/push/devices", { body: { token: fcmToken(), installId: installId(), platform: "windows" } })).status).toBe(400);
  });

  test("register → pushable notification delivered with its link → bell-only silent → muted category skipped → UNREGISTERED drops → unregister", async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(SERVICE_ACCOUNT);
    resetFcmTokenCache();
    unregistered = new Set();
    stubHost(TOKEN_HOST, () => json(200, { access_token: "ya29.e2e-access", expires_in: 3600, token_type: "Bearer" }));
    stubHost(FCM_HOST, (req) => {
      const token = (req.json as { message: { token: string } }).message.token;
      if (unregistered.has(token)) return json(404, { error: { code: 404, status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } });
      return json(200, { name: `projects/quoteai-e2e/messages/${randomUUID()}` });
    });
    resetRecorded();

    const org = await createOrg({ plan: "monthly_elite" });
    const install = installId();
    const first = fcmToken();
    const reg = await org.api("/api/push/devices", { body: { token: first, installId: install, platform: "android", appVersion: "1.0.0", language: "fr" } });
    expect(reg.status, JSON.stringify(reg.body)).toBe(201);
    // The token rotates on the same install: one row, the new token.
    const second = fcmToken();
    expect((await org.api("/api/push/devices", { body: { token: second, installId: install, platform: "android" } })).status).toBe(201);
    let rows = await db.select().from(deviceTokensTable).where(eq(deviceTokensTable.userId, org.userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token).toBe(second);

    // A pushable type reaches the phone.
    await createNotification({ userId: org.userId, type: "quote_accepted", title: "Quote accepted", body: "Dana accepted Q-1042", link: "/dashboard/quotes/abc", entityType: "quote", entityId: "abc" });
    const delivered = await until(sends, (s) => s.length >= 1);
    expect(delivered).toHaveLength(1);
    const msg = (delivered[0]!.json as { message: any }).message;
    expect(delivered[0]!.url).toBe("https://fcm.googleapis.com/v1/projects/quoteai-e2e/messages:send");
    expect(delivered[0]!.headers.authorization).toBe("Bearer ya29.e2e-access");
    expect(msg.token).toBe(second);
    expect(msg.notification).toEqual({ title: "Quote accepted", body: "Dana accepted Q-1042" });
    expect(msg.data.link).toBe("/dashboard/quotes/abc");
    // Phase 120: the category rides along, so an open app can mark a signature or a payment with a haptic.
    expect(msg.data.category).toBe("signatures");
    expect(msg.android.notification.tag).toBe("quote:abc");

    // The assertion swapped for the access token is signed by the service account's key.
    const tokenCall = requestsTo(TOKEN_HOST)[0]!;
    const assertion = new URLSearchParams(tokenCall.body!).get("assertion")!;
    const [h, c, sig] = assertion.split(".");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${h}.${c}`);
    expect(verifier.verify(publicKey, Buffer.from(sig!, "base64url"))).toBe(true);
    const claims = JSON.parse(Buffer.from(c!, "base64url").toString());
    expect(claims).toMatchObject({ iss: SERVICE_ACCOUNT.client_email, aud: SERVICE_ACCOUNT.token_uri, scope: "https://www.googleapis.com/auth/firebase.messaging" });
    rows = await db.select().from(deviceTokensTable).where(eq(deviceTokensTable.userId, org.userId));
    expect(rows[0]!.lastUsedAt).not.toBeNull();

    // A bell-only type never leaves the server.
    resetRecorded();
    await createNotification({ userId: org.userId, type: "quote_viewed", title: "Quote viewed" });
    await wait(400);
    expect(sends()).toHaveLength(0);

    // Preferences: mute payments → a payment stays in the bell only; signatures still come through.
    const prefs = await org.api("/api/push/preferences");
    expect(prefs.body.categories).toEqual(expect.arrayContaining(["signatures", "payments", "messages", "crew", "budget", "compliance"]));
    expect(prefs.body.muted).toEqual([]);
    expect((await org.api("/api/push/preferences", { method: "PUT", body: { muted: ["nonsense"] } })).status).toBe(400);
    const put = await org.api("/api/push/preferences", { method: "PUT", body: { muted: ["payments", "payments"] } });
    expect(put.status).toBe(200);
    expect(put.body.muted).toEqual(["payments"]);
    expect((await org.api("/api/push/preferences")).body.muted).toEqual(["payments"]);
    await createNotification({ userId: org.userId, type: "paid", title: "Invoice paid" });
    await wait(400);
    expect(sends()).toHaveLength(0);
    await createNotification({ userId: org.userId, type: "contract_signed", title: "Contract signed" });
    expect(await until(sends, (s) => s.length >= 1)).toHaveLength(1);

    // The app was uninstalled: FCM says UNREGISTERED and the row goes.
    unregistered.add(second);
    await createNotification({ userId: org.userId, type: "client_message", title: "New message" });
    rows = await until(() => db.select().from(deviceTokensTable).where(eq(deviceTokensTable.userId, org.userId)), (r) => r.length === 0);
    expect(rows).toHaveLength(0);

    // Unregister (sign-out) removes this install only for its own person.
    const again = installId();
    expect((await org.api("/api/push/devices", { body: { token: fcmToken(), installId: again, platform: "ios" } })).status).toBe(201);
    const del = await org.api("/api/push/devices", { method: "DELETE", body: { installId: again } });
    expect(del.status).toBe(200);
    expect(del.body.removed).toBe(true);
    expect(await db.select().from(deviceTokensTable).where(eq(deviceTokensTable.userId, org.userId))).toHaveLength(0);
  });
});
