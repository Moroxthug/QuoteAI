import { db, leadsTable } from "@workspace/db";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { raiseAutomation } from "../lib/automation.js";

// ── Daily lead follow-up scan (cron) ────────────────────────────────────────
// Mirrors invoices/maintenance.ts: a daily sweep finds leads whose next
// follow-up is due and raises `lead.followup_due`, one automation_runs row
// per (lead, stage) so a partial failure retries via the normal backoff
// without re-sending a stage that already succeeded.
export async function runLeadMaintenance(now = new Date()): Promise<{ raised: number }> {
  const due = await db
    .select()
    .from(leadsTable)
    .where(
      and(
        inArray(leadsTable.status, ["new", "contacted"]),
        isNull(leadsTable.unsubscribedAt),
        lte(leadsTable.nextFollowUpAt, now),
      ),
    )
    .limit(200);

  let raised = 0;
  for (const lead of due) {
    if (!lead.nextFollowUpAt) continue;
    await raiseAutomation({
      event: "lead.followup_due",
      userId: lead.userId,
      entityType: "lead",
      entityId: lead.id,
      idempotencyKey: `lead.followup_due:${lead.id}:${lead.followUpStage}`,
      payload: { stage: lead.followUpStage },
    });
    raised++;
  }
  return { raised };
}
