import { Router } from "express";
import { z } from "zod";
import { db, clientsTable, projectsTable, businessProfilesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId, getUserName } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit } from "../lib/notifications.js";
import { sendPortalInviteEmail } from "../lib/emailPortal.js";
import { ensurePortalLink, unreadClientMessageCount } from "../portal/service.js";
import { listThread, markClientMessagesRead, postClientMessage, MAX_MESSAGE_LENGTH } from "../portal/messages.js";

// ── Phase 76: the contractor's side of the client portal ───────────────────
// The portal link + invitation, and the message thread (read from the job
// page or the client page, written from either). Everything keys on a client
// the acting org owns; a job id, when given, must be that client's job.

const router = Router();

async function ownedClient(userId: string, id: string) {
  const [client] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.userId, userId)));
  return client ?? null;
}

// GET /api/clients/:id/portal — link, invite/visit stamps, unread replies
router.get("/clients/:id/portal", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const client = await ownedClient(userId, req.params.id as string);
    if (!client) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const url = await ensurePortalLink(client);
    res.json({
      url,
      hasEmail: !!client.email,
      email: client.email,
      invitedAt: client.portalInvitedAt?.toISOString() ?? null,
      lastSeenAt: client.portalLastSeenAt?.toISOString() ?? null,
      unread: await unreadClientMessageCount(userId, client.id),
    });
  } catch (err) {
    req.log.error({ err }, "Error loading client portal status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/clients/:id/portal/invite — email the portal link
router.post("/clients/:id/portal/invite", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const client = await ownedClient(userId, req.params.id as string);
    if (!client) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const url = await ensurePortalLink(client);
    if (!client.email || !url) {
      res.status(409).json({ error: "NO_EMAIL", message: "Add an email address to the client first." });
      return;
    }
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    await sendPortalInviteEmail({ toEmail: client.email, clientName: client.name, companyName: profile?.companyName || "QuoteAI", portalUrl: url, language: client.preferredLanguage === "fr" ? "fr" : "en", logoUrl: profile?.logoUrl ?? null, replyTo: profile?.email ?? null });
    const now = new Date();
    await db.update(clientsTable).set({ portalInvitedAt: now }).where(eq(clientsTable.id, client.id));
    await writeAudit({ userId, actorType: "user", actorId: getActorUserId(res), entityType: "client", entityId: client.id, action: "portal_invited", ip: req.ip });
    res.json({ success: true, invitedAt: now.toISOString(), url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Email service not configured") {
      res.status(503).json({ error: "EMAIL_NOT_CONFIGURED" });
      return;
    }
    req.log.error({ err }, "Error sending portal invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/clients/:id/messages — the thread; opening it marks client replies read
router.get("/clients/:id/messages", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const client = await ownedClient(userId, req.params.id as string);
    if (!client) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await markClientMessagesRead(client);
    const messages = await listThread(client);
    res.json({ messages, client: { id: client.id, name: client.name, email: client.email, portalLastSeenAt: client.portalLastSeenAt?.toISOString() ?? null } });
  } catch (err) {
    req.log.error({ err }, "Error loading client thread");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/clients/:id/messages — write to the client (emailed with the portal link)
router.post("/clients/:id/messages", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const client = await ownedClient(userId, req.params.id as string);
    if (!client) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = z.object({ body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH), jobId: z.string().uuid().nullable().optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    let projectId: string | null = null;
    if (body.data.jobId) {
      const [job] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.id, body.data.jobId), eq(projectsTable.userId, userId), eq(projectsTable.clientId, client.id)));
      if (!job) {
        res.status(404).json({ error: "JOB_NOT_FOUND", message: "That job does not belong to this client." });
        return;
      }
      projectId = job.id;
    }
    const [profile] = await db.select({ companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    const senderName = getUserName(res) || profile?.companyName || "";
    const result = await postClientMessage({ client, sender: "contractor", senderName, body: body.data.body, projectId, ip: req.ip, actorUserId: getActorUserId(res) });
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "Error posting client message");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
