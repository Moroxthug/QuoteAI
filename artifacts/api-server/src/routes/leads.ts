import { Router } from "express";
import { z } from "zod";
import { db, leadsTable, leadEventsTable, businessProfilesTable, whatsappConnectionsTable, LEAD_STATUSES, LEAD_CHANNELS } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { sendLeadFollowup } from "../lib/leadMessaging.js";
import { automationSettingsFor, leadFollowupDays, stageDueAt } from "../lib/followupCadence.js";

const router = Router();

// GET /api/leads — the /dashboard/leads list, optionally filtered by status.
router.get("/leads", requireAuth, requirePermission("leads", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const status = z.enum(LEAD_STATUSES).optional().safeParse(req.query.status).data;
    const rows = await db
      .select()
      .from(leadsTable)
      .where(status ? and(eq(leadsTable.userId, userId), eq(leadsTable.status, status)) : eq(leadsTable.userId, userId))
      .orderBy(desc(leadsTable.createdAt))
      .limit(300);
    res.json({ items: rows });
  } catch (err) {
    req.log.error({ err }, "Error listing leads");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/leads — manual entry (phone call, walk-in, referral).
router.post("/leads", requireAuth, requirePermission("leads", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z
      .object({
        name: z.string().min(1).max(200),
        email: z.string().email().optional(),
        phone: z.string().max(30).optional(),
        preferredLanguage: z.enum(["en", "fr"]).optional(),
        preferredChannel: z.enum(LEAD_CHANNELS).optional(),
        notes: z.string().max(2000).optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const [lead] = await db
      .insert(leadsTable)
      .values({
        userId,
        name: d.name,
        email: d.email ?? null,
        phone: d.phone ?? null,
        preferredLanguage: d.preferredLanguage ?? "en",
        preferredChannel: d.preferredChannel ?? "email",
        source: "manual",
        status: "new",
        consentSource: "manual_entry",
        notes: d.notes ?? "",
        nextFollowUpAt: stageDueAt(leadFollowupDays(await automationSettingsFor(userId)), 0),
      })
      .returning();
    await db.insert(leadEventsTable).values({ leadId: lead!.id, userId, type: "created", payload: { source: "manual" } });
    await db.insert(leadEventsTable).values({ leadId: lead!.id, userId, type: "consent_recorded", payload: { consentSource: "manual_entry" } });
    // Phase 74: texting needs its own recorded basis — the channel the lead asked for, on the consent already captured.
    if (lead!.preferredChannel === "sms") await db.insert(leadEventsTable).values({ leadId: lead!.id, userId, type: "consent_recorded", channel: "sms", payload: { consentSource: "manual_entry", channel: "sms" } });
    res.status(201).json({ lead });
  } catch (err) {
    req.log.error({ err }, "Error creating lead");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/leads/:id — detail + event/message history.
router.get("/leads/:id", requireAuth, requirePermission("leads", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [lead] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, req.params.id as string), eq(leadsTable.userId, userId)));
    if (!lead) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const events = await db.select().from(leadEventsTable).where(eq(leadEventsTable.leadId, lead.id)).orderBy(desc(leadEventsTable.createdAt)).limit(200);
    res.json({ lead, events });
  } catch (err) {
    req.log.error({ err }, "Error loading lead");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/leads/:id — status, notes, or channel/language changes. Setting
// status to won/lost/unsubscribed stops the follow-up sequence.
router.patch("/leads/:id", requireAuth, requirePermission("leads", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z
      .object({
        status: z.enum(LEAD_STATUSES).optional(),
        notes: z.string().max(2000).optional(),
        preferredChannel: z.enum(LEAD_CHANNELS).optional(),
        preferredLanguage: z.enum(["en", "fr"]).optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const [existing] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, req.params.id as string), eq(leadsTable.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const d = body.data;
    const stopping = d.status && ["won", "lost", "unsubscribed"].includes(d.status);
    const [lead] = await db
      .update(leadsTable)
      .set({
        ...(d.status ? { status: d.status } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
        ...(d.preferredChannel ? { preferredChannel: d.preferredChannel } : {}),
        ...(d.preferredLanguage ? { preferredLanguage: d.preferredLanguage } : {}),
        ...(stopping ? { nextFollowUpAt: null } : {}),
        ...(d.status === "unsubscribed" ? { unsubscribedAt: new Date() } : {}),
      })
      .where(eq(leadsTable.id, existing.id))
      .returning();
    if (d.status && d.status !== existing.status) {
      await db.insert(leadEventsTable).values({ leadId: existing.id, userId, type: "status_changed", payload: { from: existing.status, to: d.status } });
    }
    if (d.preferredChannel === "sms" && existing.preferredChannel !== "sms") {
      await db.insert(leadEventsTable).values({ leadId: existing.id, userId, type: "consent_recorded", channel: "sms", payload: { consentSource: existing.consentSource, channel: "sms", actorUserId: getActorUserId(res) } });
    }
    res.json({ lead });
  } catch (err) {
    req.log.error({ err }, "Error updating lead");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/leads/:id/send — manual "send now" outside the automated sequence
// (e.g. the office wants to nudge a lead today instead of waiting for the
// next scheduled stage). Uses the same CASL-compliant template as the
// automated sequence and advances the sequence exactly like an automated send.
router.post("/leads/:id/send", requireAuth, requirePermission("leads", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [lead] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, req.params.id as string), eq(leadsTable.userId, userId)));
    if (!lead) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (lead.unsubscribedAt) {
      res.status(409).json({ error: "UNSUBSCRIBED", message: "This lead has unsubscribed and cannot be messaged." });
      return;
    }
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    if (!profile) {
      res.status(500).json({ error: "Business profile not found" });
      return;
    }
    const [wa] = await db.select().from(whatsappConnectionsTable).where(eq(whatsappConnectionsTable.userId, userId));
    const whatsappTemplateName = wa?.isEnabled ? (process.env.WHATSAPP_LEAD_FOLLOWUP_TEMPLATE ?? null) : null;

    const result = await sendLeadFollowup({ lead, profile, stage: lead.followUpStage, whatsappTemplateName });
    if (!result.ok) {
      await db.insert(leadEventsTable).values({ leadId: lead.id, userId, type: "message_failed", payload: { stage: lead.followUpStage, reason: result.reason, manual: true, actorUserId: getActorUserId(res) } });
      res.status(502).json({ error: "SEND_FAILED", reason: result.reason });
      return;
    }

    await db.insert(leadEventsTable).values({ leadId: lead.id, userId, type: "message_sent", channel: result.channel, payload: { stage: lead.followUpStage, manual: true, actorUserId: getActorUserId(res) } });
    const nextStage = lead.followUpStage + 1;
    const [updated] = await db
      .update(leadsTable)
      .set({
        followUpStage: nextStage,
        lastContactedAt: new Date(),
        nextFollowUpAt: stageDueAt(leadFollowupDays(profile.automationSettings), nextStage),
        status: lead.status === "new" ? "contacted" : lead.status,
      })
      .where(eq(leadsTable.id, lead.id))
      .returning();
    res.json({ lead: updated, channel: result.channel });
  } catch (err) {
    req.log.error({ err }, "Error sending lead follow-up");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
