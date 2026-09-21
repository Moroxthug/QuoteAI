import { Router } from "express";
import { z } from "zod";
import { db, businessProfilesTable, hasFeature, minimumPlanFor } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { isIntegrationConfigured, refuseIfNotConfigured } from "../lib/integrationAvailability.js";
import {
  getFinanceitConnection,
  setFinanceitDealerId,
  setFinanceitEnabled,
  disconnectFinanceit,
} from "../financeit/service.js";

const router = Router();

async function requireFinanceitFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "financeit")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("financeit") };
}

// GET /api/financeit/status
router.get("/financeit/status", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const conn = await getFinanceitConnection(userId);
    const available = isIntegrationConfigured("financeit");
    if (!conn) {
      res.json({ connected: false, available });
      return;
    }
    res.json({
      connected: true,
      available,
      dealerId: conn.dealerId,
      isEnabled: conn.isEnabled,
      connectedAt: conn.connectedAt.toISOString(),
      lastAppliedAt: conn.lastAppliedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching Financeit status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/financeit/dealer — a company enters its own already-approved Financeit dealer id.
// QuoteAI's own app_id/app_secret cover the platform-level API call; the dealer id scopes
// each call to that company's Financeit account (the documented partner_id model).
router.put("/financeit/dealer", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireFinanceitFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Financing requires the Elite plan" });
      return;
    }
    const body = z.object({ dealerId: z.string().trim().min(1).max(200) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Enter a valid Financeit dealer ID" });
      return;
    }
    if (refuseIfNotConfigured(res, "financeit", "Financeit")) return;
    const conn = await setFinanceitDealerId(userId, body.data.dealerId);
    res.json({ connected: true, dealerId: conn.dealerId, isEnabled: conn.isEnabled });
  } catch (err) {
    req.log.error({ err }, "Error saving Financeit dealer ID");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/financeit/toggle
router.patch("/financeit/toggle", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z.object({ isEnabled: z.boolean() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    await setFinanceitEnabled(userId, body.data.isEnabled);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error toggling Financeit");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/financeit/disconnect
router.delete("/financeit/disconnect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    await disconnectFinanceit(userId);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error disconnecting Financeit");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
