// Phase 118 (docs/APP-PLAN.md): the phone app talks to the API from its own
// origin (https://localhost on Android, capacitor://localhost on iOS) with a
// bearer token and no cookies. Proven here on the real server: the preflight
// and CORS answer the app without credentials, a sign-in hands the token back
// in an exposed header, the token alone works, a cookie from the app's origin
// counts for nothing, the acting company rides in X-Active-Org, two-step
// verification completes through the X-Auth-Cookie tunnel, and an origin that
// is not the app gets no CORS answer.
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { db, authUsersTable, organizationMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, cleanupUsers, type TestUser } from "./harness.js";

const APP = "https://localhost";
let baseUrl = "";
let owner: TestUser;
let userId = "";
const email = `e2e-app-${randomUUID()}@example.invalid`;
const password = "E2e-App-Passw0rd!!";

type Res = { status: number; body: any; headers: Headers };

async function call(path: string, opts: { method?: string; body?: unknown; origin?: string; headers?: Record<string, string> } = {}): Promise<Res> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.origin) headers.origin = opts.origin;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${baseUrl}${path}`, { method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"), headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body, headers: res.headers };
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

function exposed(h: Headers): string[] {
  return (h.get("access-control-expose-headers") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function totp(uri: string, at = Date.now()): string {
  const u = new URL(uri);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of u.searchParams.get("secret")!.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v !== -1) bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / Number(u.searchParams.get("period") ?? 30))));
  const hmac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const o = hmac[hmac.length - 1]! & 0xf;
  const code = ((hmac[o]! & 0x7f) << 24) | (hmac[o + 1]! << 16) | (hmac[o + 2]! << 8) | hmac[o + 3]!;
  return String(code % 10 ** Number(u.searchParams.get("digits") ?? 6)).padStart(6, "0");
}

beforeAll(async () => {
  baseUrl = await startServer();
  owner = await createOrg({ companyName: "E2E App Owner Co" });
  const signUp = await call("/api/auth/sign-up/email", { body: { name: "E2E App Person", email, password } });
  expect(signUp.status).toBe(200);
  const [u] = await db.select().from(authUsersTable).where(eq(authUsersTable.email, email));
  userId = u!.id;
  await db.update(authUsersTable).set({ emailVerified: true }).where(eq(authUsersTable.id, userId));
});

afterAll(async () => {
  await cleanupUsers([userId, owner?.userId].filter(Boolean));
  await stopServer();
});

describe("the phone app's origin", () => {
  test("preflight is answered for the app, without credentials", async () => {
    const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "OPTIONS",
      headers: { origin: APP, "access-control-request-method": "POST", "access-control-request-headers": "content-type,authorization,x-active-org" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(APP);
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    expect(res.headers.get("access-control-allow-headers")).toContain("authorization");
    for (const ios of ["capacitor://localhost"]) {
      const r = await fetch(`${baseUrl}/api/jobs`, { method: "OPTIONS", headers: { origin: ios, "access-control-request-method": "GET" } });
      expect(r.headers.get("access-control-allow-origin")).toBe(ios);
    }
  });

  test("sign-in hands the token back in an exposed header; the token alone is the session", async () => {
    const signIn = await call("/api/auth/sign-in/email", { origin: APP, body: { email, password } });
    expect(signIn.status).toBe(200);
    const token = signIn.headers.get("set-auth-token");
    expect(token).toBeTruthy();
    expect(signIn.headers.get("access-control-allow-origin")).toBe(APP);
    expect(signIn.headers.get("access-control-allow-credentials")).toBeNull();
    expect(exposed(signIn.headers)).toEqual(expect.arrayContaining(["set-auth-token", "x-active-org", "x-auth-cookie"]));

    const me = await call("/api/auth/get-session", { origin: APP, headers: bearer(token!) });
    expect(me.body?.user?.id).toBe(userId);
    const api = await call("/api/business-profile", { origin: APP, headers: bearer(token!) });
    expect(api.status).not.toBe(401);
    expect(api.headers.get("access-control-allow-origin")).toBe(APP);
  });

  test("a cookie sent from the app's origin counts for nothing", async () => {
    const web = await fetch(`${baseUrl}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    expect(web.status).toBe(200);
    const cookie = web.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    expect(cookie).toContain("session_token");
    const asWeb = await call("/api/auth/get-session", { headers: { cookie } });
    expect(asWeb.body?.user?.id).toBe(userId);
    const asApp = await call("/api/auth/get-session", { origin: APP, headers: { cookie } });
    expect(asApp.body ?? null).toBeNull();
    expect((await call("/api/business-profile", { origin: APP, headers: { cookie } })).status).toBe(401);
  });

  test("an origin that is not the app (or the site) gets no CORS answer", async () => {
    // (better-auth's own Origin check is off under NODE_ENV=test, so what is
    // proven here is the browser-side wall: no Allow-Origin, nothing readable.)
    const res = await call("/api/auth/sign-in/email", { origin: "https://evil.example", body: { email, password } });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    const pre = await fetch(`${baseUrl}/api/jobs`, { method: "OPTIONS", headers: { origin: "https://evil.example", "access-control-request-method": "GET" } });
    expect(pre.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("the acting company travels in X-Active-Org", () => {
  test("switching answers with the header; sending it acts as that company; a company you're not in is ignored", async () => {
    await db.insert(organizationMembersTable).values({ ownerId: owner.userId, userId, invitedEmail: email, invitedByUserId: owner.userId, role: "office", status: "active", joinedAt: new Date() });
    const signIn = await call("/api/auth/sign-in/email", { origin: APP, body: { email, password } });
    const token = signIn.headers.get("set-auth-token")!;

    const sw = await call("/api/team/switch", { origin: APP, headers: bearer(token), body: { orgId: owner.userId } });
    expect(sw.status).toBe(200);
    expect(sw.headers.get("x-active-org")).toBe(owner.userId);

    const asMember = await call("/api/business-profile", { origin: APP, headers: { ...bearer(token), "x-active-org": owner.userId } });
    expect(asMember.status).toBe(200);
    expect(asMember.body?.companyName).toBe("E2E App Owner Co");

    const stranger = await createOrg({ companyName: "E2E Not Yours Co" });
    try {
      const forged = await call("/api/business-profile", { origin: APP, headers: { ...bearer(token), "x-active-org": stranger.userId } });
      expect(forged.body?.companyName ?? null).not.toBe("E2E Not Yours Co");
    } finally {
      await cleanupUsers([stranger.userId]);
    }
  });
});

describe("two-step verification from the app", () => {
  test("the half-signed-in cookie travels in X-Auth-Cookie; the code completes the sign-in", async () => {
    const first = await call("/api/auth/sign-in/email", { origin: APP, body: { email, password } });
    const token = first.headers.get("set-auth-token")!;
    const enable = await call("/api/auth/two-factor/enable", { origin: APP, headers: bearer(token), body: { password, issuer: "QuoteAI" } });
    expect(enable.status).toBe(200);
    const uri: string = enable.body.totpURI;
    expect((await call("/api/auth/two-factor/verify-totp", { origin: APP, headers: bearer(token), body: { code: totp(uri) } })).status).toBe(200);

    const half = await call("/api/auth/sign-in/email", { origin: APP, body: { email, password } });
    expect(half.status).toBe(200);
    expect(half.body?.twoFactorRedirect).toBe(true);
    const carried = half.headers.get("x-auth-cookie");
    expect(carried).toMatch(/better-auth\.two_factor=/);
    expect(carried).not.toMatch(/session_token/);
    if (half.headers.get("set-auth-token")) {
      const peek = await call("/api/auth/get-session", { origin: APP, headers: bearer(half.headers.get("set-auth-token")!) });
      expect(peek.body ?? null, "a password alone must not be a session").toBeNull();
    }

    // Without the carried cookie the code has nothing to complete.
    expect((await call("/api/auth/two-factor/verify-totp", { origin: APP, body: { code: totp(uri) } })).status).toBeGreaterThanOrEqual(400);
    // A session cookie smuggled through the tunnel is dropped.
    const smuggled = await call("/api/auth/get-session", { origin: APP, headers: { "x-auth-cookie": `better-auth.session_token=${token}` } });
    expect(smuggled.body ?? null).toBeNull();

    const done = await call("/api/auth/two-factor/verify-totp", { origin: APP, headers: { "x-auth-cookie": carried! }, body: { code: totp(uri) } });
    expect(done.status).toBe(200);
    const session = done.headers.get("set-auth-token");
    expect(session).toBeTruthy();
    const me = await call("/api/auth/get-session", { origin: APP, headers: bearer(session!) });
    expect(me.body?.user?.id).toBe(userId);
  });
});
