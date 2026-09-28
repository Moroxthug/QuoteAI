// Phase 121 (docs/APP-PLAN.md): a new account made in the phone app confirms
// its address with a 6-digit code typed in the app — a confirmation link would
// open the browser and sign the person in there, leaving the app signed out.
// Proven here on the real server:
//  - a sign-up from the app's origin sends no link email; the app asks for a
//    code, a wrong code is refused, the right one signs the person in with a
//    bearer token (the app's session) and confirms the address;
//  - a sign-up from the website still gets the link, as before;
//  - a sign-in from the app with an unconfirmed address sends no link either;
//  - codes only ever confirm an unconfirmed address: for a confirmed one
//    nothing is sent and no code is accepted (it would be a way in with the
//    inbox alone — no password, no second factor);
//  - the other email-code endpoints of the plugin are not served.
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db, authUsersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { startServer, stopServer, cleanupUsers } from "./harness.js";
import { emailsTo, linksIn } from "./mailbox.js";

const APP = "https://localhost";
const PASSWORD = "E2e-App-Passw0rd!!";
let baseUrl = "";
const made: string[] = [];

type Res = { status: number; body: any; headers: Headers };

async function call(path: string, opts: { body?: unknown; origin?: string; headers?: Record<string, string> } = {}): Promise<Res> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.origin) headers.origin = opts.origin;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${baseUrl}${path}`, { method: opts.body !== undefined ? "POST" : "GET", headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body, headers: res.headers };
}

const newEmail = (tag: string) => `e2e-p121-${tag}-${randomUUID().slice(0, 8)}@example.invalid`;
const linkMails = (email: string) => emailsTo(email).filter((m) => linksIn(m).some((l) => l.includes("/api/auth/verify-email")));
const codeMails = (email: string) => emailsTo(email).filter((m) => /\b\d{6}\b/.test(m.subject));
const codeIn = (email: string) => codeMails(email).at(-1)?.subject.match(/\b(\d{6})\b/)?.[1] ?? null;
const settle = () => new Promise((r) => setTimeout(r, 300));

async function signUp(email: string, origin?: string) {
  const r = await call("/api/auth/sign-up/email", { origin, body: { name: "Phase 121 Person", email, password: PASSWORD, callbackURL: "/onboarding" } });
  expect(r.status).toBe(200);
  const [u] = await db.select({ id: authUsersTable.id }).from(authUsersTable).where(eq(authUsersTable.email, email));
  made.push(u!.id);
  await settle();
}

async function verified(email: string): Promise<boolean> {
  const [u] = await db.select({ v: authUsersTable.emailVerified }).from(authUsersTable).where(eq(authUsersTable.email, email));
  return !!u?.v;
}

beforeAll(async () => {
  baseUrl = await startServer();
});

afterAll(async () => {
  await cleanupUsers(made);
  if (made.length) await db.delete(authUsersTable).where(inArray(authUsersTable.id, made)).catch(() => undefined);
  await stopServer();
});

describe("confirming a new address in the phone app", () => {
  test("app sign-up: no link, a code; a wrong code refused, the right one signs in with a bearer token", async () => {
    const email = newEmail("app");
    await signUp(email, APP);
    expect(linkMails(email)).toHaveLength(0);

    const send = await call("/api/auth/email-otp/send-verification-otp", { origin: APP, body: { email, type: "email-verification" } });
    expect(send.status).toBe(200);
    await settle();
    const code = codeIn(email);
    expect(code).toMatch(/^\d{6}$/);
    const mail = codeMails(email).at(-1)!;
    expect(mail.html).toContain(code);
    expect(linksIn(mail).some((l) => l.includes("verify-email"))).toBe(false);

    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
    const bad = await call("/api/auth/email-otp/verify-email", { origin: APP, body: { email, otp: wrong } });
    expect(bad.status).toBe(400);
    expect(bad.headers.get("set-auth-token")).toBeNull();
    expect(await verified(email)).toBe(false);

    const ok = await call("/api/auth/email-otp/verify-email", { origin: APP, body: { email, otp: code } });
    expect(ok.status).toBe(200);
    const token = ok.headers.get("set-auth-token");
    expect(token).toBeTruthy();
    expect(await verified(email)).toBe(true);
    const me = await call("/api/auth/get-session", { origin: APP, headers: { authorization: `Bearer ${token}` } });
    expect(me.body?.user?.email).toBe(email);

    // Used once: the same code does nothing now.
    const again = await call("/api/auth/email-otp/verify-email", { origin: APP, body: { email, otp: code } });
    expect(again.status).toBe(400);
  });

  test("website sign-up still gets the confirmation link", async () => {
    const email = newEmail("web");
    await signUp(email);
    expect(linkMails(email)).toHaveLength(1);
  });

  test("app sign-in with an unconfirmed address sends no link (the app asks for a code)", async () => {
    const email = newEmail("signin");
    await signUp(email, APP);
    const r = await call("/api/auth/sign-in/email", { origin: APP, body: { email, password: PASSWORD } });
    expect(r.status).toBe(403);
    await settle();
    expect(linkMails(email)).toHaveLength(0);
    // The same from the website still resends the link (sendOnSignIn).
    await call("/api/auth/sign-in/email", { body: { email, password: PASSWORD } });
    await settle();
    expect(linkMails(email)).toHaveLength(1);
  });

  test("a confirmed address: no code is sent, and no code is accepted", async () => {
    const email = newEmail("confirmed");
    await signUp(email);
    await db.update(authUsersTable).set({ emailVerified: true }).where(eq(authUsersTable.email, email));
    const before = emailsTo(email).length;

    const send = await call("/api/auth/email-otp/send-verification-otp", { origin: APP, body: { email, type: "email-verification" } });
    expect(send.status).toBe(200);
    await settle();
    expect(emailsTo(email).length).toBe(before);

    for (const otp of ["000000", "123456"]) {
      const r = await call("/api/auth/email-otp/verify-email", { origin: APP, body: { email, otp } });
      expect(r.status).toBe(400);
      expect(r.headers.get("set-auth-token")).toBeNull();
    }
  });

  test("codes of other kinds are never sent, and an unknown address gets nothing", async () => {
    const email = newEmail("kinds");
    await signUp(email, APP);
    for (const type of ["sign-in", "forget-password"]) {
      const r = await call("/api/auth/email-otp/send-verification-otp", { origin: APP, body: { email, type } });
      expect(r.status).toBe(200);
    }
    const nobody = newEmail("nobody");
    expect((await call("/api/auth/email-otp/send-verification-otp", { origin: APP, body: { email: nobody, type: "email-verification" } })).status).toBe(200);
    await settle();
    expect(codeMails(email)).toHaveLength(0);
    expect(emailsTo(nobody)).toHaveLength(0);
  });

  test("the plugin's other endpoints are not served", async () => {
    for (const path of ["/api/auth/sign-in/email-otp", "/api/auth/forget-password/email-otp", "/api/auth/email-otp/reset-password", "/api/auth/email-otp/check-verification-otp", "/api/auth/email-otp/request-password-reset", "/api/auth/email-otp/change-email", "/api/auth/email-otp/request-email-change"]) {
      const r = await call(path, { origin: APP, body: { email: "x@example.invalid", otp: "000000", type: "sign-in" } });
      expect(r.status, path).toBe(404);
    }
  });
});
