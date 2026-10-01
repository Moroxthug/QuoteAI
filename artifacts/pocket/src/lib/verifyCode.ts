// Verify: how many wrong codes the server allows before it locks the address (better-auth
// emailOTP allowedAttempts), and the pause before a new code can be asked for.
export const ALLOWED_ATTEMPTS = 5;
export const RESEND_SECONDS = 30;

export const digitsOnly = (v: string, length = 6) => v.replace(/\D/g, "").slice(0, length);
export const triesLeft = (wrong: number) => Math.max(0, ALLOWED_ATTEMPTS - wrong);
