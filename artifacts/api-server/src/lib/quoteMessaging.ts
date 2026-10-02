import { fillTemplate, savedTemplate } from "./savedTemplates.js";
import { brandedResend } from "./emailUtils.js";
import { messageEmail } from "./emailContracts.js";
import { logger } from "./logger.js";
import { getBaseUrl } from "./baseUrl.js";
import { sanitizeForFromHeader } from "./emailUtils.js";
import { db, clientsTable, DEFAULT_AUTOMATION_SETTINGS, type BusinessProfile, type Quote, type QuoteClientData, type QuoteCompanySnapshot } from "@workspace/db";
import { sendSms } from "./sms.js";
import { eq } from "drizzle-orm";

const automationSettings = (profile: BusinessProfile) => ({ ...DEFAULT_AUTOMATION_SETTINGS, ...(profile.automationSettings ?? {}) });

// ── Phase 21: quote-sent follow-up reminders ────────────────────────────────
// A quote gets emailed to a customer and, if they never accept, nothing
// follows up — every other funnel stage (leads, reviews, invoices) already
// has one. Reuses the identification-block/unsubscribe machinery built for
// Phase 9 leads (leadMessaging.ts) verbatim, keyed on the quote's own
// unsubscribeToken since a quote isn't always linked to a clients row.

/** Default follow-up cadence in days-after-sentAt. Stage 0 fires this many days after the quote is sent. */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function quoteUnsubscribeUrl(token: string): string {
  return `${getBaseUrl()}/api/public/quotes/unsubscribe?token=${encodeURIComponent(token)}`;
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
  const url = quoteUnsubscribeUrl(token);
  const text = lang === "fr"
    ? "Vous ne souhaitez plus recevoir ces rappels ?"
    : "Don't want to receive reminders about this quote?";
  const link = lang === "fr" ? "Se désabonner" : "Unsubscribe";
  return `
    <div>
      ${text} <a href="${url}">${link}</a>
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
  const cta = params.publicUrl
    ? `<div class="cta"><a class="btn" href="${escapeHtml(params.publicUrl)}">${params.lang === "fr" ? "Voir la soumission" : "View your quote"}</a></div>`
    : "";
  return messageEmail({
    lang: params.lang,
    companyName: params.profile.companyName,
    logoUrl: params.profile.logoUrl || null,
    clientName: params.clientName,
    title: subject,
    bodyHtml: `<p>${escapeHtml(body)}</p>${cta}`,
    identificationHtml: identificationBlockHtml(params.profile, params.lang),
    unsubscribeHtml: unsubscribeHtml(params.unsubscribeToken, params.lang),
  });
}

export type QuoteFollowupResult =
  | { ok: true; channels: ("email" | "sms")[] }
  | { ok: false; reason: string };

async function quoteFollowupLanguage(quote: Quote, profile: BusinessProfile): Promise<"en" | "fr"> {
  if (quote.clientId) {
    const [client] = await db.select({ preferredLanguage: clientsTable.preferredLanguage }).from(clientsTable).where(eq(clientsTable.id, quote.clientId));
    if (client?.preferredLanguage === "fr" || client?.preferredLanguage === "en") return client.preferredLanguage;
  }
  const province = (quote.province ?? (quote.clientData as QuoteClientData | null)?.province ?? profile.province ?? "").toUpperCase();
  return province === "QC" ? "fr" : "en";
}

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
  // Phase 74: with "text reminders" on, the customer also gets a short SMS
  // with the link when a phone is known — and the SMS alone counts as a
  // successful reminder when there is no email to send.
  const smsTo = automationSettings(profile).smsReminders ? clientData?.phone : null;
  if (!email && !smsTo) return { ok: false, reason: "no_email" };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey && !smsTo) return { ok: false, reason: "resend_not_configured" };

  // Same rule as contract drafting (contracts/service.ts): the client's stored
  // preference wins, otherwise a Quebec quote is French. Phase 65 found this
  // hard-wired to "en" while the French copy above sat unused.
  const lang = await quoteFollowupLanguage(quote, profile);
  const companyName = (quote.companySnapshot as QuoteCompanySnapshot | null)?.companyName || profile.companyName || "Your company";
  const quoteNumber = quote.numeroPreventivoData || `No. ${quote.id.slice(0, 4).toUpperCase()}`;
  const totale = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(Number(quote.totale));
  const publicUrl = `${getBaseUrl()}/p/${quote.id}`;
  const { subject } = followupCopy(stage, lang, quoteNumber, totale);
  // Pocket 128.4: the saved wording for this stage (f1, f2, f3), with its slots filled.
  const saved = savedTemplate(profile.pocketSettings, `f${Math.min(stage, 2) + 1}`, lang);
  const savedBody = saved ? fillTemplate(saved, { first: (clientData?.nome ?? "").trim().split(/\s+/)[0] ?? "", job: quote.titoloPreventivoRiga2?.trim() || "", link: publicUrl, amount: totale, me: "", co: companyName }) : null;

  const channels: ("email" | "sms")[] = [];
  if (smsTo) {
    const sms = await sendSms({ profile, to: smsTo, body: savedBody ? (savedBody.includes(publicUrl) ? savedBody : `${savedBody} ${publicUrl}`) : `${subject} ${publicUrl}`, lang, purpose: "quote_followup", relatedEntityType: "quote", relatedEntityId: quote.id });
    if (sms.ok) channels.push("sms");
    else logger.warn({ quoteId: quote.id, reason: sms.reason }, "Quote follow-up SMS not sent");
  }
  if (!email || !apiKey) return channels.length ? { ok: true, channels } : { ok: false, reason: email ? "resend_not_configured" : "no_email" };

  try {
    const resend = brandedResend(apiKey);
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
    channels.push("email");
    return { ok: true, channels };
  } catch (err) {
    logger.error({ err, quoteId: quote.id }, "Quote follow-up email failed");
    if (channels.length) return { ok: true, channels };
    return { ok: false, reason: err instanceof Error ? err.message : "send_failed" };
  }
}
