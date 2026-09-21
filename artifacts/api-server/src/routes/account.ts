import { Router } from "express";
import { z } from "zod";
import { fromNodeHeaders } from "better-auth/node";
import { APIError } from "better-auth/api";
import { db, businessProfilesTable, ACCOUNT_DELETION_GRACE_DAYS, ACCOUNT_RETENTION_YEARS } from "@workspace/db";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth.js";
import { requireAuth, getActorUserId, getUserId, getUserEmail } from "../middlewares/authMiddleware.js";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { raiseAutomation } from "../lib/automation.js";
import { recordSecurityAuditEvent } from "../lib/auditLog.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { requestAccountExport, listAccountExports, findPendingDeletion, requestAccountDeletion, cancelAccountDeletion, daysUntil } from "../account/service.js";

// Phase 72 — the account itself: export everything, delete everything.
// Both act on the *person* (actorUserId), never on an org they merely belong
// to: a team member deleting "their account" removes their login and their
// memberships; only an owner's deletion takes a company with it.

const router = Router();

const langSchema = z.enum(["en", "fr"]).optional();

async function ownsProfile(userId: string): Promise<{ companyName: string; province: string | null } | null> {
  const [p] = await db.select({ companyName: businessProfilesTable.companyName, province: businessProfilesTable.province }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return p ?? null;
}

function langFor(explicit: "en" | "fr" | undefined, province: string | null | undefined): "en" | "fr" {
  return explicit ?? (province === "QC" ? "fr" : "en");
}

// GET /api/account — what the Security tab needs: can this person export /
// delete, is a deletion pending, recent exports (with a fresh 1-hour link).
router.get("/account", requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const profile = await ownsProfile(actorId);
    const isOwnerHere = getUserId(res) === actorId;
    const [pending, exports] = await Promise.all([findPendingDeletion(actorId), profile ? listAccountExports(actorId) : Promise.resolve([])]);
    res.json({
      ownsProfile: Boolean(profile),
      companyName: profile?.companyName ?? null,
      /** Export is per company, so it needs the owner acting as their own org. */
      canExport: Boolean(profile) && isOwnerHere,
      canDelete: true,
      graceDays: ACCOUNT_DELETION_GRACE_DAYS,
      retentionYears: ACCOUNT_RETENTION_YEARS,
      pendingDeletion: pending ? { scheduledFor: pending.scheduledFor.toISOString(), daysLeft: daysUntil(pending.scheduledFor) } : null,
      exports: exports.map((e) => ({
        id: e.id,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
        readyAt: e.readyAt?.toISOString() ?? null,
        expiresAt: e.expiresAt?.toISOString() ?? null,
        sizeBytes: e.sizeBytes,
        tableCount: e.tableCount,
        fileCount: e.fileCount,
        downloadUrl: e.downloadUrl,
        error: e.status === "failed" ? e.error : null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error loading account status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/account/export — { language? } — one per 24 h per company. The
// ZIP is built inline (retried by cron on failure) and the link is emailed;
// the response carries the export row so the UI can poll GET /api/account.
router.post("/account/export", requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const profile = await ownsProfile(actorId);
    if (!profile || getUserId(res) !== actorId) {
      res.status(403).json({ error: "Only the account owner can export the company's data", code: "OWNER_ONLY" });
      return;
    }
    const body = z.object({ language: langSchema }).safeParse(req.body ?? {});
    const language = langFor(body.success ? body.data.language : undefined, profile.province);
    const email = getUserEmail(res);
    const { export: row, retryAfterMs } = await requestAccountExport({ userId: actorId, requestedByUserId: actorId, email, language });
    if (!row) {
      res.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
      res.status(429).json({ error: "An export was already requested in the last 24 hours", code: "EXPORT_RATE_LIMITED", retryAfterMs });
      return;
    }
    await recordSecurityAuditEvent({ orgId: actorId, actorUserId: actorId, action: "account.export_requested", entityType: "security", entityId: row.id, ipAddress: req.ip, userAgent: req.headers["user-agent"] });
    await raiseAutomation({ event: "account.export_requested", userId: actorId, entityType: "account_export", entityId: row.id, idempotencyKey: `account.export_requested:${row.id}` });
    const [latest] = await listAccountExports(actorId);
    res.status(202).json({ id: row.id, status: latest?.status ?? "pending", email });
  } catch (err) {
    req.log.error({ err }, "Error requesting account export");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/account — { password, code?, language? }. Password re-auth
// always; a TOTP or backup code too when 2FA is on. Schedules the purge
// ACCOUNT_DELETION_GRACE_DAYS out and signs the person out everywhere.
router.delete("/account", requireAuth, async (req, res) => {
  try {
    const actorId = getActorUserId(res);
    const body = z.object({ password: z.string().min(1).max(200), code: z.string().trim().max(32).optional(), language: langSchema }).safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Password is required", code: "VALIDATION" });
      return;
    }
    const headers = fromNodeHeaders(req.headers);
    try {
      await auth.api.verifyPassword({ body: { password: body.data.password }, headers });
    } catch (err) {
      if (err instanceof APIError) {
        res.status(401).json({ error: "Incorrect password", code: "INVALID_PASSWORD" });
        return;
      }
      throw err;
    }
    const session = await auth.api.getSession({ headers });
    const twoFactorEnabled = Boolean((session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled);
    if (twoFactorEnabled) {
      const code = body.data.code?.replace(/\s+/g, "") ?? "";
      if (!code) {
        res.status(401).json({ error: "Two-factor code required", code: "TWO_FACTOR_REQUIRED" });
        return;
      }
      try {
        // 6 digits → authenticator app; anything else → one of the backup codes.
        if (/^\d{6}$/.test(code)) await auth.api.verifyTOTP({ body: { code }, headers });
        else await auth.api.verifyBackupCode({ body: { code }, headers });
      } catch (err) {
        if (err instanceof APIError) {
          res.status(401).json({ error: "Invalid two-factor code", code: "INVALID_TWO_FACTOR" });
          return;
        }
        throw err;
      }
    }

    const profile = await ownsProfile(actorId);
    const language = langFor(body.data.language, profile?.province);
    const { deletion, alreadyPending } = await requestAccountDeletion({ userId: actorId, email: getUserEmail(res), language, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ scheduledFor: deletion.scheduledFor.toISOString(), daysLeft: daysUntil(deletion.scheduledFor), alreadyPending, stripeSubscriptionCancelled: deletion.stripeSubscriptionCancelled });
  } catch (err) {
    req.log.error({ err }, "Error requesting account deletion");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/account/deletion/cancel/:token — the button in the confirmation
// email. Public (the person is signed out by then); lands on the sign-in page.
const cancelLimiter = ipRateLimiter({ windowMs: 15 * 60_000, max: 20, message: "Too many attempts" });
router.get("/account/deletion/cancel/:token", cancelLimiter, async (req, res) => {
  try {
    const token = String(req.params.token ?? "");
    const result = token.length >= 32 && token.length <= 64 ? await cancelAccountDeletion(token) : { ok: false, language: "en" as const };
    const dest = new URL("/sign-in/", getBaseUrl());
    dest.searchParams.set("deletion", result.ok ? "cancelled" : "invalid");
    if (result.language === "fr") dest.searchParams.set("lang", "fr");
    res.redirect(302, dest.toString());
  } catch (err) {
    req.log.error({ err }, "Error cancelling account deletion");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
