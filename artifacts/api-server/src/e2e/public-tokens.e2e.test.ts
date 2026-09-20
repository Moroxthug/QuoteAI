// Phase 63 — the two public, token-addressed flows added after Phase 6:
//  • worker magic link → clock-in with GPS → geofence flag (Phase 23)
//  • customer self-reports an e-Transfer on the public invoice page →
//    contractor confirms (or rejects) from the dashboard (Phase 15)

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, projectsTable, timeEntriesTable, invoicesTable, invoiceEventsTable, clientsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import "../automations/index.js";
import { buildInvoiceContext, createInvoice, sendInvoice, invoiceToken } from "../invoices/service.js";
import { startServer, stopServer, createOrg, cleanupAll, api } from "./harness.js";
import { emailsTo } from "./mailbox.js";

describe("worker clock-in", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("magic link → clock in on site (clean) and off site (flagged) → clock out", async () => {
    const org = await createOrg({ plan: "monthly_elite" });
    // Job with a 200 m geofence around Parliament Hill.
    const [job] = await db
      .insert(projectsTable)
      .values({ userId: org.userId, name: "Site job", status: "active", latitude: "45.423600", longitude: "-75.700900", geofenceRadiusMeters: 200 })
      .returning();

    const worker = await org.api("/api/team/workers", { body: { name: "Pat Worker", email: `worker-${org.userId}@example.invalid`, hourlyRateCents: 3500 } });
    expect(worker.status, JSON.stringify(worker.body)).toBe(201);
    const invite = await org.api(`/api/team/workers/${worker.body.worker.id}/invite`, { body: {} });
    expect(invite.status, JSON.stringify(invite.body)).toBe(200);
    expect(invite.body.emailed).toBe(true);
    const token = invite.body.url.split("/t/")[1] as string;

    // The worker's page (no login) lists the open job.
    const page = await api(`/api/t/${token}`);
    expect(page.status).toBe(200);
    expect(JSON.stringify(page.body)).toContain(job!.id);

    // On site → not flagged.
    const inside = await api(`/api/t/${token}/clock-in`, { body: { projectId: job!.id, lat: 45.4241, lng: -75.7005 } });
    expect(inside.status, JSON.stringify(inside.body)).toBe(201);
    expect(inside.body.entry.geofenceFlagged).toBe(false);

    // Second clock-in while one is open → 409.
    const dup = await api(`/api/t/${token}/clock-in`, { body: { projectId: job!.id } });
    expect(dup.status).toBe(409);

    const out = await api(`/api/t/${token}/entries/${inside.body.entry.id}/clock-out`, { body: {} });
    expect(out.status, JSON.stringify(out.body)).toBe(200);

    // 5 km away → flagged, never blocked.
    const outside = await api(`/api/t/${token}/clock-in`, { body: { projectId: job!.id, lat: 45.38, lng: -75.7 } });
    expect(outside.status, JSON.stringify(outside.body)).toBe(201);
    expect(outside.body.entry.geofenceFlagged).toBe(true);

    const rows = await db.select().from(timeEntriesTable).where(eq(timeEntriesTable.projectId, job!.id));
    expect(rows.map((r) => r.geofenceFlagged).sort()).toEqual([false, true]);

    // Revoking the link kills access; an invalid token is 404.
    const revoke = await org.api(`/api/team/workers/${worker.body.worker.id}/invite`, { method: "DELETE" });
    expect([200, 204]).toContain(revoke.status);
    expect((await api(`/api/t/${token}`)).status).toBe(404);
    expect((await api(`/api/t/${"x".repeat(40)}`)).status).toBe(404);
  });

  test("time tracking is plan-gated", async () => {
    const pro = await createOrg({ plan: "monthly_pro" });
    const r = await pro.api("/api/team/workers", { body: { name: "No Plan", hourlyRateCents: 3000 } });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("PLAN_REQUIRED");
  });
});

describe("e-Transfer self-report", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  /** A sent $1,000 manual invoice to a client with an email — the same rows the dashboard’s "new invoice" writes. */
  async function sentInvoice(org: Awaited<ReturnType<typeof createOrg>>) {
    const [client] = await db.insert(clientsTable).values({ userId: org.userId, name: "Pay Client", email: "client@e2e-test.invalid", dedupKey: `pay-${org.userId}` }).returning();
    const ctx = await buildInvoiceContext({ userId: org.userId, clientId: client!.id });
    const draft = await createInvoice({ userId: org.userId, ctx, type: "manual", source: "manual", actor: "contractor", dueDays: 15, lines: [{ description: "Deposit", quantity: 1, unitCents: 100_000, amountCents: 100_000 }] });
    const { invoice } = await sendInvoice({ invoiceId: draft.id, userId: org.userId, actor: "contractor" });
    expect(invoice.status).toBe("sent");
    return { invoice, token: invoiceToken(invoice) };
  }

  test("customer marks sent → pending_confirmation → contractor confirms → paid + receipt", async () => {
    const org = await createOrg();
    const { invoice, token } = await sentInvoice(org);

    // Public page: first open flips sent → viewed.
    const view = await api(`/api/i/${token}`);
    expect(view.status, JSON.stringify(view.body)).toBe(200);
    expect(view.body.invoice.status).toBe("viewed");
    expect(view.body.invoice.canPayByCard).toBe(false); // no Stripe Connect account

    const reported = await api(`/api/i/${token}/mark-sent`, { body: {} });
    expect(reported.status, JSON.stringify(reported.body)).toBe(200);
    expect(reported.body.status).toBe("pending_confirmation");
    // Reporting twice is refused: the invoice is no longer "open".
    expect((await api(`/api/i/${token}/mark-sent`, { body: {} })).status).toBe(400);

    // The contractor gets an in-app notification.
    const notif = await org.api("/api/notifications");
    expect(notif.status).toBe(200);
    expect(JSON.stringify(notif.body)).toContain("invoice_payment_reported");

    // A different org cannot confirm it.
    const other = await createOrg();
    expect((await other.api(`/api/invoices/${invoice.id}/confirm-etransfer`, { method: "POST" })).status).toBe(404);

    const confirmed = await org.api(`/api/invoices/${invoice.id}/confirm-etransfer`, { method: "POST" });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    expect(confirmed.body.invoice.status).toBe("paid");
    expect(confirmed.body.invoice.paidCents).toBe(invoice.totalCents);

    const events = await db.select().from(invoiceEventsTable).where(eq(invoiceEventsTable.invoiceId, invoice.id));
    const types = events.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["sent", "viewed", "etransfer_reported", "payment_recorded"]));
    expect(emailsTo("client@e2e-test.invalid").length).toBeGreaterThanOrEqual(2); // invoice + receipt
  });

  test("contractor rejects a wrong self-report → invoice reopens", async () => {
    const org = await createOrg();
    const { invoice, token } = await sentInvoice(org);
    await api(`/api/i/${token}/mark-sent`, { body: {} });

    const rejected = await org.api(`/api/invoices/${invoice.id}/reject-etransfer`, { method: "POST" });
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200);
    expect(["sent", "viewed"]).toContain(rejected.body.invoice.status);
    const [row] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoice.id)));
    expect(row!.paidCents).toBe(0);
    expect(row!.etransferSelfReportedAt).toBeNull();
    // The customer can report again.
    expect((await api(`/api/i/${token}/mark-sent`, { body: {} })).status).toBe(200);
  });
});
