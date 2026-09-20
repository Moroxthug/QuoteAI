// Phase 63 — the two cron-driven messaging sequences (Phases 9 and 10):
//  • lead capture → 1/3/7-day follow-up sequence, and the unsubscribe stop.
//  • completed job → one review request, and the one-shot gate that keeps a
//    second tick from sending it again.
// Emails are captured by the Resend mock (mailbox.ts), never delivered.
//
// "Frozen clock": the maintenance functions take a `now`, but a future `now`
// would also sweep every other tenant’s due rows in a shared database. So
// instead of moving the clock we move the row’s due date into the past and
// tick at the real `now` — same code path, scoped to our fixtures.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, leadsTable, leadEventsTable, projectsTable, clientsTable, automationRunsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import "../automations/index.js";
import { runLeadMaintenance } from "../leads/maintenance.js";
import { runJobReviewRequestMaintenance } from "../jobs/maintenance.js";
import { FOLLOWUP_CADENCE_DAYS } from "../lib/leadMessaging.js";
import { REVIEW_REQUEST_DELAY_DAYS } from "../lib/jobMessaging.js";
import { startServer, stopServer, createOrg, cleanupAll, api, daysAgo } from "./harness.js";
import { emailsTo } from "./mailbox.js";

describe("follow-up sequences", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("lead: every cadence stage fires exactly once, then the sequence ends", async () => {
    const org = await createOrg();
    const leadEmail = `lead-${org.userId}@example.invalid`;
    const created = await org.api("/api/leads", { body: { name: "Sam Prospect", email: leadEmail, preferredLanguage: "en" } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const leadId = created.body.lead.id as string;
    expect(new Date(created.body.lead.nextFollowUpAt).getTime()).toBeGreaterThan(Date.now());

    // Tick before anything is due: nothing raised for this lead.
    await runLeadMaintenance(new Date());
    let [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
    expect(lead!.followUpStage).toBe(0);
    expect(emailsTo(leadEmail)).toHaveLength(0);

    // Walk the sequence one stage at a time.
    for (let stage = 0; stage < FOLLOWUP_CADENCE_DAYS.length; stage++) {
      [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
      expect(lead!.nextFollowUpAt, `stage ${stage} should be scheduled`).not.toBeNull();
      expect(lead!.nextFollowUpAt!.getTime() - Date.now()).toBeGreaterThan((FOLLOWUP_CADENCE_DAYS[stage]! - 1) * 86_400_000);
      await db.update(leadsTable).set({ nextFollowUpAt: daysAgo(0.01) }).where(eq(leadsTable.id, leadId));

      await runLeadMaintenance();
      // A second tick must be a no-op (idempotency key = lead + stage).
      await runLeadMaintenance();

      [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
      expect(lead!.followUpStage).toBe(stage + 1);
      expect(lead!.status).toBe("contacted");
      expect(emailsTo(leadEmail)).toHaveLength(stage + 1);
    }
    expect(lead!.nextFollowUpAt).toBeNull();

    const sentEvents = await db.select().from(leadEventsTable).where(and(eq(leadEventsTable.leadId, leadId), eq(leadEventsTable.type, "message_sent")));
    expect(sentEvents).toHaveLength(FOLLOWUP_CADENCE_DAYS.length);
    const runs = await db.select().from(automationRunsTable).where(and(eq(automationRunsTable.entityId, leadId), eq(automationRunsTable.event, "lead.followup_due")));
    expect(runs).toHaveLength(FOLLOWUP_CADENCE_DAYS.length);
    expect(runs.every((r) => r.status === "succeeded")).toBe(true);
  });

  test("lead: unsubscribe stops the sequence", async () => {
    const org = await createOrg();
    const leadEmail = `lead-unsub-${org.userId}@example.invalid`;
    const created = await org.api("/api/leads", { body: { name: "Quiet Prospect", email: leadEmail } });
    const leadId = created.body.lead.id as string;
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));

    const unsub = await api(`/api/public/leads/unsubscribe?token=${encodeURIComponent(lead!.unsubscribeToken)}`);
    expect([200, 302]).toContain(unsub.status);
    const [after] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
    expect(after!.unsubscribedAt).not.toBeNull();

    await db.update(leadsTable).set({ nextFollowUpAt: daysAgo(0.01) }).where(eq(leadsTable.id, leadId));
    await runLeadMaintenance();
    expect(emailsTo(leadEmail)).toHaveLength(0);
    const [final] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
    expect(final!.followUpStage).toBe(0);
  });

  test("job: review request goes out once and only once", async () => {
    const org = await createOrg({ profile: { sendReviewRequests: true, googleReviewUrl: "https://g.page/r/e2e/review" } });
    const clientEmail = `client-review-${org.userId}@example.invalid`;
    const [client] = await db.insert(clientsTable).values({ userId: org.userId, name: "Review Client", email: clientEmail, dedupKey: `review-${org.userId}` }).returning();
    const [project] = await db
      .insert(projectsTable)
      .values({ userId: org.userId, clientId: client!.id, name: "Finished deck", status: "completed", completedAt: daysAgo(REVIEW_REQUEST_DELAY_DAYS + 1) })
      .returning();

    // Too early: completed less than the delay ago → not raised.
    await runJobReviewRequestMaintenance(daysAgo(2));
    expect(emailsTo(clientEmail)).toHaveLength(0);

    await runJobReviewRequestMaintenance();
    const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, project!.id));
    expect(p!.reviewRequestSentAt).not.toBeNull();
    expect(emailsTo(clientEmail)).toHaveLength(1);

    // The gate: a later tick never sends again.
    await runJobReviewRequestMaintenance();
    expect(emailsTo(clientEmail)).toHaveLength(1);
    const runs = await db.select().from(automationRunsTable).where(and(eq(automationRunsTable.entityId, project!.id), eq(automationRunsTable.event, "job.review_request_due")));
    expect(runs).toHaveLength(1);
  });

  test("job: review request is skipped when the client unsubscribed from marketing", async () => {
    const org = await createOrg({ profile: { sendReviewRequests: true, googleReviewUrl: "https://g.page/r/e2e/review" } });
    const clientEmail = `client-nomarketing-${org.userId}@example.invalid`;
    const [client] = await db.insert(clientsTable).values({ userId: org.userId, name: "Opted Out", email: clientEmail, dedupKey: `optout-${org.userId}`, marketingUnsubscribedAt: new Date() }).returning();
    const [project] = await db
      .insert(projectsTable)
      .values({ userId: org.userId, clientId: client!.id, name: "Done job", status: "completed", completedAt: daysAgo(REVIEW_REQUEST_DELAY_DAYS + 1) })
      .returning();
    await runJobReviewRequestMaintenance();
    const [p] = await db.select().from(projectsTable).where(eq(projectsTable.id, project!.id));
    expect(p!.reviewRequestSentAt).toBeNull();
    expect(emailsTo(clientEmail)).toHaveLength(0);
  });
});
