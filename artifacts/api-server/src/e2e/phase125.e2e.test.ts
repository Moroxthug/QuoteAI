// Phase 125 (docs/POCKET-APP-PLAN.md): what the phone's Quotes list and Clients screens need from the server.
//  - GET /api/quotes returns the quote number, validDays, firstViewedAt and declinedAt;
//  - opening the public quote page records firstViewedAt (not for the app's own preview);
//  - a client can decline a sent quote (with or without a reason): recorded, follow-ups stopped,
//    the company notified, idempotent; a draft is not found; an accepted quote answers 409;
//  - sending the quote again clears the decline;
//  - (125.6) POST /api/invoices/:id/receipt emails the latest payment's receipt, and only when there is a payment.
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, quotesTable, clientsTable, invoicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { startServer, stopServer, createOrg, seedQuote, cleanupUsers, api, type TestUser } from "./harness.js";
import { emailsTo } from "./mailbox.js";

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

describe("phase 125: clients overview", () => {
  test("a client carries what they bought, owe and did last; detail joins quotes and invoices; edits stick", async () => {
    const [c] = await db.insert(clientsTable).values({ userId: org.userId, name: "Tom & Lena Hart", email: "lena@example.invalid", phone: "4165550148", address: "48 Galloway Rd", city: "Scarborough", province: "ON", dedupKey: `tom & lena hart|lena@example.invalid|${randomUUID()}` }).returning();
    const q = await seedQuote(org.userId, { status: "accepted", clientName: "Tom & Lena Hart" });
    await db.update(quotesTable).set({ clientId: c!.id, acceptedAt: new Date(Date.now() - 2 * 86_400_000) }).where(eq(quotesTable.id, q.id));
    await db.insert(invoicesTable).values({
      userId: org.userId, number: "INV-P125-1", type: "progress", status: "overdue", province: "ON", clientId: c!.id, issueDate: new Date(Date.now() - 30 * 86_400_000), dueDate: new Date(Date.now() - 9 * 86_400_000),
      contractor: { name: "Co" }, customer: { name: "Tom & Lena Hart", email: "lena@example.invalid" }, lines: [], subtotalCents: 200_000, taxableCents: 200_000, taxCents: 26_000, totalCents: 226_000, sentAt: new Date(Date.now() - 30 * 86_400_000),
    });

    const list = await org.api("/api/clients/overview");
    expect(list.status).toBe(200);
    const row = list.body.items.find((r: { id: string }) => r.id === c!.id);
    expect(row).toMatchObject({ name: "Tom & Lena Hart", status: "active", overdueCount: 1, owedCents: 226_000 });
    expect(row.lifetimeCents).toBeGreaterThan(0);
    expect(list.body.stats.total).toBeGreaterThanOrEqual(1);

    const detail = await org.api(`/api/clients/${c!.id}/overview`);
    expect(detail.status).toBe(200);
    expect(detail.body.quotes.map((x: { id: string }) => x.id)).toContain(q.id);
    expect(detail.body.invoices[0]).toMatchObject({ number: "INV-P125-1", daysLate: 9 });
    expect(detail.body.worstOverdue).toMatchObject({ number: "INV-P125-1", canRemind: true });

    const put = await org.api(`/api/clients/${c!.id}/details`, { method: "PUT", body: { notes: "Use the side door.", phone: "4165550199" } });
    expect(put.status).toBe(200);
    expect(put.body.client.notes).toBe("Use the side door.");
    expect(put.body.client.phone).toBe("4165550199");
    expect((await org.api(`/api/clients/${c!.id}/details`, { method: "PUT", body: { email: "not-an-email" } })).status).toBe(400);
  });

  test("adding a client does not add the same person twice", async () => {
    const body = { name: "Jordan Leblanc", email: "jordan@example.invalid", phone: "4165550100", address: "4 Main St", city: "Toronto", province: "ON" };
    const first = await org.api("/api/clients", { method: "POST", body });
    expect(first.status).toBe(201);
    expect(first.body.client).toMatchObject({ name: "Jordan Leblanc", status: "prospect", quoteCount: 0 });
    const again = await org.api("/api/clients", { method: "POST", body });
    expect(again.status).toBe(200);
    expect(again.body.client.id).toBe(first.body.client.id);
    expect((await org.api("/api/clients", { method: "POST", body: { email: "x@y.ca" } })).status).toBe(400);
    expect((await org.api("/api/clients", { method: "POST", body: { name: "Bad", email: "nope" } })).status).toBe(400);
  });

  test("another company's client is not found, and a bad id is a 404", async () => {
    const other = await createOrg();
    try {
      const [oc] = await db.insert(clientsTable).values({ userId: other.userId, name: "Not Yours", dedupKey: `not yours||${randomUUID()}` }).returning();
      expect((await org.api(`/api/clients/${oc!.id}/overview`)).status).toBe(404);
      expect((await org.api(`/api/clients/${oc!.id}/details`, { method: "PUT", body: { notes: "x" } })).status).toBe(404);
      expect((await org.api("/api/clients/not-an-id/overview")).status).toBe(404);
    } finally {
      await cleanupUsers([other.userId]);
    }
  });
});

