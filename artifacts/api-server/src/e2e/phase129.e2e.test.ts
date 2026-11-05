// Phase 129.10 (docs/POCKET-APP-PLAN.md): the other ways into the phone app. Proven on the real server:
//  - a confirmed account signs in with an emailed code and gets a bearer token;
//  - no code is sent or accepted for an unconfirmed account, an unknown address, or an account with two-step;
//  - a code never creates an account;
//  - /sign-in/social takes only a provider's ID token, and a forged one is refused;
//  - the app can read which providers are on.
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db, authUsersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { startServer, stopServer, cleanupUsers } from "./harness.js";
import { emailsTo } from "./mailbox.js";

const APP = "https://localhost";
const PASSWORD = "E2e-App-Passw0rd!!";
let baseUrl = "";
const made: string[] = [];

async function call(path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, { method: body ? "POST" : "GET", headers: { origin: APP, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed, headers: res.headers };
}

const newEmail = (tag: string) => `e2e-p129-${tag}-${randomUUID().slice(0, 8)}@example.invalid`;
const codes = (email: string) => emailsTo(email).filter((m) => /sign-in code/.test(m.subject));
const settle = () => new Promise((r) => setTimeout(r, 300));

async function account(tag: string, set: { emailVerified?: boolean; twoFactorEnabled?: boolean }) {
  const email = newEmail(tag);
  expect((await call("/api/auth/sign-up/email", { name: "Phase 129 Person", email, password: PASSWORD })).status).toBe(200);
  const [u] = await db.select({ id: authUsersTable.id }).from(authUsersTable).where(eq(authUsersTable.email, email));
  made.push(u!.id);
  if (Object.keys(set).length) await db.update(authUsersTable).set(set).where(eq(authUsersTable.id, u!.id));
  return email;
}

describe("Phase 129.10: other ways in", () => {
  beforeAll(async () => { baseUrl = await startServer(); });
  afterAll(async () => {
    await cleanupUsers(made);
    if (made.length) await db.delete(authUsersTable).where(inArray(authUsersTable.id, made)).catch(() => undefined);
    await stopServer();
  });

  test("a confirmed account signs in with an emailed code", async () => {
    const email = await account("ok", { emailVerified: true });
    expect((await call("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" })).status).toBe(200);
    await settle();
    const code = codes(email).at(-1)?.subject.match(/\b(\d{6})\b/)?.[1];
    expect(code).toBeTruthy();
    const wrong = code === "000000" ? "000001" : "000000";
    expect((await call("/api/auth/sign-in/email-otp", { email, otp: wrong })).status).toBe(400);
    const r = await call("/api/auth/sign-in/email-otp", { email, otp: code });
    expect(r.status).toBe(200);
    expect(r.headers.get("set-auth-token")).toBeTruthy();
  });

  test("no code for an unconfirmed account, an unknown address or two-step", async () => {
    const unconfirmed = await account("new", {});
    const twoStep = await account("2fa", { emailVerified: true, twoFactorEnabled: true });
    const nobody = newEmail("nobody");
    for (const email of [unconfirmed, twoStep, nobody]) {
      expect((await call("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" })).status).toBe(200);
      expect((await call("/api/auth/sign-in/email-otp", { email, otp: "123456" })).status).toBe(400);
    }
    await settle();
    expect(codes(unconfirmed)).toHaveLength(0);
    expect(codes(twoStep)).toHaveLength(0);
    expect(emailsTo(nobody)).toHaveLength(0);
    expect(await db.select({ id: authUsersTable.id }).from(authUsersTable).where(eq(authUsersTable.email, nobody))).toHaveLength(0);
  });

  test("social sign-in takes only a real ID token", async () => {
    expect((await call("/api/auth/sign-in/social", { provider: "google" })).status).toBe(400);
    expect((await call("/api/auth/sign-in/social", { provider: "google", idToken: { token: "not-a-token" } })).status).toBeGreaterThanOrEqual(400);
  });

  test("the app can read which providers are on", async () => {
    const r = await call("/api/settings/registration");
    expect(r.status).toBe(200);
    expect(r.body.social).toEqual({ google: process.env.GOOGLE_SIGN_IN_CLIENT_ID ?? null, apple: !!process.env.APPLE_BUNDLE_ID });
  });
});
