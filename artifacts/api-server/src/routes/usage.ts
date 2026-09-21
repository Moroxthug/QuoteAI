import { Router } from "express";
import { db, businessProfilesTable, usageDailySummaryTable, effectivePlan, MONTHLY_USAGE_ALLOWANCE, type UsageEventKind } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { logger } from "../lib/logger.js";

const router = Router();

// GET /api/usage/summary — company-facing usage panel (Phase 8 §4a): this
// month's AI/WhatsApp usage against the plan's allowance. Internal margin
// analysis lives at GET /api/admin/margin instead.
router.get("/usage/summary", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    const plan = effectivePlan(profile);

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const monthStartStr = monthStart.toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(usageDailySummaryTable)
      .where(and(eq(usageDailySummaryTable.userId, userId), gte(usageDailySummaryTable.date, monthStartStr)));

    const totals: Record<UsageEventKind, { quantity: number; costCents: number }> = {
      ai_text: { quantity: 0, costCents: 0 },
      ai_vision: { quantity: 0, costCents: 0 },
      whatsapp_message: { quantity: 0, costCents: 0 },
      email: { quantity: 0, costCents: 0 },
      storage_bytes: { quantity: 0, costCents: 0 },
      sms: { quantity: 0, costCents: 0 },
    };
    for (const row of rows) {
      totals[row.kind].quantity += Number(row.quantity);
      totals[row.kind].costCents += Number(row.costCents);
    }

    const allowance = MONTHLY_USAGE_ALLOWANCE[plan];

    const eventCountByKind = (kind: UsageEventKind) => rows.filter((r) => r.kind === kind).reduce((s, r) => s + r.eventCount, 0);

    res.json({
      plan,
      receiptScans: { used: eventCountByKind("ai_vision"), allowance: allowance.receiptScans },
      whatsappMessages: { used: eventCountByKind("whatsapp_message"), allowance: allowance.whatsappMessages },
      smsMessages: { used: Math.round(totals.sms.quantity), allowance: allowance.smsMessages },
      aiTokens: { used: totals.ai_text.quantity + totals.ai_vision.quantity },
      estimatedCostCents: Object.values(totals).reduce((s, t) => s + t.costCents, 0),
    });
  } catch (err) {
    logger.error({ err }, "Usage summary error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
