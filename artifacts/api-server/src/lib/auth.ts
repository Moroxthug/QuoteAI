import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, twoFactor, emailOTP } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { db, authUsersTable, authSessionsTable, authAccountsTable, authVerificationsTable, authTwoFactorTable, businessProfilesTable, organizationMembersTable, accountDeletionsTable, settingsTable } from "@workspace/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { brandedResend } from "./emailUtils.js";
import { logger } from "./logger";
import { notifyHub } from "./hub";
import { requestLang, verificationEmail, verificationCodeEmail, signInCodeEmail, resetPasswordEmail, welcomeEmail } from "./accountEmails";
import { recordSecurityAuditEvent } from "./auditLog";

// Minimal, duplicate-of-`resolveActingOrg` org lookup — kept local rather than
// imported from ../middlewares/authMiddleware to avoid that module's circular
// import back onto `auth` here. Only used to scope audit rows written from
// better-auth's own request lifecycle (login, 2FA, session revoke).
async function resolveOrgForAudit(actorId: string): Promise<string> {
  const [profile] = await db.select({ userId: businessProfilesTable.userId }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, actorId));
  if (profile) return actorId;
  const [membership] = await db
    .select()
    .from(organizationMembersTable)
    .where(and(eq(organizationMembersTable.userId, actorId), eq(organizationMembersTable.status, "active")))
    .orderBy(asc(organizationMembersTable.joinedAt))
    .limit(1);
  return membership?.ownerId ?? actorId;
}
// Phase 72: same "keep it local" rule — the account service imports half the
// app, so the grace-period check the sign-in hook needs is one query here.
async function findPendingDeletionLocal(userId: string) {
  const [row] = await db
    .select({ scheduledFor: accountDeletionsTable.scheduledFor, language: accountDeletionsTable.language })
    .from(accountDeletionsTable)
    .where(and(eq(accountDeletionsTable.userId, userId), isNull(accountDeletionsTable.cancelledAt), isNull(accountDeletionsTable.purgedAt)))
    .limit(1);
  return row ?? null;
}


const resend = process.env.RESEND_API_KEY ? brandedResend(process.env.RESEND_API_KEY) : null;

const secret = process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET;
if (!secret) {
  throw new Error("BETTER_AUTH_SECRET or SESSION_SECRET must be set");
}

function getBaseURL(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.QUOTEAI_BASE_URL) return process.env.QUOTEAI_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:5000";
}

