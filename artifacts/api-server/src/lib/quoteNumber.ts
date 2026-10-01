import { db, quotesTable } from "@workspace/db";
import { and, eq, like } from "drizzle-orm";

/** The next short number for a company in a year: "Q-2026-001". Pure so it is tested (quoteNumber.test.ts). */
export function nextQuoteNumber(existing: (string | null)[], year: number): string {
  const re = new RegExp(`^Q-${year}-([0-9]+)$`);
  let max = 0;
  for (const n of existing) {
    const m = n ? re.exec(n.trim()) : null;
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Q-${year}-${String(max + 1).padStart(3, "0")}`;
}

/**
 * Generates the next progressive quote number for a user: "Q-{year}-{nnn}", counting up within the year
 * (it uses the highest number so far, so deleting a quote never makes two quotes share a number).
 * Older quotes keep the "No. 12.2026 - 2026-10-01" form they were given.
 */
export async function generateNumeroPreventivo(userId: string): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ n: quotesTable.numeroPreventivoData })
    .from(quotesTable)
    .where(and(eq(quotesTable.userId, userId), like(quotesTable.numeroPreventivoData, `Q-${year}-%`)));
  return nextQuoteNumber(rows.map((r) => r.n), year);
}
