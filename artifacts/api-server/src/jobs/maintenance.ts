import { db, projectsTable, businessProfilesTable } from "@workspace/db";
import { and, eq, isNull, isNotNull, lte } from "drizzle-orm";
import { raiseAutomation } from "../lib/automation.js";
import { reviewRequestDelayDays } from "../lib/followupCadence.js";

// ── Daily review-request scan (cron) ────────────────────────────────────────
// Mirrors leads/maintenance.ts: a daily sweep finds jobs completed at least
// the company's review delay ago (automation_settings.reviewRequestDelayDays,
// Phase 80 — it used to be a constant 3) that haven't had a review request
// sent yet, and raises `job.review_request_due` once per job (idempotency
// key keyed on the job id alone — this is a single-shot send, not a stage
// sequence). The widest delay bounds the SQL cutoff; the per-company delay
// is applied on the rows that come back.
const MAX_DELAY_DAYS = 90;

export async function runJobReviewRequestMaintenance(now = new Date()): Promise<{ raised: number }> {
  const rows = await db
    .select({ project: projectsTable, automationSettings: businessProfilesTable.automationSettings })
    .from(projectsTable)
    .leftJoin(businessProfilesTable, eq(businessProfilesTable.userId, projectsTable.userId))
    .where(
      and(
        eq(projectsTable.status, "completed"),
        isNotNull(projectsTable.completedAt),
        lte(projectsTable.completedAt, now),
        isNull(projectsTable.reviewRequestSentAt),
      ),
    )
    .limit(500);

  let raised = 0;
  for (const { project, automationSettings } of rows) {
    const delay = Math.min(MAX_DELAY_DAYS, reviewRequestDelayDays(automationSettings));
    if (project.completedAt!.getTime() > now.getTime() - delay * 86_400_000) continue;
    await raiseAutomation({
      event: "job.review_request_due",
      userId: project.userId,
      entityType: "project",
      entityId: project.id,
      idempotencyKey: `job.review_request_due:${project.id}`,
    });
    raised++;
  }
  return { raised };
}
