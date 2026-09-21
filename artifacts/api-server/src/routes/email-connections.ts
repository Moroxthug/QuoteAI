import { Router } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db, businessProfilesTable, hasFeature, minimumPlanFor, EMAIL_PROVIDERS, type EmailProvider } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { isIntegrationConfigured, refuseIfNotConfigured } from "../lib/integrationAvailability.js";
import { buildGmailAuthUrl } from "../lib/gmailSendClient.js";
import { listEmailConnections, connectEmailAccount, disconnectEmailAccount, setEmailConnectionEnabled } from "../emailConnections/service.js";

const router = Router();

// Signed, self-contained `state` param (userId + provider + nonce + issued-at) —
// same shape as calendar.ts's/quickbooks.ts's state signing, since Vercel
// serverless functions share no memory between /connect and /callback.
const STATE_TTL_MS = 5 * 60_000;

function signState(userId: string, provider: EmailProvider): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  const nonce = randomBytes(8).toString("hex");
  const payload = `${userId}.${provider}.${Date.now()}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyState(state: string, expectedUserId: string, expectedProvider: EmailProvider): boolean {
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

function requireGmailSendFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  return db
    .select()
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.userId, userId))
    .then(([profile]) => (hasFeature(profile, "gmail_send") ? { ok: true } : { ok: false, plan: minimumPlanFor("gmail_send") }));
}

const providerParam = z.enum(EMAIL_PROVIDERS);

// GET /api/email-connections/status
router.get("/email-connections/status", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const connections = await listEmailConnections(userId);
    res.json({
      available: { google: isIntegrationConfigured("gmail_send") },
      connections: connections.map((c) => ({
        provider: c.provider,
        accountEmail: c.accountEmail,
        isEnabled: c.isEnabled,
        connectedAt: c.connectedAt.toISOString(),
        lastSendAt: c.lastSendAt?.toISOString() ?? null,
        lastSendError: c.lastSendError,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching email connection status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/email-connections/:provider/connect — returns the OAuth authorization URL to redirect the browser to
router.get("/email-connections/:provider/connect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    const gate = await requireGmailSendFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Connected email sending requires the Elite plan" });
      return;
    }
    if (refuseIfNotConfigured(res, "gmail_send", "Gmail sending")) return;
    const url = buildGmailAuthUrl(signState(userId, provider));
    res.json({ url });
  } catch (err) {
    req.log.error({ err }, "Error building email connect auth URL");
    res.status(400).json({ error: "Invalid provider" });
  }
});

// GET /api/email-connections/:provider/callback
const settingsUrl = (status: "connected" | "error") => `${getBaseUrl()}/dashboard/settings?tab=integrations&email=${status}`;

router.get("/email-connections/:provider/callback", requireAuth, async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    if (!state || !verifyState(state, userId, provider) || !code) {
      res.redirect(settingsUrl("error"));
      return;
    }

    await connectEmailAccount(userId, provider, code);
    res.redirect(settingsUrl("connected"));
  } catch (err) {
    req.log.error({ err }, "Email connect OAuth callback failed");
    res.redirect(settingsUrl("error"));
  }
});

// DELETE /api/email-connections/:provider/disconnect
router.delete("/email-connections/:provider/disconnect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    await disconnectEmailAccount(userId, provider);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error disconnecting email account");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/email-connections/:provider/toggle
router.patch("/email-connections/:provider/toggle", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const provider = providerParam.parse(req.params.provider);
    const userId = getUserId(res);
    const body = z.object({ isEnabled: z.boolean() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    await setEmailConnectionEnabled(userId, provider, body.data.isEnabled);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error toggling email connection");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
