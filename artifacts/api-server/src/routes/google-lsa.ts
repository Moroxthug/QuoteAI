import { Router } from "express";
import { z } from "zod";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db, businessProfilesTable, googleLsaImportLogTable, hasFeature, minimumPlanFor } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { isIntegrationConfigured, refuseIfNotConfigured } from "../lib/integrationAvailability.js";
import { logger } from "../lib/logger.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { buildAuthUrl } from "../lib/googleLsaClient.js";
import {
  getGoogleLsaConnection,
  connectGoogleLsa,
  disconnectGoogleLsa,
  setGoogleLsaEnabled,
} from "../googleLsa/service.js";

const router = Router();

if (!process.env.GOOGLE_LSA_CLIENT_ID || !process.env.GOOGLE_LSA_CLIENT_SECRET) {
  logger.error("WARNING: GOOGLE_LSA_CLIENT_ID/GOOGLE_LSA_CLIENT_SECRET not set. Google LSA integration will fail.");
}

// The OAuth `state` param is a self-contained, signed token (userId + lsaCustomerId + nonce +
// issued-at) rather than a server-side session, since Vercel serverless functions share no memory
// between the /connect and /callback requests — same shape as routes/meta-lead-ads.ts. Google's
// OAuth callback only ever echoes back `code` and `state`, so the LSA account id the user enters
// on the Connect step is carried inside the signed state itself rather than as a separate param.
const STATE_TTL_MS = 5 * 60_000;

function signState(userId: string, lsaCustomerId: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  const nonce = randomBytes(8).toString("hex");
  const payload = `${userId}.${lsaCustomerId}.${Date.now()}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyState(state: string, expectedUserId: string): { ok: true; lsaCustomerId: string } | { ok: false } {
  try {
    const secret = process.env.BETTER_AUTH_SECRET ?? "";
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 5) return { ok: false };
    const [userId, lsaCustomerId, iat, nonce, sig] = parts;
    const expectedSig = createHmac("sha256", secret).update(`${userId}.${lsaCustomerId}.${iat}.${nonce}`).digest("base64url");
    const sigBuf = Buffer.from(sig!);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return { ok: false };
    if (userId !== expectedUserId) return { ok: false };
    if (Date.now() - Number(iat) > STATE_TTL_MS) return { ok: false };
    return { ok: true, lsaCustomerId: lsaCustomerId! };
  } catch {
    return { ok: false };
  }
}

async function requireGoogleLsaFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "google_lsa")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("google_lsa") };
}

// GET /api/google-lsa/status
router.get("/google-lsa/status", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const conn = await getGoogleLsaConnection(userId);
    const available = isIntegrationConfigured("google_lsa");
    if (!conn) {
      res.json({ connected: false, available });
      return;
    }
    res.json({
      connected: true,
      available,
      lsaCustomerId: conn.lsaCustomerId,
      isEnabled: conn.isEnabled,
      connectedAt: conn.connectedAt.toISOString(),
      lastPolledAt: conn.lastPolledAt?.toISOString() ?? null,
      lastLeadAt: conn.lastLeadAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching Google LSA status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/google-lsa/connect?lsaCustomerId=... — returns the Google OAuth authorization URL
router.get("/google-lsa/connect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireGoogleLsaFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Google Local Services Ads capture requires the Elite plan" });
      return;
    }
    const lsaCustomerId = typeof req.query.lsaCustomerId === "string" ? req.query.lsaCustomerId.replace(/[^0-9]/g, "") : "";
    if (!lsaCustomerId) {
      res.status(400).json({ error: "lsaCustomerId is required (your 10-digit Google Ads/LSA account id, no dashes)" });
      return;
    }
    if (refuseIfNotConfigured(res, "google_lsa", "Google Local Services Ads")) return;
    res.json({ url: buildAuthUrl(signState(userId, lsaCustomerId)) });
  } catch (err) {
    req.log.error({ err }, "Error building Google LSA auth URL");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/google-lsa/callback — Google redirects the browser here after the company grants
// access; this exchanges the code server-side and redirects back into Settings with a status flag.
const settingsUrl = (status: "connected" | "error") => `${getBaseUrl()}/dashboard/settings?tab=integrations&googleLsa=${status}`;

router.get("/google-lsa/callback", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    const verified = state ? verifyState(state, userId) : { ok: false as const };
    if (!verified.ok || !code) {
      res.redirect(settingsUrl("error"));
      return;
    }

    await connectGoogleLsa(userId, code, verified.lsaCustomerId);
    res.redirect(settingsUrl("connected"));
  } catch (err) {
    req.log.error({ err }, "Google LSA OAuth callback failed");
    res.redirect(settingsUrl("error"));
  }
});

// DELETE /api/google-lsa/disconnect
router.delete("/google-lsa/disconnect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    await disconnectGoogleLsa(userId);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error disconnecting Google LSA");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/google-lsa/toggle
router.patch("/google-lsa/toggle", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z.object({ isEnabled: z.boolean() }).safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const { isEnabled } = body.data;
    await setGoogleLsaEnabled(userId, isEnabled);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error toggling Google LSA");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/google-lsa/import-log — recent polling sweep results (imported/duplicate/failed)
router.get("/google-lsa/import-log", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db
      .select()
      .from(googleLsaImportLogTable)
      .where(eq(googleLsaImportLogTable.userId, userId))
      .orderBy(desc(googleLsaImportLogTable.createdAt))
      .limit(50);
    res.json({
      entries: rows.map(r => ({
        id: r.id,
        googleLsaLeadId: r.googleLsaLeadId,
        leadType: r.leadType,
        status: r.status,
        error: r.error,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching Google LSA import log");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
