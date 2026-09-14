import { logger } from "./logger.js";
import { resendOrThrow, sanitizeForFromHeader } from "./emailUtils.js";
import { sendGmailMessage, type GmailAttachment } from "./gmailSendClient.js";
import { getValidEmailAccessToken, markEmailSendResult } from "../emailConnections/service.js";

// ── Phase 20: connected email sending ────────────────────────────────────────
// Every customer-facing send (quote/contract/invoice/lead-followup) routes
// through here: send via the company's own connected Gmail account if one is
// enabled, otherwise fall back to the existing Resend/no-reply@quoteai.ca
// path unchanged. A failed connected send falls back rather than dropping
// the email, and is logged on the connection row so the contractor notices.

export async function sendCustomerEmail(params: {
  userId: string;
  toEmail: string;
  /** Company name — becomes the display name either way ("<name> via QuoteAI" for the Resend fallback). */
  fromDisplayName: string;
  /** The contractor's real address — set as Reply-To on the Resend fallback path (Gmail sends already reply to the account itself). */
  replyTo?: string | null;
  subject: string;
  html: string;
  attachments?: GmailAttachment[];
}): Promise<void> {
  const conn = await getValidEmailAccessToken(params.userId, "google");
  if (conn) {
    try {
      await sendGmailMessage({
        accessToken: conn.accessToken,
        fromAddress: conn.accountEmail,
        fromName: params.fromDisplayName,
        to: params.toEmail,
        replyTo: params.replyTo ?? undefined,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments,
      });
      await markEmailSendResult(params.userId, "google", null);
      logger.info({ userId: params.userId, to: params.toEmail }, "Email sent via connected Gmail account");
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markEmailSendResult(params.userId, "google", message);
      logger.error({ err, userId: params.userId }, "Connected Gmail send failed — falling back to Resend");
    }
  }

  const from = `${sanitizeForFromHeader(params.fromDisplayName)} via QuoteAI <no-reply@quoteai.ca>`;
  await resendOrThrow().emails.send({
    from,
    to: [params.toEmail],
    subject: params.subject,
    html: params.html,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    ...(params.attachments && params.attachments.length > 0 ? { attachments: params.attachments } : {}),
  });
}
