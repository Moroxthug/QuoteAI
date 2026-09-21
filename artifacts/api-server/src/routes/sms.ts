import { Router } from "express";
import { z } from "zod";
import { db, businessProfilesTable, smsMessagesTable, DEFAULT_AUTOMATION_SETTINGS } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { createNotification } from "../lib/notifications.js";
import { formatPhone, handleInboundSms, isSmsConfigured, normalizePhone, optOutPhone, sendSms, smsAllowance, smsFromNumberHint, smsUsedThisMonth, verifyTwilioSignature } from "../lib/sms.js";

const router = Router();

// ── Phase 74: SMS channel ───────────────────────────────────────────────────
// Settings → SMS: availability (honest "not configured" like every other
// integration), the two automation toggles, this month's usage against the
// plan allowance, a test send to the contractor's own phone and the message
// log. The Twilio inbound webhook lives here too (public, signature-checked).

function smsWebhookUrl(): string {
  return process.env.TWILIO_WEBHOOK_URL || `${getBaseUrl()}/api/sms/webhook`;
}

router.get("/sms/status", requireAuth, requirePermission("settings", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    const settings = { ...DEFAULT_AUTOMATION_SETTINGS, ...(profile?.automationSettings ?? {}) };
    const allowance = smsAllowance(profile);
    const used = await smsUsedThisMonth(userId);
    const ownPhone = normalizePhone(profile?.phone);
    res.json({
      available: isSmsConfigured(),
      fromNumberHint: smsFromNumberHint(),
      smsEnabled: settings.smsEnabled,
      smsReminders: settings.smsReminders,
      usage: { used, allowance },
      ownPhone: ownPhone ? formatPhone(ownPhone) : null,
      identityLine: `${profile?.companyName || "QuoteAI"}${ownPhone ? ` (${formatPhone(ownPhone)})` : ""}`,
    });
  } catch (err) {
    req.log.error({ err }, "SMS status error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/sms/settings", requireAuth, requirePermission("settings", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z.object({ smsEnabled: z.boolean().optional(), smsReminders: z.boolean().optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const [existing] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    if (!existing) {
      res.status(404).json({ error: "Business profile not found" });
      return;
    }
    const automationSettings = { ...(existing.automationSettings ?? {}), ...body.data };
    await db.update(businessProfilesTable).set({ automationSettings }).where(eq(businessProfilesTable.userId, userId));
    const settings = { ...DEFAULT_AUTOMATION_SETTINGS, ...automationSettings };
    res.json({ smsEnabled: settings.smsEnabled, smsReminders: settings.smsReminders });
  } catch (err) {
    req.log.error({ err }, "SMS settings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sms/test — one text to the company's own phone so the contractor
// sees exactly what their customers will receive (identity line + STOP).
router.post("/sms/test", requireAuth, requirePermission("settings", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    if (!profile) {
      res.status(404).json({ error: "Business profile not found" });
      return;
    }
    if (!isSmsConfigured()) {
      res.status(503).json({ error: "NOT_CONFIGURED", integration: "twilio", message: "SMS isn't available yet — the Twilio number has not been set up." });
      return;
    }
    if (!normalizePhone(profile.phone)) {
      res.status(400).json({ error: "NO_PHONE", message: "Add your business phone number in Settings → Account first." });
      return;
    }
    const lang = z.enum(["en", "fr"]).safeParse(req.body?.lang).data ?? "en";
    const body = lang === "fr" ? "Ceci est un texto de test envoyé depuis QuoteAI. Vos clients recevront vos messages dans ce format." : "This is a test text from QuoteAI. Your customers will receive your messages in this format.";
    const result = await sendSms({ profile, to: profile.phone, body, lang, purpose: "test" });
    if (!result.ok) {
      res.status(result.reason === "allowance_exceeded" ? 402 : 502).json({ error: "SEND_FAILED", reason: result.reason });
      return;
    }
    res.json({ ok: true, segments: result.segments, body: result.body });
  } catch (err) {
    req.log.error({ err }, "SMS test error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/sms/messages", requireAuth, requirePermission("settings", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const rows = await db.select().from(smsMessagesTable).where(eq(smsMessagesTable.userId, userId)).orderBy(desc(smsMessagesTable.createdAt)).limit(limit);
    res.json({ items: rows.map((r) => ({ ...r, phone: formatPhone(r.phone) })) });
  } catch (err) {
    req.log.error({ err }, "SMS messages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sms/opt-out — the customer asked (in person, by email) not to be
// texted: same effect as a STOP reply, recorded as a manual opt-out.
router.post("/sms/opt-out", requireAuth, requirePermission("leads", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const phone = normalizePhone(z.string().max(30).safeParse(req.body?.phone).data);
    if (!phone) {
      res.status(400).json({ error: "INVALID_PHONE" });
      return;
    }
    await optOutPhone(phone, userId);
    res.json({ ok: true, phone: formatPhone(phone) });
  } catch (err) {
    req.log.error({ err }, "SMS opt-out error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Twilio inbound webhook ──────────────────────────────────────────────────
// Configured in the Twilio console as the number's "A message comes in"
// URL (see docs/RUNBOOKS.md §11). Twilio posts form fields and signs the
// exact URL + fields with the auth token; nothing is accepted without a
// valid signature, so a spoofed STOP cannot unsubscribe anyone.
const webhookLimiter = ipRateLimiter({ windowMs: 60_000, max: 120, message: "Too many requests" });

router.post("/sms/webhook", webhookLimiter, async (req, res) => {
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries((req.body ?? {}) as Record<string, unknown>)) fields[k] = Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
  const sigHeader = req.headers["x-twilio-signature"];
  const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
  if (!process.env.TWILIO_AUTH_TOKEN) {
    res.status(503).type("text/xml").send("<Response></Response>");
    return;
  }
  if (!verifyTwilioSignature(signature, smsWebhookUrl(), fields)) {
    req.log.warn({ from: fields.From }, "Twilio webhook signature mismatch — rejected");
    res.status(403).type("text/xml").send("<Response></Response>");
    return;
  }
  try {
    const from = fields.From ?? "";
    const body = fields.Body ?? "";
    if (!from) {
      res.status(200).type("text/xml").send("<Response></Response>");
      return;
    }
    const outcome = await handleInboundSms({ from, body, providerSid: fields.MessageSid ?? null });
    if (outcome.userId) {
      const phone = formatPhone(outcome.phone);
      if (outcome.kind === "reply") {
        await createNotification({
          userId: outcome.userId,
          type: "sms_reply",
          title: `Text reply from ${phone}`,
          body: body.slice(0, 280),
          link: "/dashboard/settings?tab=sms",
        });
      } else if (outcome.kind === "opt_out") {
        await createNotification({
          userId: outcome.userId,
          type: "sms_opt_out",
          title: `${phone} opted out of texts`,
          body: "They replied STOP. QuoteAI will not text this number again and any lead or client with it is now unsubscribed.",
          link: "/dashboard/leads",
        });
      }
    }
    // No auto-reply: Twilio sends the carrier-mandated STOP/START confirmations itself.
    res.status(200).type("text/xml").send("<Response></Response>");
  } catch (err) {
    req.log.error({ err }, "Twilio inbound webhook failed");
    res.status(500).type("text/xml").send("<Response></Response>");
  }
});

export default router;

