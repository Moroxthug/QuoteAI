import { db, quotesTable } from "@workspace/db";
import { and, isNull, lte, ne } from "drizzle-orm";
import { raiseAutomation } from "../lib/automation.js";

// ── Daily quote follow-up scan (cron) ───────────────────────────────────────
// Mirrors leads/maintenance.ts: a daily sweep finds sent quotes whose next
// follow-up is due and raises `quote.followup_due`, one automation_runs row
// per (quote, stage) so a partial failure retries via the normal backoff
// without re-sending a stage that already succeeded.
export async function runQuoteFollowupMaintenance(now = new Date()): Promise<{ raised: number }> {
  const due = await db
    .select()
    .from(quotesTable)
    .where(
      and(
        ne(quotesTable.status, "accepted"),
        isNull(quotesTable.unsubscribedAt),
        lte(quotesTable.nextFollowUpAt, now),
      ),
    )
    .limit(200);

  let raised = 0;
  for (const quote of due) {
    if (!quote.nextFollowUpAt) continue;
    await raiseAutomation({
      event: "quote.followup_due",
      userId: quote.userId,
      entityType: "quote",
      entityId: quote.id,
      idempotencyKey: `quote.followup_due:${quote.id}:${quote.followUpStage}`,
      payload: { stage: quote.followUpStage },
    });
    raised++;
  }
  return { raised };
}
