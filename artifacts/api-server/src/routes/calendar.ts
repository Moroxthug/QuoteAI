import { Router } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db, businessProfilesTable, calendarSyncedEventsTable, hasFeature, minimumPlanFor, CALENDAR_PROVIDERS, type CalendarProvider } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { buildGoogleAuthUrl } from "../lib/googleCalendarClient.js";
import { buildOutlookAuthUrl } from "../lib/outlookCalendarClient.js";
import { listCalendarConnections, connectCalendar, disconnectCalendar, setCalendarEnabled } from "../calendar/service.js";

const router = Router();

// The OAuth `state` param is a self-contained, signed token (userId + provider + nonce + issued-at)
// rather than a server-side session, since Vercel serverless functions share no memory between the
// /connect and /callback requests. Same shape as quickbooks.ts's state signing.
const STATE_TTL_MS = 5 * 60_000;

function signState(userId: string, provider: CalendarProvider): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  const nonce = randomBytes(8).toString("hex");
  const payload = `${userId}.${provider}.${Date.now()}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyState(state: string, expectedUserId: string, expectedProvider: CalendarProvider): boolean {
  try {
    const secret = process.env.BETTER_AUTH_SECRET ?? "";
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 5) return false;
    const [userId, provider, iat, nonce, sig] = parts;
    const expectedSig = createHmac("sha256", secret).update(`${userId}.${provider}.${iat}.${nonce}`).digest("base64url");
    const sigBuf = Buffer.from(sig!);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return false;
    if (userId !== expectedUserId || provider !== expectedProvider) return false;
    if (Date.now() - Number(iat) > STATE_TTL_MS) return false;
    return true;
  } catch {
    return false;
  }
}

function requireCalendarFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  return db
    .select()
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.userId, userId))
    .then(([profile]) => (hasFeature(profile, "calendar_sync") ? { ok: true } : { ok: false, plan: minimumPlanFor("calendar_sync") }));
}

const providerParam = z.enum(CALENDAR_PROVIDERS);

// GET /api/calendar/status — every connected provider's status
router.get("/calendar/status", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const connections = await listCalendarConnections(userId);
    res.json({
      connections: connections.map((c) => ({
        provider: c.provider,
        accountEmail: c.accountEmail,
        isEnabled: c.isEnabled,
        connectedAt: c.connectedAt.toISOString(),
        lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching calendar sync status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/calendar/:provider/connect — returns the OAuth authorization URL to redirect the browser to
router.get("/calendar/:provider/connect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    const gate = await requireCalendarFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Calendar sync requires the Elite plan" });
      return;
    }
    const url = provider === "google" ? buildGoogleAuthUrl(signState(userId, provider)) : buildOutlookAuthUrl(signState(userId, provider));
    res.json({ url });
  } catch (err) {
    req.log.error({ err }, "Error building calendar auth URL");
    res.status(400).json({ error: "Invalid provider" });
  }
});

// GET /api/calendar/:provider/callback — the provider redirects the browser here after the company
// approves access; this exchanges the code server-side and redirects back into Settings.
const settingsUrl = (status: "connected" | "error") => `${getBaseUrl()}/dashboard/settings?tab=integrations&cal=${status}`;

router.get("/calendar/:provider/callback", requireAuth, async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    if (!state || !verifyState(state, userId, provider) || !code) {
      res.redirect(settingsUrl("error"));
      return;
    }

    await connectCalendar(userId, provider, code);
    res.redirect(settingsUrl("connected"));
  } catch (err) {
    req.log.error({ err }, "Calendar OAuth callback failed");
    res.redirect(settingsUrl("error"));
  }
});

// DELETE /api/calendar/:provider/disconnect
router.delete("/calendar/:provider/disconnect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    await disconnectCalendar(userId, provider);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error disconnecting calendar");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/calendar/:provider/toggle
router.patch("/calendar/:provider/toggle", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    const body = z.object({ isEnabled: z.boolean() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    await setCalendarEnabled(userId, provider, body.data.isEnabled);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error toggling calendar sync");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/calendar/sync-log — recent milestone sync attempts (success + failure), for the status UI
router.get("/calendar/sync-log", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db
      .select()
      .from(calendarSyncedEventsTable)
      .where(eq(calendarSyncedEventsTable.userId, userId))
      .orderBy(desc(calendarSyncedEventsTable.updatedAt))
      .limit(50);
    res.json({
      entries: rows.map((r) => ({
        id: r.id,
        provider: r.provider,
        milestoneId: r.milestoneId,
        status: r.status,
        error: r.error,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching calendar sync log");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
