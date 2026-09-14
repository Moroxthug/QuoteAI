import { db, leadsTable, leadEventsTable, businessProfilesTable, whatsappConnectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { registerAutomation } from "../lib/automation.js";
import { sendLeadFollowup, FOLLOWUP_CADENCE_DAYS } from "../lib/leadMessaging.js";
import { logger } from "../lib/logger.js";

// lead.followup_due → send the next sequence message and schedule the one
// after it, or stop the sequence once the cadence (or a stop-condition) is
// exhausted. Stop conditions: unsubscribed, status moved to won/lost/quoted
// out of the loop, or the lead already advanced past this stage (a stale
// retry of an already-superseded run).
registerAutomation("lead.followup_due", async (run) => {
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, run.entityId));
  if (!lead) throw new Error(`Lead ${run.entityId} not found`);

  const runStage = (run.payload as { stage?: number })?.stage ?? lead.followUpStage;
  if (lead.unsubscribedAt || !["new", "contacted"].includes(lead.status)) {
    return { skipped: "lead no longer eligible" };
  }
  if (runStage !== lead.followUpStage) {
    return { skipped: "stage already advanced" };
  }

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, lead.userId));
  if (!profile) throw new Error(`Business profile ${lead.userId} not found`);

  const [wa] = await db.select().from(whatsappConnectionsTable).where(eq(whatsappConnectionsTable.userId, lead.userId));
  const whatsappTemplateName = wa?.isEnabled ? (process.env.WHATSAPP_LEAD_FOLLOWUP_TEMPLATE ?? null) : null;

  const result = await sendLeadFollowup({ lead, profile, stage: lead.followUpStage, whatsappTemplateName });

  if (!result.ok) {
    await db.insert(leadEventsTable).values({ leadId: lead.id, userId: lead.userId, type: "message_failed", payload: { stage: lead.followUpStage, reason: result.reason } });
    throw new Error(`Lead follow-up send failed: ${result.reason}`);
  }

  await db.insert(leadEventsTable).values({ leadId: lead.id, userId: lead.userId, type: "message_sent", channel: result.channel, payload: { stage: lead.followUpStage } });

  const nextStage = lead.followUpStage + 1;
  const nextDelayDays = FOLLOWUP_CADENCE_DAYS[nextStage];
  const nextFollowUpAt = nextDelayDays !== undefined ? new Date(Date.now() + nextDelayDays * 86_400_000) : null;

  await db
    .update(leadsTable)
    .set({
      followUpStage: nextStage,
      lastContactedAt: new Date(),
      nextFollowUpAt,
      status: lead.status === "new" ? "contacted" : lead.status,
    })
    .where(eq(leadsTable.id, lead.id));

  logger.info({ leadId: lead.id, stage: lead.followUpStage, channel: result.channel, sequenceDone: nextFollowUpAt === null }, "Lead follow-up sent");
  return { sent: true, channel: result.channel, nextFollowUpAt };
});
