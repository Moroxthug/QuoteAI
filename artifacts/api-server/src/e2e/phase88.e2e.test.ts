// Phase 88 — accounting, both directions.
//  1. QuickBooks follows an invoice through its life (sent → Invoice with the
//     mapped tax code, payment → Payment, removed → deleted, void → voided),
//     customers and vendors are matched once and reused, and payments recorded
//     in QuickBooks come back — once, never looped back, never over the balance.
//  2. Bank lines match costs (money out) and payments (money in), each thing
//     at most once, and a deposit can record the payment it is.
//  3. A crew's materials claim merges into the receipt that proves it.
//  4. The month-end close counts what is unfinished and notices what turned
//     up after the month was closed.
//  5. T5018 counts a subcontractor on the day the bank says they were paid.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  db,
  accountingLinksTable,
  clientsTable,
  costEntriesTable,
  fieldReportsTable,
  flinksConnectionsTable,
  flinksTransactionsTable,
  invoicePaymentsTable,
  invoicesTable,
  projectsTable,
  quickbooksConnectionsTable,
  quickbooksSyncLogTable,
  suppliersTable,
  uploadedDocumentsTable,
} from "@workspace/db";
import "../automations/index.js";
import { encryptSecret } from "../lib/crypto.js";
import { autoMatchLine } from "../books/reconcile.js";
import { runQuickbooksPaymentPull } from "../quickbooks/maintenance.js";
import { startServer, stopServer, createOrg, createUser, cleanupAll, daysFromNow, type TestUser } from "./harness.js";
import { stubHost, unstubHost, requestsTo, resetRecorded, json, type StubbedRequest } from "./vendorStub.js";

const QBO = "https://sandbox-quickbooks.api.intuit.com/";
const at = (day: string) => new Date(`${day}T12:00:00Z`);

async function member(owner: TestUser, role: "foreman" | "office"): Promise<TestUser> {
  const email = `e2e-${role}-${owner.userId}@example.invalid`;
  const invite = await owner.api("/api/team/members/invite", { body: { email, role } });
  expect(invite.status, JSON.stringify(invite.body)).toBe(201);
  const token = invite.body.url.split("/team-invite/")[1];
  const user = await createUser({ email, name: `${role} person` });
  expect((await user.api(`/api/team/invite/${token}/accept`, { method: "POST" })).status).toBe(200);
  return user;
}

async function seedClient(org: TestUser, name: string, email: string | null) {
  const [client] = await db
    .insert(clientsTable)
    .values({ userId: org.userId, name, email, preferredLanguage: "en", dedupKey: `p88-${Math.random().toString(36).slice(2)}-${org.userId}` })
    .returning();
  return client!;
}

async function sentInvoice(org: TestUser, clientId: string, unitCents: number) {
  const created = await org.api("/api/invoices", { body: { clientId, lines: [{ description: "Deck boards", quantity: 1, unitCents }], dueDays: 15 } });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const id = created.body.invoice.id as string;
  expect((await org.api(`/api/invoices/${id}/send`, { body: {} })).status).toBe(200);
  const [row] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  return row!;
}

