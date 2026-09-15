import { db, flinksConnectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { syncFlinksTransactions } from "./service.js";
import { logger } from "../lib/logger.js";

/** Daily cron hook: pulls fresh transactions for every enabled Flinks connection. No-ops for every company until a connection exists (i.e. until accreditation is granted). */
export async function runFlinksSyncCheck(): Promise<{ connectionsChecked: number; transactionsFetched: number }> {
  const connections = await db.select().from(flinksConnectionsTable).where(eq(flinksConnectionsTable.isEnabled, true));

  let transactionsFetched = 0;
  for (const conn of connections) {
    try {
      const result = await syncFlinksTransactions(conn.userId);
      transactionsFetched += result.fetched;
    } catch (err) {
      logger.error({ err, userId: conn.userId }, "Flinks sync failed for connection");
    }
  }
  return { connectionsChecked: connections.length, transactionsFetched };
}
