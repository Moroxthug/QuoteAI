import { createHmac, timingSafeEqual } from "node:crypto";

// Phase 134: the unsubscribe link in every lifecycle email. Signed with the server secret, no expiry (CASL: an unsubscribe link must keep working), and it
// can only ever do one thing: switch lifecycle emails off or on for the person it names. Domain-separated so it cannot be confused with other signed values.

const PURPOSE = "lifecycle-unsubscribe-v1";

function secret(): string | null {
  return process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET ?? null;
}

function sign(userId: string, key: string): string {
  return createHmac("sha256", key).update(`${PURPOSE}.${userId}`).digest("base64url");
}

/** Null when the server has no secret (nothing should be sent then). */
export function unsubscribeToken(userId: string, key: string | null = secret()): string | null {
  if (!key) return null;
  return `${Buffer.from(userId, "utf8").toString("base64url")}.${sign(userId, key)}`;
}

/** The user id the token names, or null when it is malformed or the signature is wrong. */
export function verifyUnsubscribeToken(token: string, key: string | null = secret()): string | null {
  if (!key || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const userId = Buffer.from(parts[0], "base64url").toString("utf8");
    if (!userId) return null;
    const expected = Buffer.from(sign(userId, key));
    const given = Buffer.from(parts[1]);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    return userId;
  } catch {
    return null;
  }
}

export function unsubscribeUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/public/lifecycle/unsubscribe?token=${encodeURIComponent(token)}`;
}
