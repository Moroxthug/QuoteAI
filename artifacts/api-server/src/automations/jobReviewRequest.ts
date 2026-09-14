import { db, projectsTable, clientsTable, businessProfilesTable, whatsappConnectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { registerAutomation } from "../lib/automation.js";
import { sendJobReviewRequest } from "../lib/jobMessaging.js";
import { writeAudit } from "../lib/notifications.js";
import { logger } from "../lib/logger.js";

// job.review_request_due → send one review-request message per completed job.
// One-shot (unlike the lead follow-up sequence): `projects.review_request_sent_at`
// is the gate, set on success so the daily scan (jobs/maintenance.ts) never
// raises this event twice for the same job.
registerAutomation("job.review_request_due", async (run) => {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, run.entityId));
  if (!project) throw new Error(`Project ${run.entityId} not found`);
  if (project.status !== "completed") return { skipped: "job no longer completed" };
  if (project.reviewRequestSentAt) return { skipped: "already sent" };
  if (!project.clientId) return { skipped: "no client on job" };

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, run.userId));
  if (!profile) throw new Error(`Business profile ${run.userId} not found`);
  if (!profile.sendReviewRequests || !profile.googleReviewUrl) return { skipped: "review requests disabled or no review link set" };

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, project.clientId));
  if (!client) return { skipped: "client not found" };
  if (client.marketingUnsubscribedAt) return { skipped: "client unsubscribed" };

  const [wa] = await db.select().from(whatsappConnectionsTable).where(eq(whatsappConnectionsTable.userId, run.userId));
  const whatsappTemplateName = wa?.isEnabled ? (process.env.WHATSAPP_REVIEW_REQUEST_TEMPLATE ?? null) : null;

  const result = await sendJobReviewRequest({ client, profile, reviewUrl: profile.googleReviewUrl, whatsappTemplateName });
  if (!result.ok) {
    await writeAudit({ userId: run.userId, actorType: "system", entityType: "project", entityId: project.id, action: "review_request_failed", diff: { reason: result.reason } });
    throw new Error(`Review request send failed: ${result.reason}`);
  }

  await db.update(projectsTable).set({ reviewRequestSentAt: new Date() }).where(eq(projectsTable.id, project.id));
  await writeAudit({ userId: run.userId, actorType: "system", entityType: "project", entityId: project.id, action: "review_request_sent", diff: { channel: result.channel, clientId: client.id } });
  logger.info({ projectId: project.id, channel: result.channel }, "Review request sent");
  return { sent: true, channel: result.channel };
});
