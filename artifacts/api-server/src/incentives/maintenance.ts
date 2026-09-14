import { db, incentivesCatalogTable } from "@workspace/db";
import { and, asc, eq, isNotNull, ne } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const CHECK_BATCH_SIZE = 25;
const FETCH_TIMEOUT_MS = 8_000;

// ── Daily incentive freshness check (cron) ──────────────────────────────────
// Doesn't try to auto-discover new programs (too failure-prone to trust
// unsupervised) — it only re-fetches each catalog entry's official source URL
// and flags whether the page still loads, so a human knows which programs to
// re-check. `humanVerified` is untouched here — only a person can set that.
export async function runIncentivesFreshnessCheck(now = new Date()): Promise<{ checked: number; flagged: number }> {
  const due = await db
    .select()
    .from(incentivesCatalogTable)
    .where(and(isNotNull(incentivesCatalogTable.fonteUfficialeUrl), ne(incentivesCatalogTable.stato, "closed")))
    .orderBy(asc(incentivesCatalogTable.lastCheckedAt))
    .limit(CHECK_BATCH_SIZE);

  let flagged = 0;
  for (const item of due) {
    const stillLive = await urlLooksLive(item.fonteUfficialeUrl!);
    if (!stillLive) flagged++;
    await db
      .update(incentivesCatalogTable)
      .set({ isVerifiedByAi: stillLive, lastCheckedAt: now })
      .where(eq(incentivesCatalogTable.id, item.id));
  }
  return { checked: due.length, flagged };
}

async function urlLooksLive(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    return res.ok;
  } catch (err) {
    logger.warn({ err, url }, "Incentive source URL freshness check failed");
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
