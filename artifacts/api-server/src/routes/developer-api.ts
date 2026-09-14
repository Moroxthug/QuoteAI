import { Router } from "express";
import { z } from "zod";
import { db, businessProfilesTable, hasFeature, minimumPlanFor, AUTOMATION_EVENTS, type AutomationEvent } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId, getActorRole } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { createApiKey, listApiKeys, revokeApiKey } from "../lib/apiKeys.js";
import { createWebhook, listWebhooks, deleteWebhook, setWebhookEnabled } from "../lib/webhooks.js";

const router = Router();

async function requirePublicApiFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "public_api")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("public_api") };
}

function serializeApiKey(k: Awaited<ReturnType<typeof listApiKeys>>[number]) {
  return {
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    role: k.role,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  };
}

function serializeWebhook(w: Awaited<ReturnType<typeof listWebhooks>>[number]) {
  return { id: w.id, url: w.url, events: w.events, isEnabled: w.isEnabled, createdAt: w.createdAt.toISOString() };
}

// GET /api/developer/api-keys
router.get("/developer/api-keys", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const keys = await listApiKeys(userId);
    res.json({ items: keys.map(serializeApiKey), events: AUTOMATION_EVENTS });
  } catch (err) {
    req.log.error({ err }, "Error listing API keys");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/developer/api-keys — the raw key is returned once and never again
router.post("/developer/api-keys", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requirePublicApiFeature(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "The public API requires the Elite plan" }); return; }
    const body = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters" }); return; }
    const { key, rawKey } = await createApiKey(userId, getActorUserId(res), getActorRole(res), body.data.name);
    res.status(201).json({ key: serializeApiKey(key), rawKey });
  } catch (err) {
    req.log.error({ err }, "Error creating API key");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/developer/api-keys/:id
router.delete("/developer/api-keys/:id", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const ok = await revokeApiKey(userId, req.params.id as string);
    if (!ok) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error revoking API key");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/developer/webhooks
router.get("/developer/webhooks", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const webhooks = await listWebhooks(userId);
    res.json({ items: webhooks.map(serializeWebhook), events: AUTOMATION_EVENTS });
  } catch (err) {
    req.log.error({ err }, "Error listing webhooks");
    res.status(500).json({ error: "Internal server error" });
  }
});

const eventEnum = z.enum(AUTOMATION_EVENTS as unknown as [AutomationEvent, ...AutomationEvent[]]);

// POST /api/developer/webhooks — the signing secret is returned once and never again
router.post("/developer/webhooks", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requirePublicApiFeature(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Webhooks require the Elite plan" }); return; }
    const body = z.object({ url: z.string().url().max(500), events: z.array(eventEnum).min(1) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const { webhook, secret } = await createWebhook(userId, body.data.url, body.data.events);
    res.status(201).json({ webhook: serializeWebhook(webhook), secret });
  } catch (err) {
    req.log.error({ err }, "Error creating webhook");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/developer/webhooks/:id
router.patch("/developer/webhooks/:id", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z.object({ isEnabled: z.boolean() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters" }); return; }
    const ok = await setWebhookEnabled(userId, req.params.id as string, body.data.isEnabled);
    if (!ok) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error updating webhook");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/developer/webhooks/:id
router.delete("/developer/webhooks/:id", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const ok = await deleteWebhook(userId, req.params.id as string);
    if (!ok) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting webhook");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
