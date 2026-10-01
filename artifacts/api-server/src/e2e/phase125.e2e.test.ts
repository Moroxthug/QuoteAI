// Phase 125 (docs/POCKET-APP-PLAN.md): what the phone's Quotes list needs from the server.
//  - GET /api/quotes returns the quote number, validDays, firstViewedAt and declinedAt;
//  - opening the public quote page records firstViewedAt (not for the app's own preview);
//  - a client can decline a sent quote (with or without a reason): recorded, follow-ups stopped,
//    the company notified, idempotent; a draft is not found; an accepted quote answers 409;
//  - sending the quote again clears the decline.
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, quotesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, seedQuote, cleanupUsers, api, type TestUser } from "./harness.js";

let org: TestUser;
let baseUrl = "";

const publicPost = (path: string, body: unknown) =>
  fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const publicGet = (path: string) => fetch(`${baseUrl}${path}`).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const row = async (id: string) => (await db.select().from(quotesTable).where(eq(quotesTable.id, id)))[0]!;
const listed = async (id: string) => (await org.api("/api/quotes")).body.find((q: { id: string }) => q.id === id);

beforeAll(async () => {
  baseUrl = await startServer();
  org = await createOrg();
});
afterAll(async () => {
  await cleanupUsers([org.userId]);
  await stopServer();
});

describe("phase 125: quote list fields and decline", () => {
  test("the list carries the number, validity, viewed and declined", async () => {
    const q = await seedQuote(org.userId, { status: "unlocked" });
    await db.update(quotesTable).set({ numeroPreventivoData: "Q-2026-125", validDays: 14, sentAt: new Date() }).where(eq(quotesTable.id, q.id));
    const item = await listed(q.id);
    expect(item.numeroPreventivoData).toBe("Q-2026-125");
    expect(item.validDays).toBe(14);
    expect(item.firstViewedAt).toBeNull();
    expect(item.declinedAt).toBeNull();
  });

  test("opening the page records the first view, the app's preview does not", async () => {
    const q = await seedQuote(org.userId, { status: "unlocked" });
    expect((await publicGet(`/api/public/quotes/${q.id}?preview=1`)).status).toBe(200);
    expect((await listed(q.id)).firstViewedAt).toBeNull();
    expect((await publicGet(`/api/public/quotes/${q.id}`)).status).toBe(200);
    expect((await listed(q.id)).firstViewedAt).not.toBeNull();
  });

  test("declining records it, stops follow-ups, and is idempotent", async () => {
    const q = await seedQuote(org.userId, { status: "unlocked" });
    await db.update(quotesTable).set({ sentAt: new Date(), nextFollowUpAt: new Date(Date.now() + 86_400_000) }).where(eq(quotesTable.id, q.id));
    const res = await publicPost(`/api/public/quotes/${q.id}/decline`, { reason: "  Price is too high this season  " });
    expect(res.status).toBe(200);
    expect(res.body.quote.declinedAt).toBeTruthy();
    const after = await row(q.id);
    expect(after.declinedReason).toBe("Price is too high this season");
    expect(after.nextFollowUpAt).toBeNull();
    expect((await listed(q.id)).declinedAt).toBeTruthy();

    const first = after.declinedAt!.getTime();
    expect((await publicPost(`/api/public/quotes/${q.id}/decline`, { reason: "again" })).status).toBe(200);
    const again = await row(q.id);
    expect(again.declinedAt!.getTime()).toBe(first);
    expect(again.declinedReason).toBe("Price is too high this season");
  });

  test("a reason is optional and has a limit", async () => {
    const q = await seedQuote(org.userId, { status: "unlocked" });
    expect((await publicPost(`/api/public/quotes/${q.id}/decline`, { reason: "x".repeat(501) })).status).toBe(400);
    expect((await publicPost(`/api/public/quotes/${q.id}/decline`, {})).status).toBe(200);
    expect((await row(q.id)).declinedReason).toBeNull();
  });

  test("a draft is not found and an accepted quote cannot be declined", async () => {
    const draft = await seedQuote(org.userId, { status: "draft" });
    expect((await publicPost(`/api/public/quotes/${draft.id}/decline`, {})).status).toBe(404);
    const accepted = await seedQuote(org.userId, { status: "accepted" });
    expect((await publicPost(`/api/public/quotes/${accepted.id}/decline`, {})).status).toBe(409);
    expect((await row(accepted.id)).declinedAt).toBeNull();
  });

  test("the company is told", async () => {
    const q = await seedQuote(org.userId, { status: "unlocked", clientName: "Marchetti Bakery" });
    await publicPost(`/api/public/quotes/${q.id}/decline`, { reason: "Too high" });
    await new Promise((r) => setTimeout(r, 300));
    const list = await api("/api/notifications", { token: org.token });
    const items: { type: string; title: string }[] = list.body?.items ?? list.body ?? [];
    expect(items.some((n) => n.type === "quote_declined" && n.title.includes("Marchetti Bakery"))).toBe(true);
  });
});
