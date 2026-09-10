import { db, incentivesCatalogTable } from "@workspace/db";
import { ne } from "drizzle-orm";
import { logger } from "./logger.js";
import { runIncentivesVerification } from "./incentivesVerification.js";

let cronTimer: NodeJS.Timeout | null = null;

export async function runDailyIncentivesVerification(): Promise<void> {
  try {
    logger.info("Executing Daily AI Incentive Agent verification (Scheduled Cron)...");
    const activeIncentives = await db
      .select()
      .from(incentivesCatalogTable)
      .where(ne(incentivesCatalogTable.stato, "closed"));

    if (activeIncentives.length === 0) return;

    const outcome = await runIncentivesVerification(activeIncentives);
    logger.info({ outcome }, "Daily AI Incentive verification completed.");
  } catch (err) {
    logger.error({ err }, "Error running Daily AI Incentive verification cron");
  }
}

export function startIncentivesCronScheduler(): void {
  if (cronTimer) return;
  logger.info("Initializing Daily AI Incentive Cron Scheduler (Interval: 24h)...");
  // Checks every night, or every exact 24 hours from server startup
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  cronTimer = setInterval(() => {
    void runDailyIncentivesVerification();
  }, TWENTY_FOUR_HOURS_MS);

  // Run an initial deferred check 60 seconds after startup if the last verification isn't recent
  setTimeout(() => {
    void (async () => {
      try {
        const [first] = await db.select().from(incentivesCatalogTable).limit(1);
        if (first && (!first.lastCheckedAt || (Date.now() - new Date(first.lastCheckedAt).getTime() > TWENTY_FOUR_HOURS_MS))) {
          await runDailyIncentivesVerification();
        }
      } catch {
        // DB might not be ready right at start
      }
    })();
  }, 60000);
}
