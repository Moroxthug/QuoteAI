import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PlayClient, PlayError, parseServiceAccount, serviceAccountAssertion } from "./client";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const SA = { client_email: "billing@quoteai.iam.gserviceaccount.com", private_key: privateKey, token_uri: "https://oauth2.example/token" };

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };
function fakeFetch(handler: (c: Call) => { status: number; json?: unknown }) {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    const call: Call = { url, method: init.method ?? "GET", headers: (init.headers ?? {}) as Record<string, string>, body: init.body as string | undefined };
    calls.push(call);
    const r = handler(call);
    return new Response(r.status === 204 ? null : JSON.stringify(r.json ?? {}), { status: r.status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}
const okToken = (c: Call) => (c.url.startsWith("https://oauth2.example") ? { status: 200, json: { access_token: "ya29.token", expires_in: 3600 } } : null);

describe("service account", () => {
  it("reads raw JSON or base64", () => {
    const raw = JSON.stringify({ client_email: "a@b.c", private_key: "-----BEGIN-----\\nabc\\n-----END-----" });
    expect(parseServiceAccount(raw)?.private_key).toBe("-----BEGIN-----\nabc\n-----END-----");
    expect(parseServiceAccount(Buffer.from(raw).toString("base64"))?.client_email).toBe("a@b.c");
    expect(parseServiceAccount("  " + raw + "  ")?.client_email).toBe("a@b.c");
  });
  it("is null when missing or broken", () => {
    expect(parseServiceAccount(undefined)).toBeNull();
    expect(parseServiceAccount("")).toBeNull();
    expect(parseServiceAccount("not json")).toBeNull();
    expect(parseServiceAccount(JSON.stringify({ client_email: "a@b.c" }))).toBeNull();
  });
  it("signs an RS256 assertion that verifies with the public key", () => {
    const jwt = serviceAccountAssertion(SA, 1_800_000_000);
    const [h, p, s] = jwt.split(".") as [string, string, string];
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(p, "base64url").toString())).toEqual({ iss: SA.client_email, scope: "https://www.googleapis.com/auth/androidpublisher", aud: SA.token_uri, iat: 1_800_000_000, exp: 1_800_003_600 });
    expect(createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });
});

describe("PlayClient", () => {
  it("gets a subscription with a bearer token, and caches the token until near expiry", async () => {
    let now = 1_800_000_000_000;
    const { fetcher, calls } = fakeFetch((c) => okToken(c) ?? { status: 200, json: { subscriptionState: "SUBSCRIPTION_STATE_ACTIVE" } });
    const client = new PlayClient({ serviceAccount: SA, packageName: "ca.quoteai.app", fetcher, now: () => now });
    expect(await client.getSubscription("tok/en+1")).toEqual({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE" });
    await client.getSubscription("tok2");
    expect(calls.filter((c) => c.url.startsWith("https://oauth2"))).toHaveLength(1);
    const api = calls.find((c) => c.url.includes("androidpublisher"))!;
    expect(api.url).toBe("https://androidpublisher.googleapis.com/androidpublisher/v3/applications/ca.quoteai.app/purchases/subscriptionsv2/tokens/tok%2Fen%2B1");
    expect(api.headers.authorization).toBe("Bearer ya29.token");
    expect(calls[0]!.body).toContain("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer");
    now += 3_600_000 - 30_000; // inside the last minute
    await client.getSubscription("tok3");
    expect(calls.filter((c) => c.url.startsWith("https://oauth2"))).toHaveLength(2);
  });
  it("acknowledges with the v1 endpoint and an empty body", async () => {
    const { fetcher, calls } = fakeFetch((c) => okToken(c) ?? { status: 204 });
    const client = new PlayClient({ serviceAccount: SA, packageName: "ca.quoteai.app", fetcher });
    await client.acknowledge("quoteai_pro", "tok123");
    const ack = calls.find((c) => c.url.includes(":acknowledge"))!;
    expect(ack.method).toBe("POST");
    expect(ack.url).toBe("https://androidpublisher.googleapis.com/androidpublisher/v3/applications/ca.quoteai.app/purchases/subscriptions/quoteai_pro/tokens/tok123:acknowledge");
    expect(ack.body).toBe("{}");
  });
  const codeOf = async (status: number) => {
    const { fetcher } = fakeFetch((c) => okToken(c) ?? { status, json: { error: { message: "x" } } });
    const client = new PlayClient({ serviceAccount: SA, packageName: "ca.quoteai.app", fetcher });
    try {
      await client.getSubscription("tok");
    } catch (e) {
      return (e as PlayError).code;
    }
    return "none";
  };
  it("maps Google's errors to our codes", async () => {
    expect(await codeOf(401)).toBe("PLAY_NOT_CONFIGURED");
    expect(await codeOf(403)).toBe("PLAY_NOT_CONFIGURED");
    expect(await codeOf(404)).toBe("PURCHASE_NOT_VALID");
    expect(await codeOf(410)).toBe("PURCHASE_NOT_VALID");
    expect(await codeOf(400)).toBe("PURCHASE_NOT_VALID");
    expect(await codeOf(500)).toBe("PLAY_UNAVAILABLE");
    expect(await codeOf(429)).toBe("PLAY_UNAVAILABLE");
  });
  it("a refused key is a configuration problem; a network failure is unavailable", async () => {
    const refused = fakeFetch(() => ({ status: 400, json: { error: "invalid_grant" } }));
    await expect(new PlayClient({ serviceAccount: SA, packageName: "p", fetcher: refused.fetcher }).getSubscription("t")).rejects.toMatchObject({ code: "PLAY_NOT_CONFIGURED" });
    const down = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await expect(new PlayClient({ serviceAccount: SA, packageName: "p", fetcher: down }).getSubscription("t")).rejects.toMatchObject({ code: "PLAY_UNAVAILABLE" });
  });
});
