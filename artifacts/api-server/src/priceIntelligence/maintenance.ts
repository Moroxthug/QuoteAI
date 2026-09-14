import { db, priceIntelligenceTable, priceIntelligenceAlertsTable } from "@workspace/db";
import { and, desc, eq, gte, isNull } from "drizzle-orm";

const RECENT_SAMPLE_SIZE = 5;
// Need enough prior history beyond the recent sample to trust the comparison
// (otherwise a single early receipt would count as the whole "before" average).
const MIN_TOTAL_SAMPLES = RECENT_SAMPLE_SIZE + 3;
const TREND_THRESHOLD_PCT = 10;
// Runs on every daily cron tick, but only ever creates one alert per
// (userId, workType, zone) within this window — gives it an effectively
// weekly cadence without needing separate scheduling infrastructure.
const ALERT_DEDUPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ── Weekly-cadence price-trend check (cron) ─────────────────────────────────
// For every (userId, workType, zone) group with enough receipt history,
// compares the average of the most recent RECENT_SAMPLE_SIZE unit prices
// against the average of everything before that. Flags moves past the
// threshold as a dismissible alert — surfaced in Settings → Catalog.
export async function runPriceIntelligenceTrendCheck(now = new Date()): Promise<{ groupsChecked: number; alertsCreated: number }> {
  const rows = await db
    .select({
      userId: priceIntelligenceTable.userId,
      workType: priceIntelligenceTable.workType,
      zone: priceIntelligenceTable.zone,
      unitPrice: priceIntelligenceTable.unitPrice,
    })
    .from(priceIntelligenceTable)
    .orderBy(desc(priceIntelligenceTable.createdAt));

  type Group = { userId: string; workType: string; zone: string | null; prices: number[] };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const key = `${r.userId}::${r.workType}::${r.zone ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = { userId: r.userId, workType: r.workType, zone: r.zone, prices: [] };
      groups.set(key, g);
    }
    // rows are already sorted newest-first, so prices[] stays newest-first too
    g.prices.push(Number(r.unitPrice));
  }

  let groupsChecked = 0;
  let alertsCreated = 0;
  const dedupeSince = new Date(now.getTime() - ALERT_DEDUPE_WINDOW_MS);

  for (const g of groups.values()) {
    if (g.prices.length < MIN_TOTAL_SAMPLES) continue;
    groupsChecked++;

    const recent = g.prices.slice(0, RECENT_SAMPLE_SIZE);
    const prior = g.prices.slice(RECENT_SAMPLE_SIZE);
    const recentAvg = average(recent);
    const priorAvg = average(prior);
    if (priorAvg === 0) continue;

    const percentChange = ((recentAvg - priorAvg) / priorAvg) * 100;
    if (Math.abs(percentChange) < TREND_THRESHOLD_PCT) continue;

    const existing = await db
      .select({ id: priceIntelligenceAlertsTable.id })
      .from(priceIntelligenceAlertsTable)
      .where(
        and(
          eq(priceIntelligenceAlertsTable.userId, g.userId),
          eq(priceIntelligenceAlertsTable.workType, g.workType),
          g.zone ? eq(priceIntelligenceAlertsTable.zone, g.zone) : isNull(priceIntelligenceAlertsTable.zone),
          gte(priceIntelligenceAlertsTable.createdAt, dedupeSince)
        )
      )
      .limit(1);
    if (existing.length > 0) continue;

    await db.insert(priceIntelligenceAlertsTable).values({
      userId: g.userId,
      workType: g.workType,
      zone: g.zone,
      previousAvgPrice: priorAvg.toFixed(2),
      currentAvgPrice: recentAvg.toFixed(2),
      percentChange: percentChange.toFixed(2),
      direction: percentChange > 0 ? "up" : "down",
    });
    alertsCreated++;
  }

  return { groupsChecked, alertsCreated };
}
