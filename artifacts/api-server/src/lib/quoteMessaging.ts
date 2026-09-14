import { Resend } from "resend";
import { logger } from "./logger.js";
import { getBaseUrl } from "./baseUrl.js";
import { sanitizeForFromHeader } from "./emailUtils.js";
import type { BusinessProfile, Quote, QuoteClientData, QuoteCompanySnapshot } from "@workspace/db";

// ── Phase 21: quote-sent follow-up reminders ────────────────────────────────
// A quote gets emailed to a customer and, if they never accept, nothing
// follows up — every other funnel stage (leads, reviews, invoices) already
// has one. Reuses the identification-block/unsubscribe machinery built for
// Phase 9 leads (leadMessaging.ts) verbatim, keyed on the quote's own
// unsubscribeToken since a quote isn't always linked to a clients row.

/** Default follow-up cadence in days-after-sentAt. Stage 0 fires this many days after the quote is sent. */
export const QUOTE_FOLLOWUP_CADENCE_DAYS = [2, 5, 10] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function quoteUnsubscribeUrl(token: string): string {
  return `${getBaseUrl()}/api/public/quotes/unsubscribe?token=${encodeURIComponent(token)}`;
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
  const url = quoteUnsubscribeUrl(token);
  const text = lang === "fr"
    ? "Vous ne souhaitez plus recevoir ces rappels ?"
    : "Don't want to receive reminders about this quote?";
  const link = lang === "fr" ? "Se désabonner" : "Unsubscribe";
  return `
    <div style="margin-top:8px;font-size:12px;color:#6b7280;">
      ${text} <a href="${url}" style="color:#2563eb;">${link}</a>
    </div>`;
}

function followupCopy(stage: number, lang: "en" | "fr", quoteNumber: string, totale: string): { subject: string; body: string } {
  const en = [
    { subject: `Still thinking it over? (Quote ${quoteNumber})`, body: `Just checking in on your quote for ${totale} — happy to answer any questions or make adjustments.` },
    { subject: `Following up on your quote (${quoteNumber})`, body: `We haven't heard back and wanted to make sure it didn't slip through the cracks. Reply any time if you'd like to move forward or have questions.` },
    { subject: `One last check-in on quote ${quoteNumber}`, body: `This is our last reminder for now — if timing wasn't right, no worries. We're here whenever you're ready.` },
  ];
  const fr = [
    { subject: `Toujours en réflexion ? (Soumission ${quoteNumber})`, body: `On voulait prendre des nouvelles au sujet de votre soumission de ${totale} — n'hésitez pas si vous avez des questions ou souhaitez des ajustements.` },
    { subject: `Suivi de votre soumission (${quoteNumber})`, body: `On n'a pas eu de nouvelles et on voulait s'assurer que votre soumission ne soit pas passée inaperçue. Répondez en tout temps si vous souhaitez avancer ou avez des questions.` },
    { subject: `Dernier suivi pour la soumission ${quoteNumber}`, body: `Ceci est notre dernier rappel pour l'instant — si le moment n'était pas idéal, pas de souci. On reste disponibles quand vous serez prêt.` },
  ];
  const set = lang === "fr" ? fr : en;
  return set[Math.min(stage, set.length - 1)]!;
}

function buildFollowupEmailHtml(params: {
  clientName: string;
  profile: BusinessProfile;
  stage: number;
  lang: "en" | "fr";
  unsubscribeToken: string;
  quoteNumber: string;
  totale: string;
  publicUrl: string | null;
}): string {
  const { subject, body } = followupCopy(params.stage, params.lang, params.quoteNumber, params.totale);
  const greeting = params.lang === "fr" ? `Bonjour ${escapeHtml(params.clientName)},` : `Hi ${escapeHtml(params.clientName)},`;
  const logo = params.profile.logoUrl ? `<img src="${escapeHtml(params.profile.logoUrl)}" alt="" style="max-height:40px;margin-bottom:16px;" />` : "";
  const cta = params.publicUrl
    ? `<p style="margin-top:24px;"><a href="${escapeHtml(params.publicUrl)}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">${params.lang === "fr" ? "Voir la soumission" : "View your quote"}</a></p>`
    : "";
  return `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    ${logo}
    <p style="font-size:16px;color:#111827;">${greeting}</p>
    <h2 style="font-size:18px;color:#111827;">${escapeHtml(subject)}</h2>
    <p style="font-size:14px;color:#374151;line-height:1.6;">${escapeHtml(body)}</p>
    ${cta}
    ${identificationBlockHtml(params.profile, params.lang)}
    ${unsubscribeHtml(params.unsubscribeToken, params.lang)}
  </div>
</body></html>`;
}

export type QuoteFollowupResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Sends the follow-up for the given stage to the quote's client email.
 * Never sends to an unsubscribed quote — callers must still check
 * `quote.unsubscribedAt` before calling this (defense in depth, not the only gate).
 */
export async function sendQuoteFollowup(params: {
  quote: Quote;
  profile: BusinessProfile;
  stage: number;
}): Promise<QuoteFollowupResult> {
  const { quote, profile, stage } = params;
  const clientData = quote.clientData as QuoteClientData;
  const email = clientData?.email;
  if (!email) return { ok: false, reason: "no_email" };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "resend_not_configured" };

  const lang: "en" | "fr" = "en";
  const companyName = (quote.companySnapshot as QuoteCompanySnapshot | null)?.companyName || profile.companyName || "Your company";
  const quoteNumber = quote.numeroPreventivoData || `No. ${quote.id.slice(0, 4).toUpperCase()}`;
  const totale = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(quote.totale));
  const publicUrl = `${getBaseUrl()}/p/${quote.id}`;
  const { subject } = followupCopy(stage, lang, quoteNumber, totale);

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${sanitizeForFromHeader(companyName)} via QuoteAI <no-reply@quoteai.ca>`,
      to: [email],
      subject,
      html: buildFollowupEmailHtml({
        clientName: clientData?.nome || "there",
        profile,
        stage,
        lang,
        unsubscribeToken: quote.unsubscribeToken,
        quoteNumber,
        totale,
        publicUrl,
      }),
      headers: { "List-Unsubscribe": `<${quoteUnsubscribeUrl(quote.unsubscribeToken)}>` },
      ...(profile.email ? { replyTo: profile.email } : {}),
    });
    return { ok: true };
  } catch (err) {
    logger.error({ err, quoteId: quote.id }, "Quote follow-up email failed");
    return { ok: false, reason: err instanceof Error ? err.message : "send_failed" };
  }
}
