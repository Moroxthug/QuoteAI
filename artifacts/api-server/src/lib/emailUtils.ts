import { Resend } from "resend";
import { logger } from "./logger.js";

// Small shared helpers with no dependency on emailContracts.ts/connectedEmailSend.ts,
// so the two can import each other's higher-level exports without a cycle.

export function resendOrThrow(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — cannot send email");
    throw new Error("Email service not configured");
  }
  return new Resend(apiKey);
}

/** Strips characters that would break a `"Name" <email>` From header (CRLF injection, quotes, angle brackets). */
export function sanitizeForFromHeader(value: string): string {
  return value.replace(/[\r\n"<>]/g, "").trim().slice(0, 60);
}