describe("phase 125: Not included and the recommended option", () => {
  test("exclusions are saved on the quote, reach the client page, and are trimmed and limited", async () => {
    const q = await seedQuote(org.userId, { status: "unlocked" });
    const put = await org.api(`/api/quotes/${q.id}`, { method: "PUT", body: { exclusions: ["  Moving appliances  ", "Electrical past cover plates"] } });
    expect(put.status).toBe(200);
    expect(put.body.exclusions).toEqual(["Moving appliances", "Electrical past cover plates"]);
    expect((await org.api(`/api/quotes/${q.id}`)).body.exclusions).toHaveLength(2);
    expect((await publicGet(`/api/public/quotes/${q.id}?preview=1`)).body.quote.exclusions).toEqual(["Moving appliances", "Electrical past cover plates"]);
    expect((await org.api(`/api/quotes/${q.id}`, { method: "PUT", body: { exclusions: ["x".repeat(301)] } })).status).toBe(400);
    expect((await org.api(`/api/quotes/${q.id}`, { method: "PUT", body: { exclusions: [] } })).body.exclusions).toEqual([]);
  });

  test("only one option is recommended at a time", async () => {
    const q = await seedQuote(org.userId, { status: "unlocked" });
    const a = await org.api(`/api/quotes/${q.id}/variants`, { method: "POST", body: { label: "Good" } });
    const b = await org.api(`/api/quotes/${q.id}/variants`, { method: "POST", body: { label: "Better" } });
    expect(a.status).toBe(201);
    expect(a.body.recommended).toBe(false);
    expect((await org.api(`/api/quotes/${q.id}/variants/${b.body.id}`, { method: "PUT", body: { recommended: true } })).body.recommended).toBe(true);
    await org.api(`/api/quotes/${q.id}/variants/${a.body.id}`, { method: "PUT", body: { recommended: true } });
    const list = (await org.api(`/api/quotes/${q.id}/variants`)).body.variants as { label: string; recommended: boolean }[];
    expect(list.filter((v) => v.recommended).map((v) => v.label)).toEqual(["Good"]);
    const pub = (await publicGet(`/api/public/quotes/${q.id}?preview=1`)).body.quote.variants as { label: string; recommended: boolean }[];
    expect(pub.find((v) => v.label === "Good")?.recommended).toBe(true);
  });
});

describe("phase 125.6: the phone's Send receipt", () => {
  test("a receipt goes for the latest payment, once there is one; another company's invoice is not found", async () => {
    const address = `e2e-p1256-${randomUUID().slice(0, 8)}@example.invalid`;
    const [c] = await db.insert(clientsTable).values({ userId: org.userId, name: "Receipt Client", email: address, preferredLanguage: "en", dedupKey: `p1256-${randomUUID()}` }).returning();
    const created = await org.api("/api/invoices", { body: { clientId: c!.id, lines: [{ description: "Deck boards", quantity: 1, unitCents: 100_000 }], dueDays: 15 } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.invoice.id as string;
    expect((await org.api(`/api/invoices/${id}/send`, { body: {} })).status).toBe(200);

    // no payment yet: nothing to send a receipt for
    const none = await org.api(`/api/invoices/${id}/receipt`, { body: {} });
    expect(none.status).toBe(400);
    expect(none.body.error).toBe("NO_PAYMENT");

    const paid = await org.api(`/api/invoices/${id}/payments`, { body: { amountCents: 40_000, method: "cash", sendReceipt: false } });
    expect(paid.status, JSON.stringify(paid.body)).toBe(201);
    const before = emailsTo(address).length;
    const ok = await org.api(`/api/invoices/${id}/receipt`, { body: {} });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    await expect.poll(() => emailsTo(address).length).toBe(before + 1);
    expect(emailsTo(address).at(-1)!.subject).toContain("Receipt");
    const events = (await org.api(`/api/invoices/${id}`)).body.events as { type: string }[];
    expect(events.some((e) => e.type === "receipt_sent")).toBe(true);

    const other = await createOrg();
    try {
      expect((await other.api(`/api/invoices/${id}/receipt`, { body: {} })).status).toBe(404);
    } finally {
      await cleanupUsers([other.userId]);
    }
  });
});
