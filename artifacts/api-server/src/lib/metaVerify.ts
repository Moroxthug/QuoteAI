import { timingSafeEqual } from "node:crypto";

/**
 * Meta's webhook handshake (WhatsApp, Lead Ads): answer `hub.challenge` only
 * when `hub.verify_token` matches the configured secret.
 *
 * - No secret configured → always refuse. A plain `===` would let a request
 *   with no token through (undefined === undefined).
 * - Constant-time compare.
 * - The challenge goes back as plain text and must look like one (Meta sends
 *   a number), so it can never be reflected as HTML.
 */
export function metaChallengeResponse(query: Record<string, unknown>, expected: string | undefined): string | null {
  if (!expected) return null;
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];
  if (mode !== "subscribe" || typeof token !== "string" || typeof challenge !== "string") return null;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(challenge)) return null;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return challenge;
}
