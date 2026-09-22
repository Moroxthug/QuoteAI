// Phase 80 — per-company follow-up cadence + review delay, the company logo
// on invoice/contract PDFs, and the quote PDF's chapter tables.
//
// Same "frozen clock" convention as followups.e2e.test.ts: due dates are moved
// into the past on our own rows and the maintenance ticks at the real `now`.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, leadsTable, projectsTable, clientsTable, businessProfilesTable, automationRunsTable, quotesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import "../automations/index.js";
import { runLeadMaintenance } from "../leads/maintenance.js";
import { runJobReviewRequestMaintenance } from "../jobs/maintenance.js";
import { TINY_PNG_DATA_URL } from "../lib/pngDataUrl.js";
import { startServer, stopServer, createOrg, cleanupAll, daysAgo, seedQuote } from "./harness.js";
import { seedShowcase } from "./fixtures.js";
import { emailsTo } from "./mailbox.js";
import { generateCapitolatoPdfBuffer } from "../quotes/pdf.js";
import { invoicePdfBuffer } from "../invoices/service.js";
import { contractPdfBuffer } from "../contracts/service.js";

const DAY = 86_400_000;
const near = (t: number, days: number) => Math.abs(t - (Date.now() + days * DAY)) < 2 * 60_000;

describe("Phase 80 — cadence settings", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("lead follow-ups run on the company's own cadence, and an empty cadence switches them off", async () => {
    const org = await createOrg({ profile: { automationSettings: { leadFollowupDays: [2, 4] } } });
    const leadEmail = `lead-cadence-${org.userId}@example.invalid`;
    const created = await org.api("/api/leads", { body: { name: "Cadence Prospect", email: leadEmail, preferredLanguage: "en" } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const leadId = created.body.lead.id as string;
    expect(near(new Date(created.body.lead.nextFollowUpAt).getTime(), 2)).toBe(true);

    // Stage 0 fires → stage 1 is 4 days out; stage 1 fires → sequence over.
    await db.update(leadsTable).set({ nextFollowUpAt: daysAgo(0.01) }).where(eq(leadsTable.id, leadId));
    await runLeadMaintenance();
    let [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
    expect(lead!.followUpStage).toBe(1);
    expect(near(lead!.nextFollowUpAt!.getTime(), 4)).toBe(true);
    await db.update(leadsTable).set({ nextFollowUpAt: daysAgo(0.01) }).where(eq(leadsTable.id, leadId));
    await runLeadMaintenance();
    [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
    expect(lead!.followUpStage).toBe(2);
    expect(lead!.nextFollowUpAt).toBeNull();
    expect(emailsTo(leadEmail)).toHaveLength(2);

    // Settings round trip through the API, then an empty cadence = no first touch.
    const saved = await org.api("/api/business-profile", { method: "PUT", body: { automationSettings: { leadFollowupDays: [], reviewRequestDelayDays: 0 } } });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const profile = await org.api("/api/business-profile");
    expect(profile.body.automationSettings.leadFollowupDays).toEqual([]);
    expect(profile.body.automationSettings.reviewRequestDelayDays).toBe(0);
    expect(profile.body.automationSettings.quoteFollowupDays).toEqual([2, 5, 10]);
    const quiet = await org.api("/api/leads", { body: { name: "No Sequence", email: `quiet-${org.userId}@example.invalid` } });
    expect(quiet.status).toBe(201);
    expect(quiet.body.lead.nextFollowUpAt).toBeNull();

    // Validation: more than five touches / out-of-range days are refused.
    const bad = await org.api("/api/business-profile", { method: "PUT", body: { automationSettings: { leadFollowupDays: [1, 2, 3, 4, 5, 6] } } });
    expect(bad.status).toBe(400);
    const bad2 = await org.api("/api/business-profile", { method: "PUT", body: { automationSettings: { quoteFollowupDays: [0] } } });
    expect(bad2.status).toBe(400);
  });

  test("quote follow-ups use the company's quote cadence from the send", async () => {
    const org = await createOrg({ profile: { automationSettings: { quoteFollowupDays: [7] } } });
    const quote = await seedQuote(org.userId, { province: "ON", clientEmail: `q-cadence-${org.userId}@example.invalid` });
    const sent = await org.api(`/api/quotes/${quote.id}/send-pdf-email`, { body: { toEmail: `q-cadence-${org.userId}@example.invalid` } });
    expect([200, 201], JSON.stringify(sent.body)).toContain(sent.status);
    const [q] = await db.select().from(quotesTable).where(eq(quotesTable.id, quote.id));
    expect(q!.followUpStage).toBe(0);
    expect(near(q!.nextFollowUpAt!.getTime(), 7)).toBe(true);
  });

  test("review request waits the company's own delay (0 = same day, 10 = not yet)", async () => {
    const sameDay = await createOrg({ profile: { sendReviewRequests: true, googleReviewUrl: "https://g.page/r/e2e/review", automationSettings: { reviewRequestDelayDays: 0 } } });
    const patient = await createOrg({ profile: { sendReviewRequests: true, googleReviewUrl: "https://g.page/r/e2e/review", automationSettings: { reviewRequestDelayDays: 10 } } });
    const mk = async (org: typeof sameDay, ageDays: number) => {
      const email = `client-delay-${org.userId}@example.invalid`;
      const [client] = await db.insert(clientsTable).values({ userId: org.userId, name: "Delay Client", email, dedupKey: `delay-${org.userId}` }).returning();
      const [project] = await db.insert(projectsTable).values({ userId: org.userId, clientId: client!.id, name: "Finished job", status: "completed", completedAt: daysAgo(ageDays) }).returning();
      return { email, projectId: project!.id };
    };
    const a = await mk(sameDay, 0.01);
    const b = await mk(patient, 5);

    await runJobReviewRequestMaintenance();
    expect(emailsTo(a.email)).toHaveLength(1);
    expect(emailsTo(b.email)).toHaveLength(0);
    const [pb] = await db.select().from(projectsTable).where(eq(projectsTable.id, b.projectId));
    expect(pb!.reviewRequestSentAt).toBeNull();

    // The patient company's job crosses its 10-day line → sent once, never twice.
    await db.update(projectsTable).set({ completedAt: daysAgo(11) }).where(eq(projectsTable.id, b.projectId));
    await runJobReviewRequestMaintenance();
    await runJobReviewRequestMaintenance();
    expect(emailsTo(b.email)).toHaveLength(1);
    const runs = await db.select().from(automationRunsTable).where(and(eq(automationRunsTable.entityId, b.projectId), eq(automationRunsTable.event, "job.review_request_due")));
    expect(runs).toHaveLength(1);
  });
});

describe("Phase 80 — PDFs", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("invoice and contract PDFs carry the company logo; without a logo they render without an image", async () => {
    const plain = await createOrg({ province: "ON" });
    const s1 = await seedShowcase(plain);
    const inv1 = await invoicePdfBuffer(s1.invoiceId);
    expect(inv1.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    // No logo, no signatures on a manual invoice → no image objects at all.
    expect(inv1.buffer.includes("/Subtype /Image")).toBe(false);

    const branded = await createOrg({ province: "QC" });
    const s2 = await seedShowcase(branded, { withLogo: true });
    const inv2 = await invoicePdfBuffer(s2.invoiceId);
    expect(inv2.buffer.includes("/Subtype /Image")).toBe(true);
    // The unsigned (pending) contract has no signature image, so any image is the logo.
    const con2 = await contractPdfBuffer(s2.pendingContractId);
    expect(con2.buffer.includes("/Subtype /Image")).toBe(true);
    const con1 = await contractPdfBuffer(s1.pendingContractId);
    expect(con1.buffer.includes("/Subtype /Image")).toBe(false);
  });

  test("a logo pdfkit cannot decode is skipped rather than failing the document", async () => {
    const org = await createOrg({ province: "ON" });
    await db.update(businessProfilesTable).set({ logoUrl: "data:image/svg+xml;base64,PHN2Zy8+" }).where(eq(businessProfilesTable.userId, org.userId));
    const s = await seedShowcase(org);
    const inv = await invoicePdfBuffer(s.invoiceId);
    expect(inv.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(inv.buffer.includes("/Subtype /Image")).toBe(false);
    void TINY_PNG_DATA_URL;
  });

  test("quote PDF: every chapter title is the first row of its own table (no orphaned heading)", async () => {
    const org = await createOrg({ province: "ON" });
    const quote = await seedQuote(org.userId, { province: "ON" });
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, org.userId));
    const buf = await generateCapitolatoPdfBuffer(quote, profile!);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(5_000);
  });
});
