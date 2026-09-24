// Phase 95 — who sent it, who won it.
//  1. Emailing a quote stamps the person who sent it, once: a later send by
//     someone else doesn't move the credit.
//  2. An accepted quote is won by whoever sent it; one that never went out
//     from the app is won by whoever made it.
//  3. Sending an invoice stamps the sender; a scheduled send stamps nobody and
//     the invoice stays with the person who drew it up.
//  4. Each person's numbers (/api/me/stats) count made, sent and won that way.
//  5. The team leaderboard: everyone in the company, for owners and admins
//     only, nothing from another company.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, clientsTable, invoicesTable, quotesTable } from "@workspace/db";
import { startServer, stopServer, createOrg, createUser, cleanupAll, api, type TestUser } from "./harness.js";
import { sendInvoice } from "../invoices/service.js";

const asOrg = (user: TestUser, orgId: string) => (path: string, opts: Parameters<TestUser["api"]>[1] = {}) => user.api(path, { ...opts, headers: { ...(opts.headers ?? {}), cookie: `qai_active_org=${orgId}` } });

type Stats = { quotes: { created: number; sent: number; won: number; winRate: number | null }; invoices: { issued: number; invoicedCents: number }; series: { sent: number; won: number }[] };
type Board = { days: number; rows: { userId: string; role: string; sent: number; won: number; winRate: number | null; invoicedCents: number }[] };

