import { Router } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db, businessProfilesTable, metaLeadAdsImportLogTable, hasFeature, minimumPlanFor } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { logger } from "../lib/logger.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { buildAuthUrl } from "../lib/metaLeadAdsClient.js";
import {
  getMetaLeadAdsConnection,
  connectMetaLeadAds,
  disconnectMetaLeadAds,
  setMetaLeadAdsEnabled,
  importLeadFromWebhook,
} from "../metaLeadAds/service.js";

const router = Router();

const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const META_LEADGEN_VERIFY_TOKEN = process.env.META_LEADGEN_VERIFY_TOKEN;
if (!process.env.META_APP_ID || !META_APP_SECRET) {
  logger.error("WARNING: META_APP_ID/META_APP_SECRET not set. Meta Lead Ads integration will fail.");
}
if (!META_LEADGEN_VERIFY_TOKEN) {
  logger.error("WARNING: META_LEADGEN_VERIFY_TOKEN is not set. Meta Lead Ads webhook verification will fail.");
}

// The OAuth `state` param is a self-contained, signed token (userId + nonce + issued-at) rather
// than a server-side session, since Vercel serverless functions share no memory between the
// /connect and /callback requests. Same shape as routes/wave.ts and routes/quickbooks.ts.
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

async function requireMetaLeadAdsFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "meta_lead_ads")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("meta_lead_ads") };
}

// GET /api/meta-lead-ads/status
router.get("/meta-lead-ads/status", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const conn = await getMetaLeadAdsConnection(userId);
    if (!conn) {
      res.json({ connected: false });
      return;
    }
    res.json({
      connected: true,
      pageName: conn.pageName,
      isEnabled: conn.isEnabled,
      connectedAt: conn.connectedAt.toISOString(),
      lastLeadAt: conn.lastLeadAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching Meta Lead Ads status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/meta-lead-ads/connect — returns the Facebook Login authorization URL to redirect the browser to
router.get("/meta-lead-ads/connect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireMetaLeadAdsFeature(userId);
    if (!gate.ok) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Meta Lead Ads capture requires the Elite plan" });
      return;
    }
    res.json({ url: buildAuthUrl(signState(userId)) });
  } catch (err) {
    req.log.error({ err }, "Error building Meta Lead Ads auth URL");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/meta-lead-ads/callback — Meta redirects the browser here after the company approves
// access; this exchanges the code server-side and redirects back into Settings with a status flag.
const settingsUrl = (status: "connected" | "error") => `${getBaseUrl()}/dashboard/settings?tab=integrations&metaLeadAds=${status}`;

router.get("/meta-lead-ads/callback", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;

    if (!state || !verifyState(state, userId) || !code) {
      res.redirect(settingsUrl("error"));
      return;
    }

    await connectMetaLeadAds(userId, code);
    res.redirect(settingsUrl("connected"));
  } catch (err) {
    req.log.error({ err }, "Meta Lead Ads OAuth callback failed");
    res.redirect(settingsUrl("error"));
  }
});

// DELETE /api/meta-lead-ads/disconnect
router.delete("/meta-lead-ads/disconnect", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    await disconnectMetaLeadAds(userId);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error disconnecting Meta Lead Ads");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/meta-lead-ads/toggle
router.patch("/meta-lead-ads/toggle", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const isEnabled = req.body?.isEnabled;
    if (typeof isEnabled !== "boolean") {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    await setMetaLeadAdsEnabled(userId, isEnabled);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error toggling Meta Lead Ads");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/meta-lead-ads/import-log — recent leadgen webhook events (imported/duplicate/failed)
router.get("/meta-lead-ads/import-log", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db
      .select()
      .from(metaLeadAdsImportLogTable)
      .where(eq(metaLeadAdsImportLogTable.userId, userId))
      .orderBy(desc(metaLeadAdsImportLogTable.createdAt))
      .limit(50);
    res.json({
      entries: rows.map(r => ({
        id: r.id,
        metaLeadId: r.metaLeadId,
        formId: r.formId,
        status: r.status,
        error: r.error,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching Meta Lead Ads import log");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/meta-lead-ads/webhook — Meta webhook verification (same hub.challenge handshake as WhatsApp's) ──
router.get("/meta-lead-ads/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === META_LEADGEN_VERIFY_TOKEN) {
    logger.info("Meta Lead Ads webhook verified");
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: "Forbidden" });
  }
});

// ── POST /api/meta-lead-ads/webhook — incoming `leadgen` field change notifications ──
const processedLeadIds = new Set<string>();
function isDuplicateLead(leadgenId: string): boolean {
  if (processedLeadIds.has(leadgenId)) return true;
  processedLeadIds.add(leadgenId);
  if (processedLeadIds.size > 2000) {
    const ids = Array.from(processedLeadIds);
    processedLeadIds.clear();
    ids.slice(-1000).forEach(id => processedLeadIds.add(id));
  }
  return false;
}

type LeadgenWebhookBody = {
  entry?: { id: string; changes?: { field: string; value?: { leadgen_id?: string; page_id?: string; form_id?: string } }[] }[];
};

// Signature already verified in app.ts (before express.json() parses the body) — same as
// /api/whatsapp/webhook. By the time a request reaches this router, it's authentic.
router.post("/meta-lead-ads/webhook", async (req, res) => {
  res.status(200).json({ status: "ok" });

  try {
    const body = req.body as LeadgenWebhookBody;
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "leadgen") continue;
        const leadgenId = change.value?.leadgen_id;
        const pageId = change.value?.page_id ?? entry.id;
        if (!leadgenId) continue;
        if (isDuplicateLead(leadgenId)) {
          logger.info({ leadgenId }, "Meta Lead Ads webhook event deduplicated");
          continue;
        }
        await importLeadFromWebhook(pageId, leadgenId);
      }
    }
  } catch (err) {
    logger.error({ err }, "Meta Lead Ads webhook processing failed");
  }
});

export default router;
