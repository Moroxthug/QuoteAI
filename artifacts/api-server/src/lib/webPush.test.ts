import { describe, test, expect } from "vitest";
import { createECDH, randomBytes } from "node:crypto";
import { generateVapidKeys, vapidAuthorization, encryptPayload, decryptPayloadForTest, verifyVapidForTest, readPushKeys, sendWebPush } from "./webPush";

// Phase 77 — the browser side of Web Push, played by Node: a subscriber key
// pair decrypts what we encrypt, and the VAPID token verifies with the public key.

function subscriber() {
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  const auth = randomBytes(16);
  return { ua, auth, sub: { endpoint: "https://push.example.invalid/send/abc", keys: { p256dh: ua.getPublicKey().toString("base64url"), auth: auth.toString("base64url") } } };
}

describe("webPush", () => {
  test("generated keys are base64url P-256 material the browser accepts", () => {
    const k = generateVapidKeys();
    expect(Buffer.from(k.publicKey, "base64url")).toHaveLength(65);
    expect(Buffer.from(k.privateKey, "base64url")).toHaveLength(32);
    expect(k.publicKey).not.toMatch(/[+/=]/);
  });

  test("aes128gcm round-trips through the subscriber's private key", () => {
    const { ua, auth, sub } = subscriber();
    const msg = Buffer.from(JSON.stringify({ title: "Invoice paid", body: "Marie paid $1,250.00", link: "/dashboard/invoices/1" }));
    const body = encryptPayload(sub, msg);
    expect(body.readUInt32BE(16)).toBe(4096);
    expect(body[20]).toBe(65);
    expect(decryptPayloadForTest(body, ua, auth).toString()).toBe(msg.toString());
    // A different salt / ephemeral key every call.
    expect(encryptPayload(sub, msg).equals(body)).toBe(false);
  });

  test("rejects malformed subscriber keys", () => {
    const { sub } = subscriber();
    expect(() => encryptPayload({ ...sub, keys: { ...sub.keys, auth: "short" } }, Buffer.from("x"))).toThrow(/auth/);
    expect(() => encryptPayload({ ...sub, keys: { ...sub.keys, p256dh: Buffer.alloc(33, 4).toString("base64url") } }, Buffer.from("x"))).toThrow(/p256dh/);
  });

  test("VAPID token is scoped to the push-service origin and verifies with the public key", () => {
    const keys = { ...generateVapidKeys(), subject: "mailto:ops@quoteai.ca" };
    const header = vapidAuthorization(keys, "https://fcm.googleapis.com/fcm/send/xyz", 1_800_000_000_000);
    const claims = verifyVapidForTest(header, keys.publicKey);
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("mailto:ops@quoteai.ca");
    expect(claims.exp).toBe(1_800_000_000 + 12 * 3600);
    // Another key pair does not verify it.
    expect(() => verifyVapidForTest(header, generateVapidKeys().publicKey)).toThrow();
  });

  test("readPushKeys: unset → null, bare email → mailto:", () => {
    const saved = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY, sub: process.env.VAPID_SUBJECT };
    try {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.VAPID_SUBJECT;
      expect(readPushKeys()).toBeNull();
      const k = generateVapidKeys();
      process.env.VAPID_PUBLIC_KEY = k.publicKey;
      process.env.VAPID_PRIVATE_KEY = k.privateKey;
      process.env.VAPID_SUBJECT = "ops@quoteai.ca";
      expect(readPushKeys()?.subject).toBe("mailto:ops@quoteai.ca");
      delete process.env.VAPID_SUBJECT;
      expect(readPushKeys()?.subject).toBe("mailto:support@quoteai.ca");
    } finally {
      if (saved.pub) process.env.VAPID_PUBLIC_KEY = saved.pub; else delete process.env.VAPID_PUBLIC_KEY;
      if (saved.priv) process.env.VAPID_PRIVATE_KEY = saved.priv; else delete process.env.VAPID_PRIVATE_KEY;
      if (saved.sub) process.env.VAPID_SUBJECT = saved.sub; else delete process.env.VAPID_SUBJECT;
    }
  });

  test("sendWebPush posts the encrypted body with the RFC headers and maps 410 to gone", async () => {
    const { ua, auth, sub } = subscriber();
    const keys = { ...generateVapidKeys(), subject: "mailto:ops@quoteai.ca" };
    const real = globalThis.fetch;
    const seen: { url: string; headers: Record<string, string>; body: Buffer }[] = [];
    let status = 201;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(url), headers: init!.headers as Record<string, string>, body: Buffer.from(init!.body as Uint8Array) });
      return new Response(null, { status });
    }) as typeof fetch;
    try {
      const ok = await sendWebPush(keys, sub, { title: "Hi", body: "there", tag: "invoice:1" });
      expect(ok).toEqual({ ok: true, status: 201 });
      expect(seen[0]!.url).toBe(sub.endpoint);
      expect(seen[0]!.headers["Content-Encoding"]).toBe("aes128gcm");
      expect(seen[0]!.headers.TTL).toBe("86400");
      expect(seen[0]!.headers.Topic).toBe("invoice1");
      expect(verifyVapidForTest(seen[0]!.headers.Authorization!, keys.publicKey).aud).toBe("https://push.example.invalid");
      expect(JSON.parse(decryptPayloadForTest(seen[0]!.body, ua, auth).toString())).toEqual({ title: "Hi", body: "there", tag: "invoice:1" });
      status = 410;
      expect(await sendWebPush(keys, sub, { title: "x", body: "y" })).toMatchObject({ ok: false, status: 410, gone: true });
      status = 500;
      expect(await sendWebPush(keys, sub, { title: "x", body: "y" })).toMatchObject({ ok: false, status: 500, gone: false });
    } finally {
      globalThis.fetch = real;
    }
  });
});
