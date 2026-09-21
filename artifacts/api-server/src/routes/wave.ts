import { Router } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  db,
  businessProfilesTable,
  automationRunsTable,
  waveSyncLogTable,
  hasFeature,
  minimumPlanFor,
  COST_CATEGORIES,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { logger } from "../lib/logger.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { isIntegrationConfigured, refuseIfNotConfigured } from "../lib/integrationAvailability.js";
import { retryAutomationNow } from "../lib/automation.js";
import { buildAuthUrl, listExpenseAccounts, listIncomeAccounts, listPaymentAccounts } from "../lib/waveClient.js";
import {
  getWaveConnection,
  connectWave,
  disconnectWave,
  setWaveEnabled,
  setCategoryMap,
  setPaymentAccount,
  setIncomeAccount,
  getValidAccessToken,
} from "../wave/service.js";

const router = Router();

if (!process.env.WAVE_CLIENT_ID || !process.env.WAVE_CLIENT_SECRET) {
  logger.error("WARNING: WAVE_CLIENT_ID/WAVE_CLIENT_SECRET not set. Wave integration will fail.");
}

// The OAuth `state` param is a self-contained, signed token (userId + nonce + issued-at) rather
// than a server-side session, since Vercel serverless functions share no memory between the
// /connect and /callback requests. Same shape as routes/quickbooks.ts.
const STATE_TTL_MS = 5 * 60_000;

function signState(userId: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  const nonce = randomBytes(8).toString("hex");
  const payload = `${userId}.${Date.now()}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyState(state: string, expectedUserId: string): boolean {
  try {
    const secret = process.env.BETTER_AUTH_SECRET ?? "";
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 4) return false;
    const [userId, iat, nonce, sig] = parts;
    const expectedSig = createHmac("sha256", secret).update(`${userId}.${iat}.${nonce}`).digest("base64url");
    const sigBuf = Buffer.from(sig!);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return false;
    if (userId !== expectedUserId) return false;
    if (Date.now() - Number(iat) > STATE_TTL_MS) return false;
    return true;
  } catch {
    return false;
  }
}

async function requireWaveFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "wave_sync")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("wave_sync") };
}

// GET /api/wave/status
router.get("/wave/status", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const conn = await getWaveConnection(userId);
    const available = isIntegrationConfigured("wave");
    if (!conn) {
      res.json({ connected: false, available });
      return;
    }
    res.json({
      connected: true,
      available,
      businessName: conn.businessName,
      isEnabled: conn.isEnabled,
      connectedAt: conn.connectedAt.toISOString(),
      lastSyncedAt: conn.lastSyncedAt?.toISOString() ?? null,
      hasPaymentAccount: !!conn.paymentAccount,
      paymentAccountName: conn.paymentAccount?.name ?? null,
      hasIncomeAccount: !!conn.incomeAccount,
      incomeAccountName: conn.incomeAccount?.name ?? null,
      categoryMap: Object.fromEntries(Object.entries(conn.categoryMap).map(([k, v]) => [k, v?.name ?? null])),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching Wave status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wave/connect — returns the Wave authorization URL to redirect the browser to
router.get("/wave/connect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireWaveFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Wave sync requires the Elite plan" });
      return;
    }
    if (refuseIfNotConfigured(res, "wave", "Wave")) return;
    res.json({ url: buildAuthUrl(signState(userId)) });
  } catch (err) {
    req.log.error({ err }, "Error building Wave auth URL");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wave/callback — Wave redirects the browser here after the company approves
// access; this exchanges the code server-side (never exposing it to frontend JS) and redirects
// back into Settings with a status flag.
const settingsUrl = (status: "connected" | "error") => `${getBaseUrl()}/dashboard/settings?tab=integrations&wave=${status}`;

router.get("/wave/callback", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    if (!state || !verifyState(state, userId) || !code) {
      res.redirect(settingsUrl("error"));
      return;
    }

    await connectWave(userId, code);
    res.redirect(settingsUrl("connected"));
  } catch (err) {
    req.log.error({ err }, "Wave OAuth callback failed");
    res.redirect(settingsUrl("error"));
  }
});

// DELETE /api/wave/disconnect
router.delete("/wave/disconnect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    await disconnectWave(userId);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error disconnecting Wave");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/wave/toggle
router.patch("/wave/toggle", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z.object({ isEnabled: z.boolean() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    await setWaveEnabled(userId, body.data.isEnabled);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error toggling Wave");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wave/accounts — Wave expense/income/asset accounts, for the mapping UI
router.get("/wave/accounts", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const token = await getValidAccessToken(userId);
    if (!token) {
      res.status(409).json({ error: "NOT_CONNECTED" });
      return;
    }
    const [expenseAccounts, incomeAccounts, paymentAccounts] = await Promise.all([
      listExpenseAccounts(token.accessToken, token.businessId),
      listIncomeAccounts(token.accessToken, token.businessId),
      listPaymentAccounts(token.accessToken, token.businessId),
    ]);
    res.json({
      expenseAccounts: expenseAccounts.map(a => ({ id: a.id, name: a.name })),
      incomeAccounts: incomeAccounts.map(a => ({ id: a.id, name: a.name })),
      paymentAccounts: paymentAccounts.map(a => ({ id: a.id, name: a.name })),
    });
  } catch (err) {
    req.log.error({ err }, "Error listing Wave accounts");
    res.status(502).json({ error: "WAVE_API_ERROR", message: "Couldn't reach Wave — try again in a moment." });
  }
});

// PUT /api/wave/mapping — set the payment/income accounts + per-category expense account mapping
router.put("/wave/mapping", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z
      .object({
        paymentAccount: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
        incomeAccount: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
        categoryMap: z
          .record(z.enum(COST_CATEGORIES), z.object({ id: z.string(), name: z.string() }).nullable())
          .optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    if (body.data.paymentAccount !== undefined) await setPaymentAccount(userId, body.data.paymentAccount);
    if (body.data.incomeAccount !== undefined) await setIncomeAccount(userId, body.data.incomeAccount);
    if (body.data.categoryMap) {
      const conn = await getWaveConnection(userId);
      const merged = { ...(conn?.categoryMap ?? {}) };
      for (const [category, account] of Object.entries(body.data.categoryMap)) {
        if (account) merged[category as (typeof COST_CATEGORIES)[number]] = account;
        else delete merged[category as (typeof COST_CATEGORIES)[number]];
      }
      await setCategoryMap(userId, merged);
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error updating Wave mapping");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/wave/sync-log — recent sync attempts (success + failure), for the status/retry UI
router.get("/wave/sync-log", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db
      .select()
      .from(waveSyncLogTable)
      .where(eq(waveSyncLogTable.userId, userId))
      .orderBy(desc(waveSyncLogTable.createdAt))
      .limit(50);
    res.json({
      entries: rows.map(r => ({
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        waveId: r.waveId,
        status: r.status,
        error: r.error,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching Wave sync log");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/wave/sync-log/retry — manually re-run a failed sync for one entity
router.post("/wave/sync-log/retry", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z.object({ entityType: z.enum(["invoice", "cost_entry"]), entityId: z.string() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const event = body.data.entityType === "invoice" ? "invoice.paid" : "cost.confirmed";
    const idempotencyKey = `${event}:${body.data.entityType}:${body.data.entityId}`;
    const [existing] = await db.select().from(automationRunsTable).where(eq(automationRunsTable.idempotencyKey, idempotencyKey));
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const result = await retryAutomationNow(idempotencyKey);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error retrying Wave sync");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
