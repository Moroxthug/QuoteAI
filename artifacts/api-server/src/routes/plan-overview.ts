import { Router } from "express";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db, businessProfilesTable, quotesTable, usageDailySummaryTable, PRODUCT_FEATURES, MONTHLY_USAGE_ALLOWANCE, activeJobLimit, effectivePlan, hasFeature, type UsageEventKind } from "@workspace/db";
import { requireAuth, getUserId } from "../middlewares/authMiddleware.js";
import { activeJobUsage } from "../jobs/activeJobCap.js";
import { seatCount } from "../team/seats.js";
import { PLANS } from "./payments.js";
import { logger } from "../lib/logger.js";

const router = Router();

// GET /api/plan/overview — Plan and billing in the phone app: the plan and its state, this month's use against what the plan allows (logins, quotes, open jobs,
// receipt scans, texts), and which features it has. Read-only and open to every role (a member sees usage only); buying and changing the plan are on quoteai.ca.
router.get("/plan/overview", requireAuth, async (req, res) => {
  try {
    const orgId = getUserId(res);
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, orgId));
    const plan = effectivePlan(profile);
    const def = PLANS.find((p) => p.id === plan) ?? null;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const [seats, jobs, quotes, usage] = await Promise.all([
      seatCount(orgId),
      activeJobUsage(orgId),
      def?.quotaPerMonth != null
        ? db.select({ n: sql<number>`count(*)::int` }).from(quotesTable).where(and(eq(quotesTable.userId, orgId), gte(quotesTable.createdAt, monthStart), lt(quotesTable.createdAt, nextMonth)))
        : Promise.resolve(null),
      db.select().from(usageDailySummaryTable).where(and(eq(usageDailySummaryTable.userId, orgId), gte(usageDailySummaryTable.date, `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-01`))),
    ]);
    const events = (kind: UsageEventKind) => usage.filter((r) => r.kind === kind).reduce((s, r) => s + r.eventCount, 0);
    const smsUsed = Math.round(usage.filter((r) => r.kind === "sms").reduce((s, r) => s + Number(r.quantity), 0));
    const allowance = MONTHLY_USAGE_ALLOWANCE[plan];
    const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    res.json({
      plan,
      name: def?.name ?? (plan === "free" ? "Free" : plan),
      status: profile?.subscriptionStatus ?? null,
      active: profile?.subscriptionStatus === "active" || profile?.subscriptionStatus === "trialing",
      interval: profile?.subscriptionInterval ?? "month",
      periodEnd: profile?.subscriptionPeriodEnd?.toISOString() ?? null,
      coveredBy: profile?.planCoveredBy ?? null,
      resetsOn: day(nextMonth),
      logins: { used: seats.used, limit: seats.limit },
      quotes: def?.quotaPerMonth != null ? { used: quotes?.[0]?.n ?? 0, limit: def.quotaPerMonth } : null,
      openJobs: activeJobLimit(profile) !== null ? { used: jobs.active, limit: jobs.limit } : null,
      receiptScans: allowance.receiptScans === null ? null : { used: events("ai_vision"), limit: allowance.receiptScans },
      texts: allowance.smsMessages === null || allowance.smsMessages === 0 ? null : { used: smsUsed, limit: allowance.smsMessages },
      features: PRODUCT_FEATURES.filter((f) => hasFeature(profile, f)),
    });
  } catch (err) {
    logger.error({ err }, "Plan overview error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
