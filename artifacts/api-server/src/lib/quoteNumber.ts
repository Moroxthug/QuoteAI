import { db, quotesTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";

/**
 * Generates the next progressive quote number for a user.
 * Format: "N° {progressivo}.{anno} del {gg}/{mm}/{anno}"
 * The progressive is count(existing quotes) + 1.
 */
export async function generateNumeroPreventivo(userId: string): Promise<string> {
  const year = new Date().getFullYear();

  const [result] = await db
    .select({ count: count() })
    .from(quotesTable)
    .where(eq(quotesTable.userId, userId));

  const quoteCount = Number(result?.count ?? 0);
  const nextNumber = quoteCount + 1;

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");

  return `N° ${nextNumber}.${year} del ${dd}/${mm}/${year}`;
}