/** A tiny QuickBooks: remembers what was created and answers queries from it. */
function fakeQuickbooks(realmId: string) {
  const state = {
    customers: [{ Id: "C-58", DisplayName: "Existing Person", email: "known@example.invalid" }] as { Id: string; DisplayName: string; email?: string }[],
    vendors: [] as { Id: string; DisplayName: string }[],
    invoices: [] as { Id: string; DocNumber: string; SyncToken: string; TotalAmt: number }[],
    payments: [] as Record<string, unknown>[],
    pullPage: [] as Record<string, unknown>[],
    duplicateNameOnce: new Set<string>(),
    n: 100,
  };
  stubHost(QBO, (req: StubbedRequest) => {
    const u = new URL(req.url);
    expect(u.pathname.startsWith(`/v3/company/${realmId}/`)).toBe(true);
    const body = req.json as Record<string, unknown>;
    if (u.pathname.endsWith("/query")) {
      const q = u.searchParams.get("query") ?? "";
      const val = /= '((?:[^'\\]|\\.)*)'/.exec(q)?.[1]?.replace(/\\'/g, "'");
      if (q.includes("from Customer")) {
        const hit = q.includes("PrimaryEmailAddr") ? state.customers.find((c) => c.email === val) : state.customers.find((c) => c.DisplayName === val);
        return json(200, { QueryResponse: hit ? { Customer: [hit] } : {} });
      }
      if (q.includes("from Vendor")) {
        const hit = state.vendors.find((v) => v.DisplayName === val);
        return json(200, { QueryResponse: hit ? { Vendor: [hit] } : {} });
      }
      if (q.includes("from Item")) return json(200, { QueryResponse: { Item: [{ Id: "17", Name: val }] } });
      if (q.includes("from Invoice")) {
        const hit = state.invoices.find((i) => i.DocNumber === val);
        return json(200, { QueryResponse: hit ? { Invoice: [{ ...hit, Balance: 0 }] } : {} });
      }
      if (q.includes("from Payment")) return json(200, { QueryResponse: { Payment: state.pullPage } });
      return json(200, { QueryResponse: {} });
    }
    if (u.pathname.endsWith("/customer") || u.pathname.endsWith("/vendor")) {
      const name = body.DisplayName as string;
      if (state.duplicateNameOnce.has(name)) {
        state.duplicateNameOnce.delete(name);
        return json(400, { Fault: { Error: [{ Message: "Duplicate Name Exists Error", code: "6240" }], type: "ValidationFault" } });
      }
      const row = { Id: `${u.pathname.endsWith("/customer") ? "C" : "V"}-${++state.n}`, DisplayName: name };
      if (u.pathname.endsWith("/customer")) state.customers.push({ ...row, email: (body.PrimaryEmailAddr as { Address?: string } | undefined)?.Address });
      else state.vendors.push(row);
      return json(200, { [u.pathname.endsWith("/customer") ? "Customer" : "Vendor"]: row });
    }
    if (u.pathname.endsWith("/invoice") && u.searchParams.get("operation") === "void") return json(200, { Invoice: { Id: body.Id, SyncToken: "1" } });
    if (/\/invoice\/[^/]+$/.test(u.pathname)) {
      const id = decodeURIComponent(u.pathname.split("/").pop()!);
      const hit = state.invoices.find((i) => i.Id === id);
      return hit ? json(200, { Invoice: hit }) : json(404, { Fault: {} });
    }
    if (u.pathname.endsWith("/invoice")) {
      const line = (body.Line as { Amount: number }[])[0]!;
      // Mapped tax code: QuickBooks adds 13 % itself.
      const total = body.GlobalTaxCalculation === "TaxExcluded" ? Math.round(line.Amount * 113) / 100 : line.Amount;
      const row = { Id: `QI-${++state.n}`, DocNumber: body.DocNumber as string, SyncToken: "0", TotalAmt: total };
      state.invoices.push(row);
      return json(200, { Invoice: { ...row, Balance: total } });
    }
    if (/\/payment\/[^/]+$/.test(u.pathname)) return json(200, { Payment: { Id: decodeURIComponent(u.pathname.split("/").pop()!), SyncToken: "0" } });
    if (u.pathname.endsWith("/payment") && u.searchParams.get("operation") === "delete") return json(200, { Payment: { Id: body.Id, status: "Deleted" } });
    if (u.pathname.endsWith("/payment")) {
      const row = { Id: `QP-${++state.n}`, ...body };
      state.payments.push(row);
      return json(200, { Payment: row });
    }
    if (u.pathname.endsWith("/purchase")) return json(200, { Purchase: { Id: `QX-${++state.n}` } });
    return json(404, { Fault: { Error: [{ Message: `unscripted ${u.pathname}` }] } });
  });
  return state;
}