export function getTrustedOrigins(): string[] {
  const origins: string[] = ["http://localhost:5000", "http://localhost:3000"];
  if (process.env.BETTER_AUTH_URL) origins.push(process.env.BETTER_AUTH_URL);
  if (process.env.QUOTEAI_BASE_URL) origins.push(process.env.QUOTEAI_BASE_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`);
  // Support additional trusted origins via env var (comma-separated)
  const extra = process.env.TRUSTED_ORIGINS;
  if (extra) {
    for (const o of extra.split(",")) {
      const trimmed = o.trim();
      if (trimmed) origins.push(trimmed);
    }
  }
  return origins;
}

/**
 * Phase 118: the origins of the phone app's WebView (Android serves the bundled
 * app from https://localhost, iOS from capacitor://localhost). The app signs in
 * with a bearer token and sends no cookies, so CORS answers these without
 * credentials (app.ts); better-auth still checks a sign-in's Origin against its
 * trusted list, so they are trusted there.
 */
export const NATIVE_APP_ORIGINS = ["https://localhost", "capacitor://localhost"];

/**
 * Phase 124: the phone app's password-reset deep link. better-auth sends the
 * emailed link through /reset-password/:token?callbackURL=quoteai://forgot-password
 * and only redirects (and only accepts the request's redirectTo) when that URL
 * matches a trusted origin. A custom-scheme pattern matches the scheme AND the
 * host part exactly, so only this one deep link is trusted, nothing else under
 * quoteai://.
 */
export const NATIVE_APP_SCHEMES = ["quoteai://forgot-password"];

const fromNativeApp = (request: Request | undefined): boolean => {
  const origin = request?.headers.get("origin");
  return !!origin && NATIVE_APP_ORIGINS.includes(origin);
};

/**
 * Phase 121: the phone app confirms a new address with a 6-digit code typed in
 * the app, not a link — a link opens the browser, signs the person in there and
 * leaves the app signed out. Confirming a code is served only for an account
 * whose address is not confirmed yet.
 *
 * Phase 129.10: a confirmed account may also sign in with an emailed code, which
 * is no weaker than the reset link the same inbox already receives. An account
 * with two-step on never can: a code would skip the second factor, so nothing is
 * sent and nothing is accepted. It never creates an account (disableSignUp).
 */
const EMAIL_OTP_PATHS = ["/email-otp/send-verification-otp", "/email-otp/verify-email", "/sign-in/email-otp"];
const EMAIL_OTP_DISABLED = [
  "/email-otp/check-verification-otp",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
];

async function unverifiedUser(email: unknown): Promise<boolean> {
  if (typeof email !== "string" || !email) return false;
  const [row] = await db
    .select({ emailVerified: authUsersTable.emailVerified })
    .from(authUsersTable)
    .where(eq(authUsersTable.email, email.trim().toLowerCase()))
    .limit(1);
  return !!row && !row.emailVerified;
}

async function codeSignInAllowed(email: unknown): Promise<boolean> {
  if (typeof email !== "string" || !email) return false;
  const [row] = await db
    .select({ emailVerified: authUsersTable.emailVerified, twoFactorEnabled: authUsersTable.twoFactorEnabled })
    .from(authUsersTable)
    .where(eq(authUsersTable.email, email.toLowerCase()))
    .limit(1);
  return !!row && row.emailVerified && !row.twoFactorEnabled;
}

/**
 * Phase 129.10: Google and Apple sign-in for the phone app. The phone gets an ID
 * token from the provider's own sheet and posts it to /sign-in/social, so only
 * the token check runs here and no client secret is needed: the redirect branch
 * of that route is refused in the before hook. Each provider is off until its env
 * var is set, and the app only shows the buttons the server reports (socialSignIn).
 */
const GOOGLE_CLIENT_ID = process.env.GOOGLE_SIGN_IN_CLIENT_ID?.trim() || null;
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID?.trim() || null;
export const socialSignIn = { google: GOOGLE_CLIENT_ID, apple: !!APPLE_BUNDLE_ID };

async function registrationClosed(): Promise<boolean> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "registration_open")).limit(1);
  return row?.value === "false";
}

export const auth = betterAuth({
  secret,
  baseURL: getBaseURL(),
  basePath: "/api/auth",
  trustedOrigins: [...getTrustedOrigins(), ...NATIVE_APP_ORIGINS, ...NATIVE_APP_SCHEMES],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUsersTable,
      session: authSessionsTable,
      account: authAccountsTable,
      verification: authVerificationsTable,
      twoFactor: authTwoFactorTable,
    },
  }),
  socialProviders: {
    ...(GOOGLE_CLIENT_ID ? { google: { clientId: GOOGLE_CLIENT_ID, clientSecret: "" } } : {}),
    ...(APPLE_BUNDLE_ID ? { apple: { clientId: APPLE_BUNDLE_ID, clientSecret: "", appBundleIdentifier: APPLE_BUNDLE_ID } } : {}),
  },
  plugins: [
    bearer(),
    twoFactor({ issuer: "QuoteAI" }),
    emailOTP({
      otpLength: 6,
      expiresIn: 15 * 60,
      allowedAttempts: 5,
      storeOTP: "hashed",
      disableSignUp: true,
      async sendVerificationOTP({ email, otp, type }, ctx) {
        if (type !== "email-verification" && type !== "sign-in") return;
        if (!resend) {
          logger.warn("RESEND_API_KEY not set — skipping verification code email");
          return;
        }
        try {
          const [user] = await db.select({ name: authUsersTable.name }).from(authUsersTable).where(eq(authUsersTable.email, email)).limit(1);
          await resend.emails.send({
            from: "QuoteAI <no-reply@quoteai.ca>",
            to: [email],
            ...(type === "sign-in" ? signInCodeEmail : verificationCodeEmail)(requestLang(ctx?.request?.headers), user?.name ?? "", otp),
          });
        } catch (err) {
          logger.error({ err }, "Failed to send verification code email");
        }
      },
    }),
  ],
  disabledPaths: EMAIL_OTP_DISABLED,
  hooks: {
    // Phase 121: which codes are sent and accepted (see EMAIL_OTP_PATHS).
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/social" && !(ctx.body as { idToken?: unknown } | undefined)?.idToken) {
        throw new APIError("BAD_REQUEST", { code: "ID_TOKEN_REQUIRED", message: "Sign in from the app." });
      }
      if (!ctx.path || !EMAIL_OTP_PATHS.includes(ctx.path)) return undefined;
      const body = (ctx.body ?? {}) as { email?: unknown; type?: unknown };
      if (ctx.path === "/email-otp/send-verification-otp") {
        const allowed = body.type === "sign-in" ? await codeSignInAllowed(body.email) : body.type === "email-verification" && (await unverifiedUser(body.email));
        return allowed ? undefined : ctx.json({ success: true });
      }
      if (ctx.path === "/sign-in/email-otp") {
        if (!(await codeSignInAllowed(body.email))) throw new APIError("BAD_REQUEST", { code: "INVALID_OTP", message: "Invalid OTP" });
        return undefined;
      }
      if (!(await unverifiedUser(body.email))) throw new APIError("BAD_REQUEST", { code: "INVALID_OTP", message: "Invalid OTP" });
      return undefined;
    }),
    // IMPORTANT: better-auth re-throws any non-APIError raised in an `after`
    // hook, which replaces the endpoint's real response with a 500 — so a bug
    // or transient DB error in this best-effort audit logging would turn a
    // correct login into "invalid credentials" for the user. Never let
    // anything in here escape; log and swallow instead.
    after: createAuthMiddleware(async (ctx) => {
      // Phase 72: an account inside its deletion grace period cannot sign in
      // (or be signed in by email verification / a password reset). The
      // session was already created — drop it and replace the response.
      // Checked here rather than in a `before` hook so an unknown password
      // still gets the generic "invalid credentials", not a deletion notice.
      const newSession = ctx.context.newSession;
      if (newSession) {
        const pending = await findPendingDeletionLocal(newSession.user.id).catch(() => null);
        if (pending) {
          await db.delete(authSessionsTable).where(eq(authSessionsTable.token, newSession.session.token)).catch(() => undefined);
          // The session cookie / bearer token are already on the response; don't hand out a dead token.
          ctx.context.responseHeaders?.delete("set-cookie");
          ctx.context.responseHeaders?.delete("set-auth-token");
          const when = pending.scheduledFor.toLocaleDateString(pending.language === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Toronto" });
          throw new APIError("FORBIDDEN", {
            code: "ACCOUNT_DELETION_PENDING",
            message: pending.language === "fr"
              ? `Ce compte sera supprimé le ${when}. Pour annuler, utilisez le lien du courriel de confirmation.`
              : `This account is scheduled for deletion on ${when}. To cancel, use the link in the confirmation email.`,
          });
        }
      }
      // Phase 129.10: better-auth's two-step only guards the password route, so a
      // provider's token would skip it. Two-step accounts sign in with their password.
      if (newSession && ctx.path === "/sign-in/social" && newSession.user.twoFactorEnabled) {
        await db.delete(authSessionsTable).where(eq(authSessionsTable.token, newSession.session.token)).catch(() => undefined);
        ctx.context.responseHeaders?.delete("set-cookie");
        ctx.context.responseHeaders?.delete("set-auth-token");
        throw new APIError("FORBIDDEN", { code: "TWO_STEP_USES_PASSWORD", message: "This account uses two-step. Sign in with your password." });
      }
      try {
        if (newSession && (ctx.path === "/sign-in/email" || ctx.path === "/sign-in/social" || ctx.path === "/sign-in/email-otp" || ctx.path === "/sign-up/email" || ctx.path === "/two-factor/verify-totp" || ctx.path === "/two-factor/verify-backup-code")) {
          const orgId = await resolveOrgForAudit(newSession.user.id);
          await recordSecurityAuditEvent({
            orgId,
            actorUserId: newSession.user.id,
            action: "login",
            ipAddress: newSession.session.ipAddress ?? null,
            userAgent: newSession.session.userAgent ?? null,
          });
          return;
        }
        const session = ctx.context.session;
        if (!session) return;
        if (ctx.path === "/two-factor/enable") {
          const orgId = await resolveOrgForAudit(session.user.id);
          await recordSecurityAuditEvent({ orgId, actorUserId: session.user.id, action: "two_factor.enabled" });
        } else if (ctx.path === "/two-factor/disable") {
          const orgId = await resolveOrgForAudit(session.user.id);
          await recordSecurityAuditEvent({ orgId, actorUserId: session.user.id, action: "two_factor.disabled" });
        } else if (ctx.path === "/revoke-session") {
          const orgId = await resolveOrgForAudit(session.user.id);
          await recordSecurityAuditEvent({ orgId, actorUserId: session.user.id, action: "session.revoked" });
        } else if (ctx.path === "/revoke-sessions" || ctx.path === "/revoke-other-sessions") {
          const orgId = await resolveOrgForAudit(session.user.id);
          await recordSecurityAuditEvent({ orgId, actorUserId: session.user.id, action: "session.revoked_all" });
        }
      } catch (err) {
        logger.error({ err, path: ctx.path }, "Security audit hook failed (non-fatal, auth response unaffected)");
      }
    }),
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // Phase 64: a reset is how a user takes an account back — every session
    // that existed before it (including an attacker's) must die with it.
    // better-auth defaults this to false.
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }, request) {
      if (!resend) {
        logger.warn("RESEND_API_KEY not set — skipping password reset email");
        return;
      }
      try {
        await resend.emails.send({
          from: "QuoteAI <no-reply@quoteai.ca>",
          to: [user.email],
          ...resetPasswordEmail(requestLang(request?.headers), user.name, url),
        });
      } catch (err) {
        logger.error({ err }, "Failed to send password reset email");
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }, request) {
      if (!resend) return;
      // Phase 121: the phone app asks for a code instead (it would open this link in the browser).
      if (fromNativeApp(request)) return;
      try {
        await resend.emails.send({
          from: "QuoteAI <no-reply@quoteai.ca>",
          to: [user.email],
          ...verificationEmail(requestLang(request?.headers), user.name, url),
        });
      } catch (err) {
        logger.error({ err }, "Failed to send verification email");
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Phase 129.10: the admin's registration switch also closes sign-up through Google and Apple.
        before: async (_user, ctx) => {
          if (ctx?.path === "/sign-in/social" && (await registrationClosed())) {
            throw new APIError("FORBIDDEN", { code: "SIGNUP_DISABLED", message: "Registration is closed." });
          }
        },
        // Phase 93: the welcome is for someone starting a company. A person
        // signing up to join one (from /join or an invite link, or whose
        // address already has an invitation waiting) is not told to set up a
        // business and pick a plan.
        after: async (user, ctx) => {
          await notifyHub("signup", "New signup", user.email);
          if (!resend) return;
          try {
            const callbackURL = String((ctx?.body as { callbackURL?: unknown } | undefined)?.callbackURL ?? "");
            if (/^\/(join|team-invite)\b/.test(callbackURL)) return;
            const [invited] = await db
              .select({ id: organizationMembersTable.id })
              .from(organizationMembersTable)
              .where(and(eq(organizationMembersTable.invitedEmail, user.email.toLowerCase()), eq(organizationMembersTable.status, "invited")))
              .limit(1);
            if (invited) return;
            await resend.emails.send({ from: "QuoteAI <no-reply@quoteai.ca>", to: [user.email], ...welcomeEmail(requestLang(ctx?.headers), user.name) });
          } catch (err) {
            logger.error({ err }, "Failed to send welcome email (non-fatal)");
          }
        },
      },
    },
  },
});

