import { db, projectsTable } from "@workspace/db";
import { and, eq, isNull, isNotNull, lte } from "drizzle-orm";
import { raiseAutomation } from "../lib/automation.js";
import { REVIEW_REQUEST_DELAY_DAYS } from "../lib/jobMessaging.js";

// ── Daily review-request scan (cron) ────────────────────────────────────────
// Mirrors leads/maintenance.ts: a daily sweep finds jobs completed at least
// REVIEW_REQUEST_DELAY_DAYS ago that haven't had a review request sent yet,
// and raises `job.review_request_due` once per job (idempotency key keyed on
// the job id alone — this is a single-shot send, not a stage sequence).
export async function runJobReviewRequestMaintenance(now = new Date()): Promise<{ raised: number }> {
  const cutoff = new Date(now.getTime() - REVIEW_REQUEST_DELAY_DAYS * 86_400_000);

  const due = await db
    .select()
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.status, "completed"),
        isNotNull(projectsTable.completedAt),
        lte(projectsTable.completedAt, cutoff),
        isNull(projectsTable.reviewRequestSentAt),
      ),
    )
    .limit(200);

  let raised = 0;
  for (const project of due) {
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
