import { db, flinksConnectionsTable, flinksTransactionsTable, costEntriesTable, type FlinksConnection, type FlinksAccountRef } from "@workspace/db";
import { and, eq, gte, lte } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "../lib/crypto.js";
import { getAccountsDetail, type FlinksAccountDetail } from "../lib/flinksClient.js";
import { logger } from "../lib/logger.js";

export async function getFlinksConnection(userId: string): Promise<FlinksConnection | null> {
  const [conn] = await db.select().from(flinksConnectionsTable).where(eq(flinksConnectionsTable.userId, userId));
  return conn ?? null;
}

/** Stores the Connect LoginId (encrypted) and the accounts Flinks reported, before an account is chosen for reconciliation. */
export async function connectFlinks(userId: string, loginId: string, institutionName: string): Promise<{ connection: FlinksConnection; accounts: FlinksAccountDetail[] }> {
  const accounts = await getAccountsDetail(loginId, institutionName);

  const [conn] = await db
    .insert(flinksConnectionsTable)
    .values({ userId, loginIdEnc: encryptSecret(loginId), institutionName, isEnabled: true })
    .onConflictDoUpdate({
      target: flinksConnectionsTable.userId,
      set: { loginIdEnc: encryptSecret(loginId), institutionName, isEnabled: true, connectedAt: new Date(), selectedAccount: null },
    })
    .returning();
  return { connection: conn!, accounts };
}

export async function listFlinksAccounts(userId: string): Promise<FlinksAccountDetail[]> {
  const conn = await getFlinksConnection(userId);
  if (!conn) throw new Error("Not connected");
  return getAccountsDetail(decryptSecret(conn.loginIdEnc), conn.institutionName);
}

export async function setSelectedAccount(userId: string, account: FlinksAccountRef): Promise<void> {
  await db.update(flinksConnectionsTable).set({ selectedAccount: account }).where(eq(flinksConnectionsTable.userId, userId));
}

export async function setFlinksEnabled(userId: string, isEnabled: boolean): Promise<void> {
  await db.update(flinksConnectionsTable).set({ isEnabled }).where(eq(flinksConnectionsTable.userId, userId));
}

export async function disconnectFlinks(userId: string): Promise<void> {
  await db.delete(flinksConnectionsTable).where(eq(flinksConnectionsTable.userId, userId));
}

// A bank debit is matched to a cost entry with the same absolute total, within a
// few days either side — receipts get entered a day or two off from the actual
// charge date, so an exact-date match would miss most real matches. No AI call:
// amount is the strong signal here, same "deterministic over AI" choice as the
// incentives keyword matcher.
const MATCH_WINDOW_DAYS = 4;

/** Fetches recent transactions for the connected account, upserts them, and auto-matches debits to unmatched cost entries. */
export async function syncFlinksTransactions(userId: string): Promise<{ fetched: number; matched: number }> {
  const conn = await getFlinksConnection(userId);
  if (!conn || !conn.isEnabled || !conn.selectedAccount) return { fetched: 0, matched: 0 };

  const accounts = await getAccountsDetail(decryptSecret(conn.loginIdEnc), conn.institutionName);
  const account = accounts.find((a) => a.id === conn.selectedAccount!.id);
  if (!account) return { fetched: 0, matched: 0 };

  let matched = 0;
  for (const tx of account.transactions) {
    const [existing] = await db
      .select({ id: flinksTransactionsTable.id })
      .from(flinksTransactionsTable)
      .where(and(eq(flinksTransactionsTable.userId, userId), eq(flinksTransactionsTable.flinksTransactionId, tx.id)));
    if (existing) continue;

    let matchedCostEntryId: string | null = null;
    let autoMatched = false;
    if (tx.amountCents < 0) {
      const target = Math.abs(tx.amountCents);
      const txDate = new Date(tx.date);
      const windowStart = new Date(txDate.getTime() - MATCH_WINDOW_DAYS * 86_400_000);
      const windowEnd = new Date(txDate.getTime() + MATCH_WINDOW_DAYS * 86_400_000);
      const candidates = await db
        .select({ id: costEntriesTable.id, totalCents: costEntriesTable.totalCents })
        .from(costEntriesTable)
        .where(
          and(
            eq(costEntriesTable.userId, userId),
            eq(costEntriesTable.totalCents, target),
            gte(costEntriesTable.date, windowStart),
            lte(costEntriesTable.date, windowEnd),
          ),
        )
        .limit(1);
      if (candidates[0]) {
        matchedCostEntryId = candidates[0].id;
        autoMatched = true;
        matched++;
      }
    }

    await db.insert(flinksTransactionsTable).values({
      userId,
      flinksTransactionId: tx.id,
      date: new Date(tx.date),
      description: tx.description,
      amountCents: tx.amountCents,
      balanceCents: tx.balanceCents,
      matchStatus: matchedCostEntryId ? "matched" : "unmatched",
      matchedCostEntryId,
      autoMatched,
      raw: tx as unknown as Record<string, unknown>,
    });
  }

  await db.update(flinksConnectionsTable).set({ lastSyncedAt: new Date() }).where(eq(flinksConnectionsTable.userId, userId));
  logger.info({ userId, fetched: account.transactions.length, matched }, "Flinks transaction sync complete");
  return { fetched: account.transactions.length, matched };
}

export async function manuallyMatch(userId: string, transactionId: string, costEntryId: string): Promise<void> {
  await db
    .update(flinksTransactionsTable)
    .set({ matchStatus: "matched", matchedCostEntryId: costEntryId, autoMatched: false })
    .where(and(eq(flinksTransactionsTable.id, transactionId), eq(flinksTransactionsTable.userId, userId)));
}

export async function ignoreTransaction(userId: string, transactionId: string): Promise<void> {
  await db
    .update(flinksTransactionsTable)
    .set({ matchStatus: "ignored", matchedCostEntryId: null })
    .where(and(eq(flinksTransactionsTable.id, transactionId), eq(flinksTransactionsTable.userId, userId)));
}

export async function unmatch(userId: string, transactionId: string): Promise<void> {
  await db
    .update(flinksTransactionsTable)
    .set({ matchStatus: "unmatched", matchedCostEntryId: null, autoMatched: false })
    .where(and(eq(flinksTransactionsTable.id, transactionId), eq(flinksTransactionsTable.userId, userId)));
}
