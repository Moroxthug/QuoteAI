import { Resend } from "resend";
import { logger } from "./logger.js";
import { getBaseUrl } from "./baseUrl.js";
import type { BusinessProfile, Client } from "@workspace/db";
import { sendWhatsappTemplate } from "../routes/whatsapp.js";

// ── Phase 10: review requests + shared job photos ───────────────────────────
// Both messages target an existing `clients` row (a customer QuoteAI already
// has a relationship with — implied CASL consent from that relationship), not
// a `leads` row. Same CASL requirements as Phase 9's lead follow-ups
// (identification block + working opt-out), reused in shape but kept in this
// module since the recipient type and opt-out token live on `clients`.

export const REVIEW_REQUEST_DELAY_DAYS = 3;

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

export function marketingUnsubscribeUrl(token: string): string {
  return `${getBaseUrl()}/api/public/clients/unsubscribe?token=${encodeURIComponent(token)}`;
}

function identificationBlockHtml(profile: BusinessProfile, lang: "en" | "fr"): string {
  const company = escapeHtml(profile.companyName || "This company");
  const address = escapeHtml(profile.address || "");
  const contact = [profile.phone, profile.email].filter(Boolean).map(escapeHtml).join(" · ");
  const label = lang === "fr" ? "Envoyé par" : "Sent by";
  return `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.6;">
      <div>${label}: <strong>${company}</strong></div>
      ${address ? `<div>${address}</div>` : ""}
      ${contact ? `<div>${contact}</div>` : ""}
    </div>`;
}

function unsubscribeHtml(token: string, lang: "en" | "fr"): string {
  const url = marketingUnsubscribeUrl(token);
  const text = lang === "fr"
    ? "Vous ne souhaitez plus recevoir ces messages ?"
    : "Don't want to hear from us again?";
  const link = lang === "fr" ? "Se désabonner" : "Unsubscribe";
  return `
    <div style="margin-top:8px;font-size:12px;color:#6b7280;">
      ${text} <a href="${url}" style="color:#2563eb;">${link}</a>
    </div>`;
}

function wrapEmailHtml(params: { clientName: string; profile: BusinessProfile; lang: "en" | "fr"; unsubscribeToken: string; subject: string; bodyHtml: string }): string {
  const greeting = params.lang === "fr" ? `Bonjour ${escapeHtml(params.clientName)},` : `Hi ${escapeHtml(params.clientName)},`;
  const logo = params.profile.logoUrl ? `<img src="${escapeHtml(params.profile.logoUrl)}" alt="" style="max-height:40px;margin-bottom:16px;" />` : "";
  return `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    ${logo}
    <p style="font-size:16px;color:#111827;">${greeting}</p>
    <h2 style="font-size:18px;color:#111827;">${escapeHtml(params.subject)}</h2>
    ${params.bodyHtml}
    ${identificationBlockHtml(params.profile, params.lang)}
    ${unsubscribeHtml(params.unsubscribeToken, params.lang)}
  </div>
</body></html>`;
}

async function sendEmail(params: { to: string; profile: BusinessProfile; subject: string; html: string; unsubscribeToken: string }): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "resend_not_configured" };
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${sanitizeForFromHeader(params.profile.companyName || "QuoteAI")} via QuoteAI <no-reply@quoteai.ca>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      headers: { "List-Unsubscribe": `<${marketingUnsubscribeUrl(params.unsubscribeToken)}>` },
    });
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "Job messaging email failed");
    return { ok: false, reason: err instanceof Error ? err.message : "send_failed" };
  }
}

export type JobMessageResult =
  | { ok: true; channel: "email" | "whatsapp" }
  | { ok: false; reason: string };

function reviewRequestCopy(lang: "en" | "fr", reviewUrl: string): { subject: string; body: string } {
  return lang === "fr"
    ? {
        subject: "Merci pour votre confiance — un mot sur votre expérience ?",
        body: `Votre projet est maintenant terminé. Si vous avez deux minutes, un avis Google nous aide énormément à nous faire connaître : ${reviewUrl}`,
      }
    : {
        subject: "Thanks for your business — got a minute for a review?",
        body: `Your project is now complete. If you have two minutes, a Google review helps us out a lot: ${reviewUrl}`,
      };
}

