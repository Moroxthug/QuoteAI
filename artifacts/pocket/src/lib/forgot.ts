// ForgotPassword: the pure parts.
// Same as MIN_PASSWORD in auth.ts (not imported: auth.ts pulls in the app session, which the node tests cannot load).
const MIN_PASSWORD = 8;

export const RESEND_SECONDS = 30;

export type Step = "request" | "sent" | "newPassword" | "done";

/** Where the screen opens: the emailed link brings `?token=` (or `?error=` when it is bad, used or expired). */
export function startStep(params: { token?: string; error?: string }): { step: Step; expired: boolean } {
  if (params.token) return { step: "newPassword", expired: false };
  if (params.error) return { step: "newPassword", expired: true };
  return { step: "request", expired: false };
}

export function looksLikeEmail(v: string): boolean {
  const s = v.trim();
  return s.indexOf("@") > 0 && s.length > 3;
}

export type Rules = { length: boolean; mix: boolean; match: boolean };

/** The board's three rules: 8 characters or more, a number or symbol, both passwords match. */
export function passwordRules(p1: string, p2: string): Rules {
  return {
    length: p1.length >= MIN_PASSWORD,
    mix: /[0-9]/.test(p1) || /[^A-Za-z0-9]/.test(p1),
    match: p1.length > 0 && p1 === p2,
  };
}

export const rulesMet = (r: Rules): boolean => r.length && r.mix && r.match;

/** The confirm field says "doesn't match yet" once it is as long as the first and differs. */
export function mismatch(p1: string, p2: string): boolean {
  return p2.length >= p1.length && p2.length > 0 && p1 !== p2;
}
