// The phone's calls to better-auth (api-server lib/auth.ts, mounted at /api/auth). Plain fetch:
// the app's wrapped fetch (lib/session.ts) adds the bearer token, the app origin and the
// two-step cookie tunnel, and keeps the token that comes back in `set-auth-token`.
// Every call ends in a result the screens can switch on; none throws.
import { API_ORIGIN } from "./session";

export type AuthProblem =
  | "offline"      // no signal, or the server can't be reached
  | "wrong"        // the email or password (or code) is wrong
  | "unverified"   // the address was never confirmed: a code is needed
  | "cancelled"    // the account is scheduled for deletion
  | "emailTaken"
  | "weakPassword"
  | "closed"       // registration is closed
  | "locked"       // too many wrong codes
  | "expired"      // the code or link ran out
  | "failed";      // anything else

export type AuthResult<T = null> = { ok: true; data: T } | { ok: false; problem: AuthProblem; message?: string };

type Body = Record<string, unknown>;
type Raw = { status: number; body: { code?: string; message?: string } & Record<string, unknown> };

const BASE = `${API_ORIGIN}/api/auth`;

async function call(path: string, body?: Body, method: "POST" | "GET" = "POST"): Promise<Raw | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    });
    const text = await res.text();
    let parsed: Raw["body"] = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
    return { status: res.status, body: parsed ?? {} };
  } catch {
    return null;
  }
}

/** Reads better-auth's error code / message into one of our problems. */
export function classify(raw: Raw): AuthProblem {
  const code = String(raw.body.code ?? "").toUpperCase();
  const msg = String(raw.body.message ?? "").toLowerCase();
  if (code === "ACCOUNT_DELETION_PENDING") return "cancelled";
  if (code === "EMAIL_NOT_VERIFIED" || msg.includes("not verified")) return "unverified";
  if (code.includes("TOO_MANY") || msg.includes("too many") || raw.status === 429) return "locked";
  if (code.includes("EXPIRED") || msg.includes("expired")) return "expired";
  if (code.includes("ALREADY") || code === "USER_ALREADY_EXISTS" || msg.includes("already")) return "emailTaken";
  if (code.includes("PASSWORD_TOO") || msg.includes("password too") || msg.includes("password must")) return "weakPassword";
  if (code.includes("SIGNUP_DISABLED") || code.includes("SIGN_UP") || msg.includes("registration")) return "closed";
  if (code.includes("INVALID") || msg.includes("invalid") || raw.status === 401 || raw.status === 400) return "wrong";
  return "failed";
}

function result<T>(raw: Raw | null, data: (b: Raw["body"]) => T): AuthResult<T> {
  if (!raw) return { ok: false, problem: "offline" };
  if (raw.status >= 200 && raw.status < 300 && !raw.body.code) return { ok: true, data: data(raw.body) };
  return { ok: false, problem: classify(raw), message: typeof raw.body.message === "string" ? raw.body.message : undefined };
}

const nothing = () => null;

export const MIN_PASSWORD = 8;

export const auth = {
  /** Is sign-up open? A failed check counts as open (the sign-up itself then answers). */
  async registrationOpen(): Promise<boolean> {
    try {
      const res = await fetch(`${API_ORIGIN}/api/settings/registration`);
      const body = (await res.json()) as { open?: boolean };
      return body.open !== false;
    } catch {
      return true;
    }
  },

  signUp: async (name: string, email: string, password: string) =>
    result(await call("/sign-up/email", { name, email, password }), nothing),

  /** `twoStep: true` when the password was right and a code from the authenticator app is next. */
  async signIn(email: string, password: string): Promise<AuthResult<{ twoStep: boolean }>> {
    const raw = await call("/sign-in/email", { email, password });
    return result(raw, (b) => ({ twoStep: b.twoFactorRedirect === true }));
  },

  verifyTotp: async (code: string) => result(await call("/two-factor/verify-totp", { code }), nothing),
  verifyBackupCode: async (code: string) => result(await call("/two-factor/verify-backup-code", { code }), nothing),

  /** Emails the 6-digit code. Always "ok" when the address isn't waiting for one (the server never says). */
  sendCode: async (email: string) => result(await call("/email-otp/send-verification-otp", { email, type: "email-verification" }), nothing),
  /** Confirms the address; the server signs the person in and the token is kept. */
  verifyEmail: async (email: string, otp: string) => result(await call("/email-otp/verify-email", { email, otp }), nothing),

  /** The reset link opens the app (scheme quoteai://forgot-password?token=…). */
  requestReset: async (email: string) => result(await call("/request-password-reset", { email, redirectTo: "quoteai://forgot-password" }), nothing),
  resetPassword: async (token: string, newPassword: string) => result(await call("/reset-password", { token, newPassword }), nothing),

  signOut: async () => result(await call("/sign-out", {}), nothing),

  /** Changes the signed-in person's name (and photo, as an address or a data URL). */
  updateUser: async (patch: { name?: string; image?: string }) => result(await call("/update-user", patch), nothing),

  /** Where this person is signed in (the phone itself marked), and whether the second step is on. */
  async devices(): Promise<AuthResult<{ twoStep: boolean; items: { token: string; agent: string; ip: string; at: string; here: boolean }[] }>> {
    const [list, me] = await Promise.all([call("/list-sessions", undefined, "GET"), call("/get-session", undefined, "GET")]);
    if (!list) return { ok: false, problem: "offline" };
    const here = String((me?.body as { session?: { token?: string } } | undefined)?.session?.token ?? "");
    const twoStep = Boolean((me?.body as { user?: { twoFactorEnabled?: boolean } } | undefined)?.user?.twoFactorEnabled);
    const rows = Array.isArray(list.body) ? (list.body as unknown as Record<string, unknown>[]) : [];
    return result(list.status === 200 ? { status: 200, body: {} } : list, () => ({
      twoStep,
      items: rows.map((s) => ({ token: String(s.token ?? ""), agent: String(s.userAgent ?? ""), ip: String(s.ipAddress ?? ""), at: String(s.updatedAt ?? s.createdAt ?? ""), here: String(s.token ?? "") === here })),
    }));
  },
  /** Signs one other device out. */
  revokeDevice: async (token: string) => result(await call("/revoke-session", { token }), nothing),
  /** Signs every other device out, this one stays. */
  revokeOthers: async () => result(await call("/revoke-other-sessions", {}), nothing),

  async session(): Promise<AuthResult<{ id: string; name: string; email: string; image: string | null } | null>> {
    const raw = await call("/get-session", undefined, "GET");
    return result(raw, (b) => {
      const user = (b as { user?: { id: string; name: string; email: string; image?: string | null } }).user;
      return user ? { id: user.id, name: user.name, email: user.email, image: user.image ?? null } : null;
    });
  },
};
