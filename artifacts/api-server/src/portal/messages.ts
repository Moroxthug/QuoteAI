import { db, clientMessagesTable, projectsTable, businessProfilesTable, authUsersTable, type Client, type ClientMessage } from "@workspace/db";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { getBaseUrl } from "../lib/baseUrl.js";
import { logger } from "../lib/logger.js";
import { createNotification, writeAudit } from "../lib/notifications.js";
import { sendClientMessageEmail, sendClientReplyEmail } from "../lib/emailPortal.js";
import { ensurePortalLink, serializeMessage, type PortalMessage } from "./service.js";

// ── Phase 76: the client ↔ company message thread ───────────────────────────
// One writer for both directions so the dashboard route and the portal route
// behave the same: insert the row, then (best effort) email the other side
// and — for replies — raise a dashboard notification. The email copy is a
// courtesy; the row is the record, so a send failure never fails the post.

export const MAX_MESSAGE_LENGTH = 4000;

async function jobNameMap(userId: string, ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (wanted.length === 0) return new Map();
  const rows = await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(and(eq(projectsTable.userId, userId), inArray(projectsTable.id, wanted)));
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function listThread(client: Pick<Client, "id" | "userId">): Promise<PortalMessage[]> {
  const rows = await db.select().from(clientMessagesTable).where(eq(clientMessagesTable.clientId, client.id)).orderBy(asc(clientMessagesTable.createdAt)).limit(300);
  const names = await jobNameMap(client.userId, rows.map((r) => r.projectId));
  return rows.map((m) => serializeMessage(m, names));
}

/** The company opened the thread: every client message in it is now read. */
export async function markClientMessagesRead(client: Pick<Client, "id">): Promise<number> {
  const rows = await db
    .update(clientMessagesTable)
    .set({ readAt: new Date() })
    .where(and(eq(clientMessagesTable.clientId, client.id), eq(clientMessagesTable.sender, "client"), isNull(clientMessagesTable.readAt)))
    .returning({ id: clientMessagesTable.id });
  return rows.length;
}

export async function postClientMessage(params: {
  client: Client;
  sender: "contractor" | "client";
  senderName: string;
  body: string;
  projectId: string | null;
  ip?: string | null;
  /** Dashboard poster: the acting user (audit). */
  actorUserId?: string | null;
}): Promise<{ message: PortalMessage; emailed: boolean }> {
  const { client } = params;
  const body = params.body.trim().slice(0, MAX_MESSAGE_LENGTH);
  const [row] = await db
    .insert(clientMessagesTable)
    .values({ userId: client.userId, clientId: client.id, projectId: params.projectId, sender: params.sender, senderName: params.senderName.slice(0, 120), body, ip: params.ip ?? null })
    .returning();
  const names = await jobNameMap(client.userId, [params.projectId]);
  const jobName = params.projectId ? (names.get(params.projectId) ?? null) : null;

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, client.userId));
  const lang = client.preferredLanguage === "fr" ? "fr" : "en";
  let emailed = false;

  if (params.sender === "contractor") {
    const portalUrl = await ensurePortalLink(client);
    if (client.email && portalUrl) {
      try {
        await sendClientMessageEmail({ toEmail: client.email, clientName: client.name, companyName: profile?.companyName || "QuoteAI", senderName: params.senderName, body, jobName, portalUrl, language: lang, logoUrl: profile?.logoUrl ?? null, replyTo: profile?.email ?? null });
        emailed = true;
      } catch (err) {
        logger.warn({ err, clientId: client.id }, "Client message email not sent");
      }
    }
    await writeAudit({ userId: client.userId, actorType: "user", actorId: params.actorUserId ?? null, entityType: "client", entityId: client.id, action: "message_sent", diff: { messageId: row!.id, projectId: params.projectId, emailed }, ip: params.ip ?? null });
  } else {
    const link = params.projectId ? `/dashboard/jobs/${params.projectId}?tab=messages` : `/dashboard/clients/${client.id}`;
    await createNotification({
      userId: client.userId,
      type: "client_message",
      title: jobName ? `${client.name} replied about ${jobName}` : `${client.name} sent you a message`,
      body: body.slice(0, 280),
      link,
      entityType: "client",
      entityId: client.id,
    });
    const [owner] = await db.select({ email: authUsersTable.email }).from(authUsersTable).where(eq(authUsersTable.id, client.userId));
    const toEmail = profile?.email || owner?.email;
    if (toEmail) {
      try {
        await sendClientReplyEmail({ toEmail, clientName: client.name, body, jobName, dashboardUrl: `${getBaseUrl()}${link}`, language: profile?.province === "QC" ? "fr" : "en" });
        emailed = true;
      } catch (err) {
        logger.warn({ err, clientId: client.id }, "Client reply email not sent");
      }
    }
    await writeAudit({ userId: client.userId, actorType: "customer", actorId: client.id, entityType: "client", entityId: client.id, action: "message_received", diff: { messageId: row!.id, projectId: params.projectId }, ip: params.ip ?? null });
  }

  if (emailed) await db.update(clientMessagesTable).set({ emailedAt: new Date() }).where(eq(clientMessagesTable.id, row!.id));
  const stored: ClientMessage = { ...row!, emailedAt: emailed ? new Date() : null };
  return { message: serializeMessage(stored, names), emailed };
}
