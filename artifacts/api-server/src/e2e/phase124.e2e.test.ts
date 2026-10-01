// Phase 124 (docs/POCKET-APP-PLAN.md): the phone app's password reset. The emailed link goes
// through better-auth's /reset-password/:token?callbackURL=quoteai://forgot-password, which
// redirects to the app's deep link, and the request's redirectTo must be accepted too.
// Proven here on the real server:
//  - the app can ask for a reset with redirectTo quoteai://forgot-password;
//  - the emailed link answers with a redirect to quoteai://forgot-password?token=...;
//  - a bad token redirects to the same deep link with ?error=INVALID_TOKEN (the app's "link expired");
//  - no other quoteai:// target is trusted (checked on better-auth's own trusted-origin matcher:
//    its request-time origin check is switched off under NODE_ENV=test, so a request can't show it).
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db, authUsersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { startServer, stopServer, cleanupUsers } from "./harness.js";
import { auth } from "../lib/auth.js";
import { emailsTo, linksIn } from "./mailbox.js";

const APP = "https://localhost";
const PASSWORD = "E2e-Reset-Passw0rd!!";
const DEEP_LINK = "quoteai://forgot-password";
let baseUrl = "";
const made: string[] = [];
const settle = () => new Promise((r) => setTimeout(r, 300));

async function post(path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", origin: APP }, body: JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

beforeAll(async () => { baseUrl = await startServer(); });
afterAll(async () => {
  if (made.length) await cleanupUsers(made);
  await stopServer();
});

describe("phase 124: password reset deep link", () => {
  test("the link redirects to the app, a bad token redirects with an error, other targets are refused", async () => {
    const email = `e2e-p124-${randomUUID().slice(0, 8)}@example.invalid`;
    expect((await post("/api/auth/sign-up/email", { name: "Phase 124 Person", email, password: PASSWORD })).status).toBe(200);
    const [u] = await db.select({ id: authUsersTable.id }).from(authUsersTable).where(eq(authUsersTable.email, email));
    made.push(u!.id);
    await db.update(authUsersTable).set({ emailVerified: true }).where(inArray(authUsersTable.id, made));

    expect((await post("/api/auth/request-password-reset", { email, redirectTo: DEEP_LINK })).status).toBe(200);
    await settle();

    const link = emailsTo(email).flatMap((m) => linksIn(m)).find((l) => l.includes("/api/auth/reset-password/"));
    expect(link).toBeTruthy();
    const res = await fetch(link!.replace(/^https?:\/\/[^/]+/, baseUrl), { redirect: "manual" });
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc.startsWith(`${DEEP_LINK}?token=`)).toBe(true);

    const bad = await fetch(`${baseUrl}/api/auth/reset-password/not-a-token?callbackURL=${encodeURIComponent(DEEP_LINK)}`, { redirect: "manual" });
    expect(bad.status).toBe(302);
    expect(bad.headers.get("location")).toContain("error=INVALID_TOKEN");

  });

  test("only the one deep link is a trusted target", async () => {
    const ctx = await auth.$context;
    const trusted = (url: string) => ctx.isTrustedOrigin(url, { allowRelativePaths: true });
    expect(trusted(DEEP_LINK)).toBe(true);
    expect(trusted(`${DEEP_LINK}?token=abc`)).toBe(true);
    expect(trusted("quoteai://evil")).toBe(false);
    expect(trusted("quoteai://evil/forgot-password")).toBe(false);
    expect(trusted("quoteai:evil")).toBe(false);
    expect(trusted("myapp://forgot-password")).toBe(false);
    expect(trusted("https://evil.example/forgot-password")).toBe(false);
  });
});
