import { Router } from "express";
import { db, businessProfilesTable, hasFeature, minimumPlanFor } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { isIntegrationConfigured, refuseIfNotConfigured } from "../lib/integrationAvailability.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { getConnectAccount, createOnboardingLink } from "../invoices/stripeConnect.js";
import { confirmEtransferReceived, rejectEtransferReport } from "../invoices/service.js";
import { serializeInvoice } from "./invoices.js";
import { connectFeeBps, connectFeePercentLabel } from "../lib/billing.js";

// Phase 15: the company side of invoice payment collection — Stripe Connect
// onboarding/status for the card rail, and the contractor's confirm/reject
// actions on a customer's e-Transfer self-report.

const router = Router();

async function requireCardPaymentsFeature(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "invoice_card_payments")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("invoice_card_payments") };
}

const settingsUrl = (status: "connected" | "error") => `${getBaseUrl()}/dashboard/settings?tab=integrations&stripeConnect=${status}`;

// GET /api/invoice-payments/connect/status
router.get("/invoice-payments/connect/status", requireAuth, requirePermission("integrations", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const conn = await getConnectAccount(userId);
    const available = isIntegrationConfigured("stripe");
    // Phase 73: the platform fee is disclosed before the contractor connects, not after.
    const fee = { applicationFeeBps: connectFeeBps(), applicationFeePercent: connectFeePercentLabel() };
    if (!conn) { res.json({ connected: false, available, ...fee }); return; }
    res.json({
      connected: true,
      available,
      ...fee,
      chargesEnabled: conn.chargesEnabled,
      payoutsEnabled: conn.payoutsEnabled,
      detailsSubmitted: conn.detailsSubmitted,
      connectedAt: conn.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching Stripe Connect status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/invoice-payments/connect/onboard — returns the Stripe-hosted onboarding URL
router.post("/invoice-payments/connect/onboard", requireAuth, requirePermission("integrations", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireCardPaymentsFeature(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan, message: "Online card payments require the Elite plan" }); return; }
    if (refuseIfNotConfigured(res, "stripe", "Online card payments")) return;
    const url = await createOnboardingLink(userId);
    res.json({ url });
  } catch (err) {
    req.log.error({ err }, "Error creating Stripe Connect onboarding link");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/invoice-payments/connect/refresh — Stripe sends the browser here when an onboarding link expired
router.get("/invoice-payments/connect/refresh", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const url = await createOnboardingLink(userId);
    res.redirect(url);
  } catch (err) {
    req.log.error({ err }, "Error refreshing Stripe Connect onboarding link");
    res.redirect(settingsUrl("error"));
  }
});

// GET /api/invoice-payments/connect/return — Stripe sends the browser here once onboarding is done (or abandoned)
router.get("/invoice-payments/connect/return", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const conn = await getConnectAccount(userId);
    if (conn) {
      const { syncConnectAccountStatus } = await import("../invoices/stripeConnect.js");
      await syncConnectAccountStatus(conn.stripeAccountId);
    }
    res.redirect(settingsUrl("connected"));
  } catch (err) {
    req.log.error({ err }, "Error handling Stripe Connect return");
    res.redirect(settingsUrl("error"));
  }
});

// POST /api/invoices/:id/confirm-etransfer — contractor confirms a customer's "I've sent it" self-report
router.post("/invoices/:id/confirm-etransfer", requireAuth, requirePermission("invoicing", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const invoice = await confirmEtransferReceived({ invoiceId: req.params.id as string, userId, ip: req.ip });
    res.json({ invoice: serializeInvoice(invoice) });
  } catch (err) {
    req.log.error({ err }, "Error confirming e-Transfer");
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Invoice not found") { res.status(404).json({ error: "Not found" }); return; }
    res.status(400).json({ error: "Could not confirm the payment", message });
  }
});

// POST /api/invoices/:id/reject-etransfer — contractor says the customer's self-report was wrong
router.post("/invoices/:id/reject-etransfer", requireAuth, requirePermission("invoicing", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const invoice = await rejectEtransferReport({ invoiceId: req.params.id as string, userId, ip: req.ip });
    res.json({ invoice: serializeInvoice(invoice) });
  } catch (err) {
    req.log.error({ err }, "Error rejecting e-Transfer self-report");
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Invoice not found") { res.status(404).json({ error: "Not found" }); return; }
    res.status(400).json({ error: "Could not reject the report", message });
  }
});

export default router;
