import { brandedResend } from "./emailUtils.js";
import { messageEmail } from "./emailContracts.js";
import { logger } from "./logger.js";
import { getBaseUrl } from "./baseUrl.js";
import { DEFAULT_AUTOMATION_SETTINGS, type BusinessProfile, type Lead } from "@workspace/db";
import { sendWhatsappTemplate } from "../routes/whatsapp.js";
import { sendSms } from "./sms.js";

const automationSettings = (profile: BusinessProfile) => ({ ...DEFAULT_AUTOMATION_SETTINGS, ...(profile.automationSettings ?? {}) });

// ── Phase 9: CASL-compliant lead follow-up messaging ────────────────────────
// Every automated message (email or WhatsApp) sent to a lead must carry:
//   1. Sender identification — the company's legal/business name.
//   2. A valid mailing address, plus a phone or email contact method.
//   3. A working unsubscribe mechanism, actionable without delay.
// See docs/GROWTH-PLATFORM-PLAN.md §4.4 / Phase 9. This module is the single
// place that assembles that block so no future template can ship without it.

/** Default follow-up cadence in days-after-previous-stage. Stage 0 fires this many days after the lead is created. */
/** Default cadence — per-company values live in automation_settings.leadFollowupDays (Phase 80, lib/followupCadence.ts). */
export const FOLLOWUP_CADENCE_DAYS = DEFAULT_AUTOMATION_SETTINGS.leadFollowupDays;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeForFromHeader(value: string): string {
  return value.replace(/[\r\n"<>]/g, "").trim().slice(0, 60);
}

function unsubscribeUrl(token: string): string {
  return `${getBaseUrl()}/api/public/leads/unsubscribe?token=${encodeURIComponent(token)}`;
}

function identificationBlockHtml(profile: BusinessProfile, lang: "en" | "fr"): string {
  const company = escapeHtml(profile.companyName || "This company");
  const address = escapeHtml(profile.address || "");
  const contact = [profile.phone, profile.email].filter(Boolean).map(escapeHtml).join(" · ");
  const label = lang === "fr" ? "Envoyé par" : "Sent by";
  return `
    <div style="margin-bottom:8px">
      <div>${label}: <strong>${company}</strong></div>
      ${address ? `<div>${address}</div>` : ""}
      ${contact ? `<div>${contact}</div>` : ""}
    </div>`;
}

function unsubscribeHtml(token: string, lang: "en" | "fr"): string {
  const url = unsubscribeUrl(token);
  const text = lang === "fr"
    ? "Vous ne souhaitez plus recevoir ces messages ?"
    : "Don't want to hear from us again?";
  const link = lang === "fr" ? "Se désabonner" : "Unsubscribe";
  return `
    <div>
      ${text} <a href="${url}">${link}</a>
    </div>`;
}

function followupCopy(stage: number, lang: "en" | "fr"): { subject: string; body: string } {
  const en = [
    { subject: "Still interested in your project?", body: "Just checking in — we'd love to help bring your project to life. Reply to this email or reach out any time." },
    { subject: "Following up on your quote request", body: "We haven't heard back and wanted to make sure your request didn't slip through the cracks. Happy to answer any questions." },
    { subject: "One last check-in", body: "This is our last follow-up for now — if timing wasn't right, no worries. We're here whenever you're ready." },
  ];
  const fr = [
    { subject: "Toujours intéressé par votre projet ?", body: "On voulait juste prendre des nouvelles — on serait ravis de vous aider à réaliser votre projet. Répondez à ce courriel ou contactez-nous en tout temps." },
    { subject: "Suivi de votre demande de soumission", body: "On n'a pas eu de nouvelles et on voulait s'assurer que votre demande ne soit pas passée inaperçue. On répond avec plaisir à vos questions." },
    { subject: "Dernier suivi", body: "Ceci est notre dernier suivi pour l'instant — si le moment n'était pas idéal, pas de souci. On reste disponibles quand vous serez prêt." },
  ];
  const set = lang === "fr" ? fr : en;
  return set[Math.min(stage, set.length - 1)]!;
}

function buildFollowupEmailHtml(params: { clientName: string; profile: BusinessProfile; stage: number; lang: "en" | "fr"; unsubscribeToken: string }): string {
  const { subject, body } = followupCopy(params.stage, params.lang);
  return messageEmail({
    lang: params.lang,
    companyName: params.profile.companyName,
    logoUrl: params.profile.logoUrl || null,
    clientName: params.clientName,
    title: subject,
    bodyHtml: `<p>${escapeHtml(body)}</p>`,
    identificationHtml: identificationBlockHtml(params.profile, params.lang),
    unsubscribeHtml: unsubscribeHtml(params.unsubscribeToken, params.lang),
  });
}

export type LeadFollowupResult =
  | { ok: true; channel: "email" | "whatsapp" | "sms" }
  | { ok: false; reason: string };

/**
 * Sends the follow-up for the given stage over the lead's preferred channel,
 * falling back to email when WhatsApp/SMS isn't available. Never sends to an
 * unsubscribed lead — callers must still check `lead.unsubscribedAt` before
 * calling this (defense in depth, not the only gate).
 */
export async function sendLeadFollowup(params: {
  lead: Lead;
  profile: BusinessProfile;
  stage: number;
  whatsappTemplateName?: string | null;
}): Promise<LeadFollowupResult> {
  const { lead, profile, stage } = params;
  const lang = lead.preferredLanguage === "fr" ? "fr" : "en";

  // Phase 74: a lead who asked for texts gets the same copy by SMS (the
  // identity line and STOP footer are added by sendSms). Only when the
  // company turned SMS follow-ups on; any non-send falls back to email.
  if (lead.preferredChannel === "sms" && lead.phone && automationSettings(profile).smsEnabled) {
    const { subject, body } = followupCopy(stage, lang);
    const sent = await sendSms({ profile, to: lead.phone, body: `${subject} ${body}`, lang, purpose: "lead_followup", relatedEntityType: "lead", relatedEntityId: lead.id });
    if (sent.ok) return { ok: true, channel: "sms" };
    logger.warn({ leadId: lead.id, reason: sent.reason }, "SMS follow-up not sent, falling back to email");
  }

  if (lead.preferredChannel === "whatsapp" && lead.phone && params.whatsappTemplateName) {
    const { subject } = followupCopy(stage, lang);
    const sent = await sendWhatsappTemplate(lead.phone, params.whatsappTemplateName, lang === "fr" ? "fr" : "en_US", [lead.name, subject]);
    if (sent) return { ok: true, channel: "whatsapp" };
    logger.warn({ leadId: lead.id }, "WhatsApp follow-up failed, falling back to email");
  }

  if (!lead.email) return { ok: false, reason: "no_email" };
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "resend_not_configured" };

  const { subject } = followupCopy(stage, lang);
  try {
    const resend = brandedResend(apiKey);
    await resend.emails.send({
      from: `${sanitizeForFromHeader(profile.companyName || "QuoteAI")} via QuoteAI <no-reply@quoteai.ca>`,
      to: [lead.email],
      subject,
      html: buildFollowupEmailHtml({ clientName: lead.name, profile, stage, lang, unsubscribeToken: lead.unsubscribeToken }),
      headers: { "List-Unsubscribe": `<${unsubscribeUrl(lead.unsubscribeToken)}>` },
    });
    return { ok: true, channel: "email" };
  } catch (err) {
    logger.error({ err, leadId: lead.id }, "Lead follow-up email failed");
    return { ok: false, reason: err instanceof Error ? err.message : "send_failed" };
  }
}
