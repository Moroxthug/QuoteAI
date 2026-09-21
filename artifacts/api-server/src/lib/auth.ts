import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, twoFactor } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { db, authUsersTable, authSessionsTable, authAccountsTable, authVerificationsTable, authTwoFactorTable, businessProfilesTable, organizationMembersTable, accountDeletionsTable } from "@workspace/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { brandedResend } from "./emailUtils.js";
import { logger } from "./logger";
import { sendWelcomeEmail, escapeHtml } from "./email";
import { getBaseUrl } from "./baseUrl";
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

// Gmail and most webmail clients strip data: URI images from HTML emails,
// so the logo must be a real hosted URL rather than an inline base64 SVG.
const LOGO_URL = `${getBaseUrl()}/quoteai-logo.png`;

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

export const auth = betterAuth({
  secret,
  baseURL: getBaseURL(),
  basePath: "/api/auth",
  trustedOrigins: getTrustedOrigins(),
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
  plugins: [bearer(), twoFactor({ issuer: "QuoteAI" })],
  hooks: {
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
      try {
        if (newSession && (ctx.path === "/sign-in/email" || ctx.path === "/sign-up/email" || ctx.path === "/two-factor/verify-totp" || ctx.path === "/two-factor/verify-backup-code")) {
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
    async sendResetPassword({ user, url }) {
      if (!resend) {
        logger.warn("RESEND_API_KEY not set — skipping password reset email");
        return;
      }
      try {
        await resend.emails.send({
          from: "QuoteAI <no-reply@quoteai.ca>",
          to: [user.email],
          subject: "Reset your password – QuoteAI",
          html: buildResetPasswordEmail(user.name, url),
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
    async sendVerificationEmail({ user, url }) {
      if (!resend) return;
      try {
        await resend.emails.send({
          from: "QuoteAI <no-reply@quoteai.ca>",
          to: [user.email],
          subject: "Verify your email – QuoteAI",
          html: buildVerificationEmail(user.name, url),
        });
      } catch (err) {
        logger.error({ err }, "Failed to send verification email");
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await sendWelcomeEmail({ toEmail: user.email, toName: user.name });
        },
      },
    },
  },
});

function buildResetPasswordEmail(name: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Reset your password – QuoteAI</title></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.10)">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:28px 40px;text-align:center">
  <img src="${LOGO_URL}" alt="QuoteAI" height="36" />
</td></tr>
<tr><td style="background:#fff;padding:32px 40px">
  <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e">Reset your password</h1>
  <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7">Hi ${escapeHtml(name)},<br/>you requested to reset the password for your QuoteAI account. Click the button below:</p>
  <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
    <tr><td align="center" style="border-radius:10px;background:linear-gradient(135deg,#7c3aed,#06b6d4)">
      <a href="${url}" style="display:inline-block;color:#fff;font-size:15px;font-weight:600;padding:13px 32px;border-radius:10px;text-decoration:none">Reset password →</a>
    </td></tr>
  </table>
  <p style="margin:0;font-size:13px;color:#9ca3af">Didn't request this? You can safely ignore this email. Your password will remain unchanged.</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center">
  <p style="margin:0;font-size:12px;color:#9ca3af">&copy; ${new Date().getFullYear()} QuoteAI · Professional AI-powered quotes</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildVerificationEmail(name: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Verify your email – QuoteAI</title></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.10)">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:28px 40px;text-align:center">
  <img src="${LOGO_URL}" alt="QuoteAI" height="36" />
</td></tr>
<tr><td style="background:#fff;padding:32px 40px">
  <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e">Verify your email address</h1>
  <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7">Hi ${escapeHtml(name)},<br/>click the button below to verify your email address on QuoteAI.</p>
  <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
    <tr><td align="center" style="border-radius:10px;background:linear-gradient(135deg,#7c3aed,#06b6d4)">
      <a href="${url}" style="display:inline-block;color:#fff;font-size:15px;font-weight:600;padding:13px 32px;border-radius:10px;text-decoration:none">Verify email →</a>
    </td></tr>
  </table>
  <p style="margin:0;font-size:13px;color:#9ca3af">Didn't create an account on QuoteAI? You can safely ignore this email.</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center">
  <p style="margin:0;font-size:12px;color:#9ca3af">&copy; ${new Date().getFullYear()} QuoteAI · Professional AI-powered quotes</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
