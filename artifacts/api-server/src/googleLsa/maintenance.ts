import { db, googleLsaConnectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { pollLeadsForConnection } from "./service.js";
import { logger } from "../lib/logger.js";

/**
 * Cron hook: polls every enabled Google LSA connection for new leads (no webhook/push exists for
 * LSA, unlike Meta). No-ops for every company until a connection exists (i.e. until Google's
 * developer-token approval + manager account are in place) — same shape as Flinks's poll check.
 */
export async function runGoogleLsaPollCheck(): Promise<{ connectionsChecked: number; leadsImported: number }> {
  const connections = await db.select().from(googleLsaConnectionsTable).where(eq(googleLsaConnectionsTable.isEnabled, true));

  let leadsImported = 0;
  for (const conn of connections) {
    try {
      const result = await pollLeadsForConnection(conn);
      leadsImported += result.imported;
    } catch (err) {
      logger.error({ err, userId: conn.userId }, "Google LSA poll failed for connection");
    }
  }
  return { connectionsChecked: connections.length, leadsImported };
}