describe("Phase 95 — sent by, won by, and the team leaderboard", () => {
  let owner: TestUser;
  let outsider: TestUser;
  let sam: TestUser; // makes quotes
  let alex: TestUser; // sends them
  let asSam: ReturnType<typeof asOrg>;
  let asAlex: ReturnType<typeof asOrg>;
  let clientId: string;

  const manualQuote = async (as: ReturnType<typeof asOrg> | TestUser["api"], nome: string) => {
    const res = await as("/api/quotes/manual", { body: { capitoli: [{ lettera: "A", titolo: "Paint", subtotale: 0, voci: [{ descrizione: "Walls", um: "sqft", quantita: 100, prezzoUnitario: 3, totale: 0 }] }], clientData: { nome, indirizzo: "1 Main St" } } });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return (res.body.id ?? res.body.quote?.id) as string;
  };
  const row = async (id: string) => (await db.select().from(quotesTable).where(eq(quotesTable.id, id)))[0]!;

  beforeAll(async () => {
    await startServer();
    owner = await createOrg({ companyName: "Credit Test Painting", plan: "monthly_elite" });
    outsider = await createOrg({ companyName: "Someone Else Ltd" });
    const codes = await owner.api("/api/team/members/codes", { body: { count: 2, role: "office" } });
    expect(codes.status, JSON.stringify(codes.body)).toBe(201);
    const [c1, c2] = codes.body.codes as { code: string }[];
    sam = await createUser({ name: "Sam Maker", email: "e2e-p95-sam@example.invalid" });
    alex = await createUser({ name: "Alex Sender", email: "e2e-p95-alex@example.invalid" });
    expect((await sam.api(`/api/team/code/${c1!.code}/redeem`, { method: "POST" })).status).toBe(200);
    expect((await alex.api(`/api/team/code/${c2!.code}/redeem`, { method: "POST" })).status).toBe(200);
    asSam = asOrg(sam, owner.userId);
    asAlex = asOrg(alex, owner.userId);
    const [client] = await db
      .insert(clientsTable)
      .values({ userId: owner.userId, name: "Pat Client", email: "e2e-p95-pat@example.invalid", preferredLanguage: "en", dedupKey: `p95-${Math.random().toString(36).slice(2)}-${owner.userId}` })
      .returning();
    clientId = client!.id;
  });

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("a quote is credited to the first person who sent it", async () => {
    // Sam makes it, Alex sends it, the owner sends it again: Alex keeps the credit.
    const q1 = await manualQuote(asSam, "Won Via Alex");
    expect((await asAlex(`/api/quotes/${q1}/send-pdf-email`, { body: { toEmail: "e2e-p95-pat@example.invalid", clientName: "Pat" } })).status).toBe(200);
    expect(await row(q1)).toMatchObject({ createdByUserId: sam.userId, sentByUserId: alex.userId });
    expect((await owner.api(`/api/quotes/${q1}/send-pdf-email`, { body: { toEmail: "e2e-p95-pat@example.invalid" } })).status).toBe(200);
    expect((await row(q1)).sentByUserId).toBe(alex.userId);
    const accepted = await api(`/api/public/quotes/${q1}/accept`, { method: "POST", body: { nomeConferma: "Pat Client" } });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);

    // Sam makes and sends one that isn't accepted.
    const q2 = await manualQuote(asSam, "Still Out");
    expect((await asSam(`/api/quotes/${q2}/send-pdf-email`, { body: { toEmail: "e2e-p95-pat@example.invalid" } })).status).toBe(200);
    expect((await row(q2)).sentByUserId).toBe(sam.userId);

    // The owner makes one that never goes out from the app and is accepted (signed on the spot).
    const q3 = await manualQuote(owner.api, "Signed On Site");
    await db.update(quotesTable).set({ status: "accepted", acceptedAt: new Date() }).where(eq(quotesTable.id, q3));
    expect((await row(q3)).sentByUserId).toBeNull();
  });

  test("an invoice is credited to whoever sent it, or its maker when a schedule sent it", async () => {
    const created = await asSam("/api/invoices", { body: { clientId, lines: [{ description: "Deck boards", quantity: 1, unitCents: 100_000 }], dueDays: 15 } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const byHand = created.body.invoice.id as string;
    expect((await asAlex(`/api/invoices/${byHand}/send`, { body: {} })).status).toBe(200);
    const [sentRow] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, byHand));
    expect(sentRow).toMatchObject({ createdByUserId: sam.userId, sentByUserId: alex.userId, status: "sent" });

    const scheduled = await asSam("/api/invoices", { body: { clientId, lines: [{ description: "Railing", quantity: 1, unitCents: 50_000 }], dueDays: 15 } });
    const schedId = scheduled.body.invoice.id as string;
    await sendInvoice({ invoiceId: schedId, actor: "system" });
    const [schedRow] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, schedId));
    expect(schedRow).toMatchObject({ createdByUserId: sam.userId, sentByUserId: null, status: "sent" });
  });

  test("each person's numbers: made, sent, won", async () => {
    const samStats = (await asSam("/api/me/stats")).body as Stats;
    expect(samStats.quotes).toMatchObject({ created: 2, sent: 1, won: 0 });
    expect(samStats.invoices.issued).toBe(1); // the scheduled one stays with Sam
    expect(samStats.series.reduce((n, m) => n + m.sent, 0)).toBe(1);

    const alexStats = (await asAlex("/api/me/stats")).body as Stats;
    expect(alexStats.quotes).toMatchObject({ created: 0, sent: 1, won: 1, winRate: 100 });
    expect(alexStats.invoices).toMatchObject({ issued: 1 });
    expect(alexStats.invoices.invoicedCents).toBeGreaterThanOrEqual(100_000);
    expect(alexStats.series.reduce((n, m) => n + m.won, 0)).toBe(1);

    const ownerStats = (await owner.api("/api/me/stats")).body as Stats;
    expect(ownerStats.quotes).toMatchObject({ created: 1, sent: 0, won: 1 });

    // The teammate page reads the same numbers.
    const seen = await owner.api(`/api/team/people/${alex.userId}`);
    expect(seen.body.stats.quotes).toMatchObject({ sent: 1, won: 1 });
  });

  test("the team leaderboard: everyone in the company, for the people who run it", async () => {
    const board = await owner.api("/api/team/leaderboard");
    expect(board.status, JSON.stringify(board.body)).toBe(200);
    const b = board.body as Board;
    expect(b.days).toBe(90);
    expect(b.rows.map((r) => r.userId).sort()).toEqual([owner.userId, sam.userId, alex.userId].sort());
    const by = (id: string) => b.rows.find((r) => r.userId === id)!;
    expect(by(alex.userId)).toMatchObject({ role: "office", sent: 1, won: 1, winRate: 100 });
    expect(by(alex.userId).invoicedCents).toBeGreaterThanOrEqual(100_000);
    expect(by(sam.userId)).toMatchObject({ sent: 1, won: 0, winRate: null });
    expect(by(sam.userId).invoicedCents).toBeGreaterThanOrEqual(50_000);
    expect(by(owner.userId)).toMatchObject({ role: "owner", sent: 0, won: 1 });
    // Sorted by wins, then invoiced.
    expect(b.rows[0]!.won).toBe(1);

    // An office member can't open it; another company sees only itself.
    expect((await asSam("/api/team/leaderboard")).status).toBe(403);
    const theirs = (await outsider.api("/api/team/leaderboard")).body as Board;
    expect(theirs.rows.map((r) => r.userId)).toEqual([outsider.userId]);
  });
});
