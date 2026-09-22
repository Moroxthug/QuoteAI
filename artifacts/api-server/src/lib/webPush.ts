import { createECDH, createPrivateKey, createPublicKey, createSign, createVerify, hkdfSync, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// ── Phase 77: Web Push delivery without a vendor SDK ─────────────────────────
// The two RFCs a push service needs, implemented on Node's crypto:
//   • RFC 8292 VAPID — a short ES256 JWT proving the sender owns the key the
//     browser subscribed with (`Authorization: vapid t=<jwt>, k=<public>`).
//   • RFC 8291 + RFC 8188 — the payload encrypted to the subscriber's ECDH
//     key with aes128gcm content encoding.
// Delivery is a plain `fetch` to the subscription endpoint, so the e2e vendor
// stub (src/e2e/vendorStub.ts) can capture pushes like every other vendor call.
// Keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (base64url, as printed by
// `pnpm --filter @workspace/scripts vapid-keys`), VAPID_SUBJECT (mailto: or https:).

export type PushKeys = { publicKey: string; privateKey: string; subject: string };

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

export type PushDelivery = { ok: true; status: number } | { ok: false; status: number; gone: boolean; error: string };

const b64url = (buf: Buffer | Uint8Array) => Buffer.from(buf).toString("base64url");
const fromB64url = (s: string) => Buffer.from(s, "base64url");

/** Reads the VAPID configuration from the environment; null when push is not set up. */
export function readPushKeys(): PushKeys | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  let subject = process.env.VAPID_SUBJECT?.trim() || "mailto:support@quoteai.ca";
  if (!/^(mailto:|https:\/\/)/.test(subject)) subject = `mailto:${subject}`;
  return { publicKey, privateKey, subject };
}

/** Generates a fresh P-256 pair in the base64url form the browser and the env expect. */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(ecdh.getPrivateKey()) };
}

function vapidPrivateKeyObject(keys: PushKeys) {
  const pub = fromB64url(keys.publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID_PUBLIC_KEY must be a 65-byte uncompressed P-256 point");
  const priv = fromB64url(keys.privateKey);
  if (priv.length !== 32) throw new Error("VAPID_PRIVATE_KEY must be 32 bytes");
  return createPrivateKey({ format: "jwk", key: { kty: "EC", crv: "P-256", x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33, 65)), d: b64url(priv) } });
}

/** Signs the VAPID JWT for one push-service origin (valid 12 h — the RFC caps it at 24). */
export function vapidAuthorization(keys: PushKeys, endpoint: string, now: number = Date.now()): string {
  const audience = new URL(endpoint).origin;
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(Buffer.from(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject })));
  const signer = createSign("SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign({ key: vapidPrivateKeyObject(keys), dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${payload}.${b64url(signature)}, k=${keys.publicKey}`;
}

/** RFC 8291 encryption of `plaintext` to the subscriber; returns the aes128gcm body (RFC 8188 framing, single record). */
export function encryptPayload(subscription: PushSubscriptionInput, plaintext: Buffer, opts: { salt?: Buffer; localKeys?: ReturnType<typeof createECDH> } = {}): Buffer {
  const uaPublic = fromB64url(subscription.keys.p256dh);
  const authSecret = fromB64url(subscription.keys.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error("subscription p256dh must be a 65-byte uncompressed P-256 point");
  if (authSecret.length !== 16) throw new Error("subscription auth must be 16 bytes");
  const local = opts.localKeys ?? createECDH("prime256v1");
  if (!opts.localKeys) local.generateKeys();
  const asPublic = local.getPublicKey();
  const shared = local.computeSecret(uaPublic);
  const salt = opts.salt ?? randomBytes(16);
  // IKM = HKDF(auth, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  // Last (only) record: plaintext || 0x02 delimiter, no extra padding.
  const ciphertext = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, ciphertext]);
}

export type PushMessage = { title: string; body: string; link?: string | null; tag?: string | null; lang?: "en" | "fr" };

/** Encrypts and posts one message to one subscription. Never throws — the caller decides what a failure means for the row. */
export async function sendWebPush(keys: PushKeys, subscription: PushSubscriptionInput, message: PushMessage, opts: { ttlSeconds?: number; urgency?: "very-low" | "low" | "normal" | "high" } = {}): Promise<PushDelivery> {
  let body: Buffer;
  let authorization: string;
  try {
    body = encryptPayload(subscription, Buffer.from(JSON.stringify(message)));
    authorization = vapidAuthorization(keys, subscription.endpoint);
  } catch (err) {
    return { ok: false, status: 0, gone: false, error: (err as Error).message };
  }
  try {
    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(opts.ttlSeconds ?? 24 * 3600),
        Urgency: opts.urgency ?? "normal",
        ...(message.tag ? { Topic: message.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } : {}),
      },
      body: new Uint8Array(body),
    });
    if (res.ok || res.status === 201 || res.status === 202) return { ok: true, status: res.status };
    // 404/410: the browser unsubscribed (or the subscription expired) — drop the row.
    return { ok: false, status: res.status, gone: res.status === 404 || res.status === 410, error: `push service ${res.status}` };
  } catch (err) {
    return { ok: false, status: 0, gone: false, error: (err as Error).message };
  }
}

/** Test/verification helper: decrypts an aes128gcm body with the subscriber's private key (the inverse of encryptPayload). */
export function decryptPayloadForTest(body: Buffer, uaPrivate: ReturnType<typeof createECDH>, authSecret: Buffer): Buffer {
  const salt = body.subarray(0, 16);
  const idLen = body[20]!;
  const asPublic = body.subarray(21, 21 + idLen);
  const ciphertext = body.subarray(21 + idLen);
  const uaPublic = uaPrivate.getPublicKey();
  const shared = uaPrivate.computeSecret(asPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const padded = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
  let end = padded.length - 1;
  while (end >= 0 && padded[end] === 0) end--;
  if (padded[end] !== 2) throw new Error("bad padding delimiter");
  return padded.subarray(0, end);
}

/** Verifies a VAPID JWT against the public key (test helper; a push service does the same). */
export function verifyVapidForTest(authorization: string, publicKey: string): { aud: string; sub: string; exp: number } {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(authorization);
  if (!m) throw new Error("not a vapid header");
  if (m[2] !== publicKey) throw new Error("k mismatch");
  const [h, p, s] = m[1]!.split(".");
  const pub = fromB64url(publicKey);
  const key = createPublicKey({ format: "jwk", key: { kty: "EC", crv: "P-256", x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33, 65)) } });
  const v = createVerify("SHA256");
  v.update(`${h}.${p}`);
  if (!v.verify({ key, dsaEncoding: "ieee-p1363" }, fromB64url(s!))) throw new Error("bad signature");
  return JSON.parse(fromB64url(p!).toString("utf8"));
}
