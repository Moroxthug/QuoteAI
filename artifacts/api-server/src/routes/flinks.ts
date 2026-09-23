import { Router } from "express";
import { z } from "zod";
import { db, businessProfilesTable, hasFeature, minimumPlanFor } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { isIntegrationConfigured, refuseIfNotConfigured } from "../lib/integrationAvailability.js";
import { buildConnectUrl } from "../lib/flinksClient.js";
import {
  getFlinksConnection,
  connectFlinks,
  listFlinksAccounts,
  setSelectedAccount,
  setFlinksEnabled,
  disconnectFlinks,
  syncFlinksTransactions,
} from "../flinks/service.js";

const router = Router();

async function requireFlinksFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "flinks_bank_feed")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("flinks_bank_feed") };
}

// GET /api/flinks/status
router.get("/flinks/status", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const conn = await getFlinksConnection(userId);
    const available = isIntegrationConfigured("flinks");
    if (!conn) {
      res.json({ connected: false, available });
      return;
    }
    res.json({
      connected: true,
      available,
      institutionName: conn.institutionName,
      selectedAccount: conn.selectedAccount,
      isEnabled: conn.isEnabled,
      connectedAt: conn.connectedAt.toISOString(),
      lastSyncedAt: conn.lastSyncedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching Flinks status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/flinks/connect-url — the hosted Connect iframe URL; bank credentials are entered
// there directly with Flinks/the institution, never seen by QuoteAI (Flinks's PCI boundary).
router.get("/flinks/connect-url", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireFlinksFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Bank feed reconciliation requires the Elite plan" });
      return;
    }
    if (refuseIfNotConfigured(res, "flinks", "Flinks bank feed")) return;
    res.json({ url: buildConnectUrl() });
  } catch (err) {
    req.log.error({ err }, "Error building Flinks connect URL");
    res.status(502).json({ error: "FLINKS_NOT_CONFIGURED", message: "Flinks isn't available yet — accreditation hasn't been granted." });
  }
});

// POST /api/flinks/connect — the frontend calls this once Connect posts a LoginId back via
// postMessage; the backend never sees bank credentials, only the resulting LoginId.
router.post("/flinks/connect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireFlinksFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Bank feed reconciliation requires the Elite plan" });
      return;
    }
    const body = z.object({ loginId: z.string().trim().min(1), institutionName: z.string().trim().min(1).max(200) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const { connection, accounts } = await connectFlinks(userId, body.data.loginId, body.data.institutionName);
    res.json({ connected: true, institutionName: connection.institutionName, accounts });
  } catch (err) {
    req.log.error({ err }, "Error connecting Flinks");
    res.status(502).json({ error: "FLINKS_API_ERROR", message: "Couldn't reach Flinks — try again in a moment." });
  }
});

// GET /api/flinks/accounts — re-fetches the accounts at the connected institution, for the account picker
router.get("/flinks/accounts", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const accounts = await listFlinksAccounts(userId);
    res.json({ accounts });
  } catch (err) {
    req.log.error({ err }, "Error listing Flinks accounts");
    res.status(502).json({ error: "FLINKS_API_ERROR", message: "Couldn't reach Flinks — try again in a moment." });
  }
});

// PUT /api/flinks/account — choose which account reconciliation runs against
router.put("/flinks/account", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z
      .object({ id: z.string().min(1), name: z.string().min(1), institution: z.string(), last4: z.string().nullable() })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    await setSelectedAccount(userId, body.data);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error selecting Flinks account");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/flinks/toggle
router.patch("/flinks/toggle", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z.object({ isEnabled: z.boolean() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    await setFlinksEnabled(userId, body.data.isEnabled);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error toggling Flinks");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/flinks/disconnect
router.delete("/flinks/disconnect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    await disconnectFlinks(userId);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error disconnecting Flinks");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/flinks/sync — manually trigger a transaction pull (also runs daily via cron)
router.post("/flinks/sync", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireFlinksFeature(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const result = await syncFlinksTransactions(userId);
    res.json({ success: true, ...result });
  } catch (err) {
    req.log.error({ err }, "Error syncing Flinks transactions");
    res.status(502).json({ error: "FLINKS_API_ERROR", message: "Couldn't reach Flinks — try again in a moment." });
  }
});

// Phase 88: the bank lines themselves (list, candidates, match, ignore) moved to
// /api/books/bank — see routes/books.ts.

export default router;
