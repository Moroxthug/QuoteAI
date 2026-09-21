import { Resend } from "resend";
import { logger } from "./logger.js";
import { withLegalFooter } from "./legalFooter.js";

// Small shared helpers with no dependency on emailContracts.ts/connectedEmailSend.ts,
// so the two can import each other's higher-level exports without a cycle.

/**
 * A Resend client whose `emails.send` appends the registered-entity footer
 * (Phase 73) to every HTML body. Every quoteai.ca send goes through here.
 */
export function brandedResend(apiKey: string): Resend {
  const client = new Resend(apiKey);
  const send = client.emails.send.bind(client.emails);
  client.emails.send = ((payload, options) => {
    const html = (payload as { html?: unknown }).html;
    const branded = typeof html === "string" ? { ...payload, html: withLegalFooter(html) } : payload;
    return send(branded as Parameters<typeof send>[0], options);
  }) as typeof client.emails.send;
  return client;
}

export function resendOrThrow(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — cannot send email");
    throw new Error("Email service not configured");
  }
  return brandedResend(apiKey);
}

/** Strips characters that would break a `"Name" <email>` From header (CRLF injection, quotes, angle brackets). */
export function sanitizeForFromHeader(value: string): string {
  return value.replace(/[\r\n"<>]/g, "").trim().slice(0, 60);
}