/** Never sends to a client who has opted out of marketing-type messages — callers must still check `client.marketingUnsubscribedAt` before calling. */
export async function sendJobReviewRequest(params: {
  client: Client;
  profile: BusinessProfile;
  reviewUrl: string;
  homeStarsUrl?: string | null;
  whatsappTemplateName?: string | null;
}): Promise<JobMessageResult> {
  const { client, profile, reviewUrl, homeStarsUrl } = params;
  const lang = client.preferredLanguage === "fr" ? "fr" : "en";
  const { subject, body } = reviewRequestCopy(lang, reviewUrl);

  if (client.phone && params.whatsappTemplateName) {
    // WhatsApp template params are fixed at approval time, so a second (HomeStars) link can't be added here — email-only for now.
    const sent = await sendWhatsappTemplate(client.phone, params.whatsappTemplateName, lang === "fr" ? "fr" : "en_US", [client.name, reviewUrl]);
    if (sent) return { ok: true, channel: "whatsapp" };
    logger.warn({ clientId: client.id }, "WhatsApp review request failed, falling back to email");
  }

  if (!client.email) return { ok: false, reason: "no_email" };
  const homeStarsLine = homeStarsUrl
    ? `<p style="font-size:14px;color:#374151;line-height:1.6;">${lang === "fr" ? "Vous préférez HomeStars ?" : "Prefer HomeStars?"} <a href="${homeStarsUrl}" style="color:#2563eb;">${escapeHtml(homeStarsUrl)}</a></p>`
    : "";
  const bodyHtml = `<p style="font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(body.split(reviewUrl)[0] ?? "")}<a href="${reviewUrl}" style="color:#2563eb;">${escapeHtml(reviewUrl)}</a></p>${homeStarsLine}`;
  const html = wrapEmailHtml({ clientName: client.name, profile, lang, unsubscribeToken: client.marketingUnsubscribeToken, subject, bodyHtml });
  const result = await sendEmail({ to: client.email, profile, subject, html, unsubscribeToken: client.marketingUnsubscribeToken });
  return result.ok ? { ok: true, channel: "email" } : result;
}

function photoShareCopy(lang: "en" | "fr", count: number): { subject: string; body: string } {
  return lang === "fr"
    ? { subject: "Photos de l'avancement de votre projet", body: `Voici ${count > 1 ? `${count} nouvelles photos` : "une nouvelle photo"} de votre projet :` }
    : { subject: "Progress photos from your project", body: `Here ${count > 1 ? `are ${count} new photos` : "is a new photo"} from your project:` };
}

/** `photoUrls` are already-generated (typically signed, time-limited) links — this module doesn't create them. */
export async function sendJobPhotoShare(params: {
  client: Client;
  profile: BusinessProfile;
  photoUrls: string[];
  whatsappTemplateName?: string | null;
}): Promise<JobMessageResult> {
  const { client, profile, photoUrls } = params;
  const lang = client.preferredLanguage === "fr" ? "fr" : "en";
  const { subject, body } = photoShareCopy(lang, photoUrls.length);

  if (client.phone && params.whatsappTemplateName) {
    const sent = await sendWhatsappTemplate(client.phone, params.whatsappTemplateName, lang === "fr" ? "fr" : "en_US", [client.name, String(photoUrls.length)]);
    if (sent) return { ok: true, channel: "whatsapp" };
    logger.warn({ clientId: client.id }, "WhatsApp photo share failed, falling back to email");
  }

  if (!client.email) return { ok: false, reason: "no_email" };
  const links = photoUrls.map((u) => `<div style="margin:8px 0;"><a href="${u}" style="color:#2563eb;">${escapeHtml(u)}</a></div>`).join("");
  const bodyHtml = `<p style="font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(body)}</p>${links}`;
  const html = wrapEmailHtml({ clientName: client.name, profile, lang, unsubscribeToken: client.marketingUnsubscribeToken, subject, bodyHtml });
  const result = await sendEmail({ to: client.email, profile, subject, html, unsubscribeToken: client.marketingUnsubscribeToken });
  return result.ok ? { ok: true, channel: "email" } : result;
}
