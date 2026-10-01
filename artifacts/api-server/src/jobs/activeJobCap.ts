// Phase 99 (2026-09-26): Pro runs up to 3 jobs at once; Business and Elite have
// no cap (ACTIVE_JOB_LIMIT in lib/db/src/schema/plans.ts).
//
// A job counts while it is confirmed and neither completed nor archived. The
// cap is checked where a person opens a job — "Start job", restoring an
// archived one, confirming a proposed setup — never where a signed contract
// creates one: that job waits in "pending review" (which does not count) until
// there is room or the company upgrades, so a signature is never lost.

import type { Response } from "express";
import { db, projectsTable, businessProfilesTable, activeJobLimit } from "@workspace/db";
import { and, eq, isNull, ne, sql } from "drizzle-orm";

export async function activeJobUsage(orgId: string, excludeJobId?: string): Promise<{ limit: number | null; active: number }> {
  const [profile] = await db
    .select({ subscriptionPlan: businessProfilesTable.subscriptionPlan, subscriptionStatus: businessProfilesTable.subscriptionStatus, featureFlags: businessProfilesTable.featureFlags })
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.userId, orgId));
  const limit = activeJobLimit(profile);
  if (limit === null) return { limit: null, active: 0 };
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.userId, orgId),
        eq(projectsTable.setupStatus, "confirmed"),
        isNull(projectsTable.completedAt),
        isNull(projectsTable.archivedAt),
        ...(excludeJobId ? [ne(projectsTable.id, excludeJobId)] : []),
      ),
    );
  return { limit, active: row?.n ?? 0 };
}

/**
 * Answers 402 JOB_LIMIT (with the numbers and the plan that lifts it) and
 * returns false when opening one more job would pass the plan's cap.
 */
export async function ensureRoomForJob(orgId: string, res: Response, excludeJobId?: string): Promise<boolean> {
  const { limit, active } = await activeJobUsage(orgId, excludeJobId);
  if (limit === null || active < limit) return true;
  res.status(402).json({
    error: "JOB_LIMIT",
    message: `Your plan runs ${limit} jobs at a time. Finish or archive one, or move to Business for unlimited jobs.`,
    limit,
    active,
    requiredPlan: "monthly_business",
  });
  return false;
}