async function waitFor<T>(probe: () => Promise<T | null | undefined | false>, label: string, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await probe();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

describe("Phase 88 — accounting, both directions", () => {
  let owner: TestUser;
  let other: TestUser;
  let pro: TestUser;
  let foreman: TestUser;
  let jobId: string;

  beforeAll(async () => {
    await startServer();
    owner = await createOrg({ companyName: "Books Both Ways Co", plan: "monthly_elite" });
    other = await createOrg({ companyName: "Other Books Co", plan: "monthly_elite" });
    pro = await createOrg({ companyName: "Pro Books Co", plan: "monthly_pro" });
    foreman = await member(owner, "foreman");
    jobId = (await owner.api("/api/jobs", { body: { name: "Kitchen", address: "1 Main St, Toronto, ON" } })).body.job.id;
    await db.update(projectsTable).set({ status: "active", province: "ON" }).where(eq(projectsTable.id, jobId));
  }, 180_000);

  afterAll(async () => {
    unstubHost(QBO);
    await cleanupAll();
    await stopServer();
  });

  describe("QuickBooks", () => {
    const realmId = "9130000000000088";
    let qb: ReturnType<typeof fakeQuickbooks>;

    beforeAll(async () => {
      await db.insert(quickbooksConnectionsTable).values({
        userId: owner.userId,
        realmId,
        environment: "sandbox",
        companyName: "Books Sandbox",
        accessTokenEnc: encryptSecret("qbo-access"),
        refreshTokenEnc: encryptSecret("qbo-refresh"),
        tokenExpiresAt: daysFromNow(1),
        paymentAccount: { id: "35", name: "Chequing" },
        categoryMap: { materials: { id: "64", name: "Job Materials" } },
        incomeAccount: { id: "79", name: "Renovation revenue" },
        depositAccount: { id: "35", name: "Chequing" },
        taxCodeMap: { "HST 13%": { id: "7", name: "HST ON" } },
        connectedAt: new Date(Date.now() - 60_000),
      });
      qb = fakeQuickbooks(realmId);
    });

    test("sent → Invoice with the mapped tax code and the chosen income account; the customer is found by email and reused", async () => {
      resetRecorded();
      const known = await seedClient(owner, "Known Person (renamed)", "known@example.invalid");
      const inv = await sentInvoice(owner, known.id, 100_000);
      const call = await waitFor(async () => requestsTo(QBO).find((r) => r.url.endsWith("/invoice")), "Invoice POST");
      expect(call.json).toMatchObject({
        CustomerRef: { value: "C-58" }, // matched by email, not created under the new name
        DocNumber: inv.number,
        GlobalTaxCalculation: "TaxExcluded",
        Line: [{ Amount: 1000, SalesItemLineDetail: { ItemRef: { value: "17" }, TaxCodeRef: { value: "7" } } }],
      });
      const itemQuery = requestsTo(QBO).find((r) => r.url.includes("from%20Item"))!;
      expect(decodeURIComponent(itemQuery.url)).toContain("QuoteAI Job Revenue - Renovation revenue");
      expect(requestsTo(QBO).filter((r) => r.url.endsWith("/customer"))).toHaveLength(0);
      const [link] = await db.select().from(accountingLinksTable).where(and(eq(accountingLinksTable.userId, owner.userId), eq(accountingLinksTable.entityType, "invoice"), eq(accountingLinksTable.entityId, inv.id)));
      expect(link).toMatchObject({ provider: "quickbooks", externalType: "Invoice", origin: "quoteai" });
      const [log] = await db.select().from(quickbooksSyncLogTable).where(and(eq(quickbooksSyncLogTable.userId, owner.userId), eq(quickbooksSyncLogTable.entityId, inv.id)));
      expect(log).toMatchObject({ status: "synced", qboType: "Invoice", error: null }); // QuickBooks' 13 % matches ours: no drift note

      resetRecorded();
      await sentInvoice(owner, known.id, 20_000);
      await waitFor(async () => requestsTo(QBO).find((r) => r.url.endsWith("/invoice")), "second Invoice POST");
      expect(requestsTo(QBO).filter((r) => r.url.includes("from%20Customer")), "the client's QuickBooks customer is remembered").toHaveLength(0);
    });

    test("a name QuickBooks already uses for someone else gets the email added instead of failing", async () => {
      resetRecorded();
      qb.duplicateNameOnce.add("Taken Name");
      const c = await seedClient(owner, "Taken Name", "taken@example.invalid");
      await sentInvoice(owner, c.id, 10_000);
      const creates = await waitFor(async () => {
        const r = requestsTo(QBO).filter((x) => x.url.endsWith("/customer"));
        return r.length === 2 ? r : null;
      }, "two customer creates");
      expect((creates[1]!.json as { DisplayName: string }).DisplayName).toBe("Taken Name (taken@example.invalid)");
    });

    test("payments go over applied to their invoice, come back from QuickBooks once, and never loop", async () => {
      const c = await seedClient(owner, "Payer Person", "payer@example.invalid");
      const inv = await sentInvoice(owner, c.id, 200_000); // 2 260.00 with HST
      const qboInvoiceId = (await waitFor(async () => (await db.select().from(accountingLinksTable).where(and(eq(accountingLinksTable.entityType, "invoice"), eq(accountingLinksTable.entityId, inv.id))))[0], "invoice link")).externalId;

      resetRecorded();
      const pay = await owner.api(`/api/invoices/${inv.id}/payments`, { body: { amountCents: 100_000, method: "cheque", reference: "CHQ 118" } });
      expect(pay.status, JSON.stringify(pay.body)).toBe(201);
      const pushed = await waitFor(async () => requestsTo(QBO).find((r) => r.url.endsWith("/payment") && r.method === "POST"), "Payment POST");
      expect(pushed.json).toMatchObject({ TotalAmt: 1000, PaymentRefNum: "CHQ 118", DepositToAccountRef: { value: "35" }, Line: [{ Amount: 1000, LinkedTxn: [{ TxnId: qboInvoiceId, TxnType: "Invoice" }] }] });
      const pushedId = qb.payments.at(-1)!.Id as string;

      // What QuickBooks answers on the next pull: our own payment, a new one for the rest, one on an invoice we never sent, and one too big.
      const other = await sentInvoice(owner, c.id, 10_000);
      const otherQbo = (await waitFor(async () => (await db.select().from(accountingLinksTable).where(and(eq(accountingLinksTable.entityType, "invoice"), eq(accountingLinksTable.entityId, other.id))))[0], "second link")).externalId;
      const t = (s: number) => new Date(Date.now() + s * 1000).toISOString();
      qb.pullPage = [
        { Id: pushedId, TxnDate: "2026-09-20", TotalAmt: 1000, Line: [{ Amount: 1000, LinkedTxn: [{ TxnId: qboInvoiceId, TxnType: "Invoice" }] }], MetaData: { LastUpdatedTime: t(1) } },
        { Id: "QB-EXT-1", TxnDate: "2026-09-21", TotalAmt: 1260, PaymentRefNum: "ET-77", Line: [{ Amount: 1260, LinkedTxn: [{ TxnId: qboInvoiceId, TxnType: "Invoice" }] }], MetaData: { LastUpdatedTime: t(2) } },
        { Id: "QB-EXT-2", TxnDate: "2026-09-21", TotalAmt: 50, Line: [{ Amount: 50, LinkedTxn: [{ TxnId: "NOT-OURS", TxnType: "Invoice" }] }], MetaData: { LastUpdatedTime: t(3) } },
        { Id: "QB-EXT-3", TxnDate: "2026-09-21", TotalAmt: 9999, Line: [{ Amount: 9999, LinkedTxn: [{ TxnId: otherQbo, TxnType: "Invoice" }] }], MetaData: { LastUpdatedTime: t(4) } },
      ];
      resetRecorded();
      // Scoped to this company: the e2e database is shared.
      const tick = await runQuickbooksPaymentPull([owner.userId]);
      expect(tick).toMatchObject({ connections: 1, recorded: 1, conflicts: 1, failed: 0 });

      const [paid] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, inv.id));
      expect(paid).toMatchObject({ status: "paid", paidCents: 226_000 });
      const payments = await db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, inv.id));
      expect(payments.map((p) => p.reference).sort()).toEqual(["CHQ 118", "QuickBooks ET-77"]);
      const [otherRow] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, other.id));
      expect(otherRow!.paidCents, "more than the balance is a conflict, never recorded").toBe(0);
      const conflicts = await db.select().from(quickbooksSyncLogTable).where(and(eq(quickbooksSyncLogTable.userId, owner.userId), eq(quickbooksSyncLogTable.entityType, "payment_pull")));
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]!.error).toMatch(/more than .* still owing/);
      await new Promise((r) => setTimeout(r, 500));
      expect(requestsTo(QBO).filter((r) => r.url.endsWith("/payment") && r.method === "POST"), "a pulled payment is never pushed back").toHaveLength(0);

      // The same page again (a cursor that did not move, or QuickBooks re-sending): nothing new.
      await db.update(quickbooksConnectionsTable).set({ paymentsCursor: null }).where(eq(quickbooksConnectionsTable.userId, owner.userId));
      const again = await owner.api("/api/quickbooks/pull", { method: "POST" });
      expect(again.status).toBe(200);
      expect(again.body).toMatchObject({ read: 4, recorded: 0 });
      expect(await db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, inv.id))).toHaveLength(2);
      expect((await foreman.api("/api/quickbooks/pull", { method: "POST" })).status).toBe(403);
    });

    test("a payment removed in QuoteAI is deleted in QuickBooks; a void voids the QuickBooks invoice", async () => {
      const c = await seedClient(owner, "Oops Person", "oops@example.invalid");
      const inv = await sentInvoice(owner, c.id, 30_000);
      const pay = await owner.api(`/api/invoices/${inv.id}/payments`, { body: { amountCents: 5_000, method: "etransfer" } });
      const paymentId = pay.body.payment?.id ?? (await db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, inv.id)))[0]!.id;
      const qboPaymentId = (await waitFor(async () => (await db.select().from(accountingLinksTable).where(and(eq(accountingLinksTable.entityType, "invoice_payment"), eq(accountingLinksTable.entityId, paymentId))))[0], "payment link")).externalId;

      resetRecorded();
      expect((await owner.api(`/api/invoices/${inv.id}/payments/${paymentId}`, { method: "DELETE" })).status).toBe(200);
      const del = await waitFor(async () => requestsTo(QBO).find((r) => r.url.includes("/payment?operation=delete")), "Payment delete");
      expect(del.json).toMatchObject({ Id: qboPaymentId, SyncToken: "0" });
      expect(await db.select().from(accountingLinksTable).where(and(eq(accountingLinksTable.entityType, "invoice_payment"), eq(accountingLinksTable.entityId, paymentId)))).toHaveLength(0);

      resetRecorded();
      expect((await owner.api(`/api/invoices/${inv.id}/void`, { body: { reason: "Wrong client" } })).status).toBe(200);
      const voided = await waitFor(async () => requestsTo(QBO).find((r) => r.url.includes("/invoice?operation=void")), "Invoice void");
      const qboInvoiceId = (await db.select().from(accountingLinksTable).where(and(eq(accountingLinksTable.entityType, "invoice"), eq(accountingLinksTable.entityId, inv.id))))[0]!.externalId;
      expect(voided.json).toMatchObject({ Id: qboInvoiceId });
    });

    test("costs go over with their vendor, one QuickBooks vendor however the name is typed", async () => {
      resetRecorded();
      for (const vendor of ["Home Depot", "  home depot. "]) {
        const res = await owner.api(`/api/jobs/${jobId}/costs`, { body: { category: "materials", vendor, description: "Lumber", totalCents: 12_345, taxCents: 0 } });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
      }
      const purchases = await waitFor(async () => {
        const r = requestsTo(QBO).filter((x) => x.url.endsWith("/purchase"));
        return r.length === 2 ? r : null;
      }, "two purchases");
      const vendorIds = purchases.map((p) => (p.json as { EntityRef: { value: string } }).EntityRef.value);
      expect(vendorIds[0]).toBe(vendorIds[1]);
      expect(requestsTo(QBO).filter((r) => r.url.endsWith("/vendor"))).toHaveLength(1);
    });

    test("an invoice that was already out when QuickBooks was connected goes over with its payments on backfill", async () => {
      // Sent while disconnected: no link, no push.
      await db.update(quickbooksConnectionsTable).set({ isEnabled: false }).where(eq(quickbooksConnectionsTable.userId, owner.userId));
      const c = await seedClient(owner, "Earlier Person", "earlier@example.invalid");
      const inv = await sentInvoice(owner, c.id, 40_000);
      await owner.api(`/api/invoices/${inv.id}/payments`, { body: { amountCents: 10_000, method: "etransfer" } });
      await db.update(quickbooksConnectionsTable).set({ isEnabled: true }).where(eq(quickbooksConnectionsTable.userId, owner.userId));
      expect(await db.select().from(accountingLinksTable).where(eq(accountingLinksTable.entityId, inv.id))).toHaveLength(0);

      resetRecorded();
      const res = await owner.api("/api/quickbooks/backfill", { method: "POST" });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.invoices).toBeGreaterThanOrEqual(1);
      expect(requestsTo(QBO).some((r) => r.url.endsWith("/invoice") && (r.json as { DocNumber: string }).DocNumber === inv.number)).toBe(true);
      // Running it twice creates nothing twice.
      resetRecorded();
      const second = await owner.api("/api/quickbooks/backfill", { method: "POST" });
      expect(second.body).toMatchObject({ invoices: 0, payments: 0 });
      expect(requestsTo(QBO).filter((r) => r.method === "POST")).toHaveLength(0);
    });
  });

  describe("bank reconciliation", () => {
    let debit: string;
    let debit2: string;
    let deposit: string;
    let costA: string;
    let invoiceId: string;

    beforeAll(async () => {
      await db.update(quickbooksConnectionsTable).set({ isEnabled: false }).where(eq(quickbooksConnectionsTable.userId, owner.userId));
      await db.insert(flinksConnectionsTable).values({ userId: owner.userId, loginIdEnc: encryptSecret("login"), institutionName: "Test Bank", selectedAccount: { id: "acc-1", name: "Chequing", institution: "Test Bank", last4: "1234" } });
      const cost = (v: Partial<typeof costEntriesTable.$inferInsert>) => ({ userId: owner.userId, projectId: jobId, vendor: "Lumber Yard", date: at("2026-08-10"), subtotalCents: 50_000, totalCents: 54_321, status: "confirmed" as const, ...v });
      const [a] = await db.insert(costEntriesTable).values(cost({})).returning();
      costA = a!.id;
      const line = (v: Partial<typeof flinksTransactionsTable.$inferInsert>) => ({ userId: owner.userId, flinksTransactionId: `p88-${Math.random()}`, date: at("2026-08-11"), description: "LUMBER YARD #12", amountCents: -54_321, ...v });
      const rows = await db.insert(flinksTransactionsTable).values([line({}), line({ description: "LUMBER YARD #12 (dup)" }), line({ description: "E-TRANSFER FROM PAT", amountCents: 33_900 })]).returning();
      [debit, debit2, deposit] = rows.map((r) => r.id) as [string, string, string];
      const c = await seedClient(owner, "Deposit Person", "deposit@example.invalid");
      const inv = await sentInvoice(owner, c.id, 30_000); // 339.00
      invoiceId = inv.id;
    });

    test("the auto-matcher only acts on exactly one unclaimed candidate", async () => {
      const lone = await autoMatchLine(owner.userId, { amountCents: -54_321, date: at("2026-08-11") });
      expect(lone.matchedCostEntryId).toBe(costA);
      const [twin] = await db.insert(costEntriesTable).values({ userId: owner.userId, vendor: "Lumber Yard", date: at("2026-08-12"), totalCents: 54_321, status: "confirmed" }).returning();
      expect((await autoMatchLine(owner.userId, { amountCents: -54_321, date: at("2026-08-11") })).matchedCostEntryId, "two candidates: a person decides").toBeNull();
      await db.delete(costEntriesTable).where(eq(costEntriesTable.id, twin!.id));
    });

    test("money out matches a cost once; a second line cannot claim the same cost", async () => {
      const cands = await owner.api(`/api/books/bank/${debit}/candidates`);
      expect(cands.status).toBe(200);
      expect(cands.body.direction).toBe("out");
      expect(cands.body.costs.map((c: { id: string }) => c.id)).toContain(costA);

      expect((await owner.api(`/api/books/bank/${debit}/match`, { body: { costEntryId: costA } })).status).toBe(200);
      const second = await owner.api(`/api/books/bank/${debit2}/match`, { body: { costEntryId: costA } });
      expect(second.status).toBe(409);
      const cands2 = await owner.api(`/api/books/bank/${debit2}/candidates`);
      expect(cands2.body.costs.map((c: { id: string }) => c.id), "a matched cost is no longer offered").not.toContain(costA);
      expect((await owner.api(`/api/books/bank/${deposit}/match`, { body: { costEntryId: costA } })).status, "money in is not a cost").toBe(400);

      // The second line is a card charge with no receipt yet: a pending cost from the line.
      const made = await owner.api(`/api/books/bank/${debit2}/create-cost`, { body: { category: "materials", projectId: jobId } });
      expect(made.status, JSON.stringify(made.body)).toBe(201);
      const [row] = await db.select().from(costEntriesTable).where(eq(costEntriesTable.id, made.body.costEntryId));
      expect(row).toMatchObject({ status: "pending_review", source: "bank_feed", totalCents: 54_321, projectId: jobId });

      const list = await owner.api("/api/books/bank?status=matched");
      expect(list.body.lines.map((l: { id: string }) => l.id).sort()).toEqual([debit, debit2].sort());
      expect(list.body.lines.find((l: { id: string }) => l.id === debit).match).toMatchObject({ kind: "cost", id: costA, projectName: "Kitchen" });
    });

    test("a deposit records the payment it is, dated the deposit day, and cannot pay more than is owing", async () => {
      const cands = await owner.api(`/api/books/bank/${deposit}/candidates`);
      expect(cands.body.direction).toBe("in");
      expect(cands.body.invoices[0]).toMatchObject({ id: invoiceId, exact: true, balanceCents: 33_900 });

      const res = await owner.api(`/api/books/bank/${deposit}/record-payment`, { body: { invoiceId } });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
      expect(inv!.status).toBe("paid");
      const [p] = await db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.id, res.body.paymentId));
      expect(p).toMatchObject({ method: "bank_transfer", amountCents: 33_900, reference: "E-TRANSFER FROM PAT" });
      expect(p!.date.toISOString().slice(0, 10)).toBe("2026-08-11");
      expect((await owner.api(`/api/books/bank/${deposit}/record-payment`, { body: { invoiceId } })).status, "already matched").toBe(409);

      const [big] = await db.insert(flinksTransactionsTable).values({ userId: owner.userId, flinksTransactionId: `p88-big`, date: at("2026-08-12"), description: "BIG DEPOSIT", amountCents: 999_999 }).returning();
      const c = await seedClient(owner, "Small Owing", "small@example.invalid");
      const small = await sentInvoice(owner, c.id, 1_000);
      const over = await owner.api(`/api/books/bank/${big!.id}/record-payment`, { body: { invoiceId: small.id } });
      expect(over.status).toBe(409);
      expect(over.body.error).toBe("OVER_BALANCE");
    });

    test("unmatch and ignore; other companies, foremen and plans without the bank feed are refused", async () => {
      expect((await owner.api(`/api/books/bank/${debit}/unmatch`, { method: "POST" })).status).toBe(200);
      expect((await owner.api(`/api/books/bank/${debit}/ignore`, { method: "POST" })).status).toBe(200);
      const ignored = await owner.api("/api/books/bank?status=ignored");
      expect(ignored.body.lines.map((l: { id: string }) => l.id)).toContain(debit);

      expect((await other.api(`/api/books/bank/${debit}/candidates`)).status).toBe(404);
      expect((await other.api(`/api/books/bank/${debit2}/match`, { body: { costEntryId: costA } })).status).toBe(404);
      expect((await other.api("/api/books/bank")).body.lines).toEqual([]);
      expect((await foreman.api("/api/books/bank")).status).toBe(403);
      expect((await foreman.api("/api/books/close")).status).toBe(403);
      const noFeed = await pro.api("/api/books/bank");
      expect(noFeed.status).toBe(403);
      expect(noFeed.body.error).toBe("PLAN_REQUIRED");
      expect((await pro.api("/api/books/claims")).status, "claims and the close are Pro").toBe(200);
    });
  });

  describe("materials claims", () => {
    test("the receipt stands in for the claim: report, bank line and job follow it, and it only works once", async () => {
      const [claim] = await db.insert(costEntriesTable).values({ userId: owner.userId, projectId: jobId, category: "materials", description: "Drywall screws (Sam)", date: at("2026-08-20"), subtotalCents: 21_000, totalCents: 21_000, status: "pending_review" }).returning();
      const [report] = await db.insert(fieldReportsTable).values({ userId: owner.userId, projectId: jobId, authorName: "Sam", kind: "materials", body: "Drywall screws", materialsCents: 21_000, costEntryId: claim!.id }).returning();
      const [doc] = await db.insert(uploadedDocumentsTable).values({ userId: owner.userId, fileName: "receipt.jpg", mimeType: "image/jpeg", fileUrl: `/objects/receipts/${owner.userId}/r.jpg` } as typeof uploadedDocumentsTable.$inferInsert).returning();
      const [receipt] = await db.insert(costEntriesTable).values({ userId: owner.userId, projectId: null, category: "materials", vendor: "Home Hardware", date: at("2026-08-21"), subtotalCents: 19_000, taxCents: 2_470, taxBreakdown: { HST: 2_470 }, totalCents: 21_470, status: "confirmed", source: "receipt", sourceDocumentId: doc!.id }).returning();
      const [line] = await db.insert(flinksTransactionsTable).values({ userId: owner.userId, flinksTransactionId: "p88-claim", date: at("2026-08-21"), description: "HOME HARDWARE", amountCents: -21_000, matchStatus: "matched", matchedCostEntryId: claim!.id }).returning();

      const list = await owner.api("/api/books/claims");
      expect(list.status).toBe(200);
      const c = list.body.claims.find((x: { costEntryId: string }) => x.costEntryId === claim!.id);
      expect(c).toMatchObject({ authorName: "Sam", totalCents: 21_000, projectName: "Kitchen" });
      expect(c.receipts[0].id).toBe(receipt!.id);

      expect((await other.api(`/api/books/claims/${claim!.id}/merge`, { body: { receiptId: receipt!.id } })).status).toBe(404);
      const merged = await owner.api(`/api/books/claims/${claim!.id}/merge`, { body: { receiptId: receipt!.id } });
      expect(merged.status, JSON.stringify(merged.body)).toBe(200);
      expect(await db.select().from(costEntriesTable).where(eq(costEntriesTable.id, claim!.id))).toHaveLength(0);
      const [r] = await db.select().from(fieldReportsTable).where(eq(fieldReportsTable.id, report!.id));
      expect(r!.costEntryId).toBe(receipt!.id);
      const [l] = await db.select().from(flinksTransactionsTable).where(eq(flinksTransactionsTable.id, line!.id));
      expect(l!.matchedCostEntryId).toBe(receipt!.id);
      const [rc] = await db.select().from(costEntriesTable).where(eq(costEntriesTable.id, receipt!.id));
      expect(rc!.projectId, "the receipt lands on the claim's job").toBe(jobId);
      expect((await owner.api(`/api/books/claims/${claim!.id}/merge`, { body: { receiptId: receipt!.id } })).status).toBe(404);
      expect((await owner.api("/api/books/claims")).body.claims.find((x: { costEntryId: string }) => x.costEntryId === claim!.id)).toBeUndefined();
    });

    test("a claim that already went to the books is not removed behind their back", async () => {
      const [claim] = await db.insert(costEntriesTable).values({ userId: owner.userId, projectId: jobId, category: "materials", date: at("2026-08-22"), totalCents: 5_000, status: "confirmed" }).returning();
      await db.insert(fieldReportsTable).values({ userId: owner.userId, projectId: jobId, authorName: "Sam", kind: "materials", materialsCents: 5_000, costEntryId: claim!.id });
      await db.insert(quickbooksSyncLogTable).values({ userId: owner.userId, entityType: "cost_entry", entityId: claim!.id, status: "synced", qboId: "QX-1", qboType: "Purchase" });
      const [doc] = await db.insert(uploadedDocumentsTable).values({ userId: owner.userId, fileName: "r2.jpg", mimeType: "image/jpeg", fileUrl: `/objects/receipts/${owner.userId}/r2.jpg` } as typeof uploadedDocumentsTable.$inferInsert).returning();
      const [receipt] = await db.insert(costEntriesTable).values({ userId: owner.userId, projectId: jobId, date: at("2026-08-22"), totalCents: 5_000, status: "confirmed", source: "receipt", sourceDocumentId: doc!.id }).returning();
      const res = await owner.api(`/api/books/claims/${claim!.id}/merge`, { body: { receiptId: receipt!.id } });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("CLAIM_SYNCED");
    });
  });

  describe("month-end close", () => {
    test("counts what is unfinished, closes, notices what turned up afterwards, reopens", async () => {
      const res = await owner.api("/api/books/close?month=2026-08");
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      const byKey = Object.fromEntries(res.body.items.map((i: { key: string }) => [i.key, i]));
      expect(byKey.bank_unmatched.applies).toBe(true);
      expect(byKey.costs_pending.count, "the cost made from the bank line").toBeGreaterThanOrEqual(1);
      expect(byKey.costs_pending.rows[0].href).toBe(`/dashboard/jobs/${jobId}?tab=costs`);
      expect(byKey.tax_unsplit.applies).toBe(true);
      expect(res.body.closed).toBeNull();

      expect((await owner.api("/api/books/close", { body: { month: "2026-09" } })).body.error, "a month that is not over").toBe("MONTH_NOT_OVER");
      expect((await owner.api("/api/books/close?month=2027-01")).status).toBe(400);
      expect((await owner.api("/api/books/close", { body: { month: "2026-13" } })).status).toBe(400);

      const closed = await owner.api("/api/books/close", { body: { month: "2026-08", note: "Sent to Lee" } });
      expect(closed.status, JSON.stringify(closed.body)).toBe(200);
      expect(closed.body.close).toMatchObject({ month: "2026-08", note: "Sent to Lee" });

      await db.insert(costEntriesTable).values({ userId: owner.userId, projectId: jobId, vendor: "Late receipt", date: at("2026-08-30"), totalCents: 1_000, status: "pending_review" });
      const after = await owner.api("/api/books/close?month=2026-08");
      expect(after.body.closed).toMatchObject({ month: "2026-08", note: "Sent to Lee" });
      expect(after.body.changedSinceClose).toContain("costs_pending");
      expect(after.body.closedMonths).toContain("2026-08");
      expect((await other.api("/api/books/close?month=2026-08")).body.closed, "another company's close is its own").toBeNull();

      expect((await owner.api("/api/books/close/reopen", { body: { month: "2026-08" } })).status).toBe(200);
      expect((await owner.api("/api/books/close/reopen", { body: { month: "2026-08" } })).status).toBe(404);
    });
  });

  describe("T5018 by payment date", () => {
    test("a December bill paid in January counts in January's year", async () => {
      const [sub] = await db.insert(suppliersTable).values({ userId: owner.userId, name: "Late Pay Framing" }).returning();
      const [cost] = await db.insert(costEntriesTable).values({ userId: owner.userId, category: "subcontractor", supplierId: sub!.id, vendor: "Late Pay Framing", date: at("2025-12-20"), subtotalCents: 80_000, totalCents: 90_400, taxCents: 10_400, status: "confirmed" }).returning();
      const before25 = await owner.api("/api/compliance/t5018?year=2025");
      expect(before25.body.recipients.map((r: { name: string }) => r.name)).toContain("Late Pay Framing");

      await db.insert(flinksTransactionsTable).values({ userId: owner.userId, flinksTransactionId: "p88-t5018", date: at("2026-01-15"), description: "CHQ 2001", amountCents: -90_400, matchStatus: "matched", matchedCostEntryId: cost!.id });
      const y25 = await owner.api("/api/compliance/t5018?year=2025");
      expect(y25.body.recipients.map((r: { name: string }) => r.name)).not.toContain("Late Pay Framing");
      const y26 = await owner.api("/api/compliance/t5018?year=2026");
      expect(y26.body.recipients.find((r: { name: string }) => r.name === "Late Pay Framing")).toMatchObject({ totalCents: 90_400, bankDated: 1, overThreshold: true });
    });
  });
});
