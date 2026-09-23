import { db, accountingLinksTable, type AccountingLink, type AccountingLinkType, type AccountingProvider } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

// Phase 88: "this QuoteAI thing IS that QuickBooks/Wave thing". One row per
// pair, looked up from either side. Every push checks it before creating
// anything, and every pull checks it before recording anything.

export async function getLink(userId: string, provider: AccountingProvider, entityType: AccountingLinkType, entityId: string): Promise<AccountingLink | null> {
  const [row] = await db
    .select()
    .from(accountingLinksTable)
    .where(and(eq(accountingLinksTable.userId, userId), eq(accountingLinksTable.provider, provider), eq(accountingLinksTable.entityType, entityType), eq(accountingLinksTable.entityId, entityId)));
  return row ?? null;
}

export async function linksFor(userId: string, provider: AccountingProvider, entityType: AccountingLinkType, entityIds: string[]): Promise<Map<string, AccountingLink>> {
  if (entityIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(accountingLinksTable)
    .where(and(eq(accountingLinksTable.userId, userId), eq(accountingLinksTable.provider, provider), eq(accountingLinksTable.entityType, entityType), inArray(accountingLinksTable.entityId, entityIds)));
  return new Map(rows.map((r) => [r.entityId, r]));
}

export async function findByExternal(userId: string, provider: AccountingProvider, externalType: string, externalId: string): Promise<AccountingLink | null> {
  const [row] = await db
    .select()
    .from(accountingLinksTable)
    .where(and(eq(accountingLinksTable.userId, userId), eq(accountingLinksTable.provider, provider), eq(accountingLinksTable.externalType, externalType), eq(accountingLinksTable.externalId, externalId)));
  return row ?? null;
}

/** First writer wins: a concurrent retry that created the same pair keeps the existing row. */
export async function putLink(params: { userId: string; provider: AccountingProvider; entityType: AccountingLinkType; entityId: string; externalId: string; externalType: string; origin?: "quoteai" | "external" }): Promise<void> {
  await db
    .insert(accountingLinksTable)
    .values({ ...params, origin: params.origin ?? "quoteai" })
    .onConflictDoNothing({ target: [accountingLinksTable.userId, accountingLinksTable.provider, accountingLinksTable.entityType, accountingLinksTable.entityId] });
}

export async function deleteLink(userId: string, provider: AccountingProvider, entityType: AccountingLinkType, entityId: string): Promise<void> {
  await db
    .delete(accountingLinksTable)
    .where(and(eq(accountingLinksTable.userId, userId), eq(accountingLinksTable.provider, provider), eq(accountingLinksTable.entityType, entityType), eq(accountingLinksTable.entityId, entityId)));
}
