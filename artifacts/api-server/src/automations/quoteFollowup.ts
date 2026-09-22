import { db, quotesTable, businessProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { registerAutomation } from "../lib/automation.js";
import { sendQuoteFollowup } from "../lib/quoteMessaging.js";
import { quoteFollowupDays, stageDueAt } from "../lib/followupCadence.js";
import { logger } from "../lib/logger.js";

// quote.followup_due → send the next reminder and schedule the one after it,
// or stop the sequence once the cadence (or a stop-condition) is exhausted.
// Stop conditions: unsubscribed, quote already accepted, or the quote already
// advanced past this stage (a stale retry of an already-superseded run).
registerAutomation("quote.followup_due", async (run) => {
  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, run.entityId));
  if (!quote) throw new Error(`Quote ${run.entityId} not found`);

  const runStage = (run.payload as { stage?: number })?.stage ?? quote.followUpStage;
  if (quote.unsubscribedAt || quote.status === "accepted") {
    return { skipped: "quote no longer eligible" };
  }
  if (runStage !== quote.followUpStage) {
    return { skipped: "stage already advanced" };
  }

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, quote.userId));
  if (!profile) throw new Error(`Business profile ${quote.userId} not found`);

  const result = await sendQuoteFollowup({ quote, profile, stage: quote.followUpStage });

  if (!result.ok) {
    throw new Error(`Quote follow-up send failed: ${result.reason}`);
  }

  const nextStage = quote.followUpStage + 1;
  const nextFollowUpAt = stageDueAt(quoteFollowupDays(profile.automationSettings), nextStage);

  await db
    .update(quotesTable)
    .set({ followUpStage: nextStage, nextFollowUpAt })
    .where(eq(quotesTable.id, quote.id));

  logger.info({ quoteId: quote.id, stage: quote.followUpStage, sequenceDone: nextFollowUpAt === null }, "Quote follow-up sent");
  return { sent: true, nextFollowUpAt };
});
