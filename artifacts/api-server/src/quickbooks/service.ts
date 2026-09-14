import { db, quickbooksConnectionsTable, type QuickbooksConnection, type QuickbooksCategoryMap, type QuickbooksAccountRef } from "@workspace/db";
import { eq } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "../lib/crypto.js";
import { exchangeCodeForTokens, refreshAccessToken, revokeToken, getCompanyName, quickbooksEnvironment } from "../lib/quickbooksClient.js";
import { logger } from "../lib/logger.js";

export async function getQuickbooksConnection(userId: string): Promise<QuickbooksConnection | null> {
  const [conn] = await db.select().from(quickbooksConnectionsTable).where(eq(quickbooksConnectionsTable.userId, userId));
  return conn ?? null;
}

/** Exchanges an OAuth callback code for tokens, fetches the company name, and stores the connection. */
export async function connectQuickbooks(userId: string, code: string, realmId: string): Promise<QuickbooksConnection> {
  const tokens = await exchangeCodeForTokens(code);
  const companyName = await getCompanyName(realmId, tokens.access_token).catch(() => "");

  const [conn] = await db
    .insert(quickbooksConnectionsTable)
    .values({
      userId,
      realmId,
      environment: quickbooksEnvironment(),
      companyName,
      accessTokenEnc: encryptSecret(tokens.access_token),
      refreshTokenEnc: encryptSecret(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      isEnabled: true,
    })
    .onConflictDoUpdate({
      target: quickbooksConnectionsTable.userId,
      set: {
        realmId,
        environment: quickbooksEnvironment(),
        companyName,
        accessTokenEnc: encryptSecret(tokens.access_token),
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isEnabled: true,
        connectedAt: new Date(),
      },
    })
    .returning();
  return conn!;
}

/** Returns a valid access token + realmId, refreshing it first if it's expired or about to. */
export async function getValidAccessToken(userId: string): Promise<{ accessToken: string; realmId: string } | null> {
  const conn = await getQuickbooksConnection(userId);
  if (!conn) return null;

  const expiresSoon = conn.tokenExpiresAt.getTime() - Date.now() < 60_000;
  if (!expiresSoon) {
    return { accessToken: decryptSecret(conn.accessTokenEnc), realmId: conn.realmId };
  }

  try {
    const tokens = await refreshAccessToken(decryptSecret(conn.refreshTokenEnc));
    await db
      .update(quickbooksConnectionsTable)
      .set({
        accessTokenEnc: encryptSecret(tokens.access_token),
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      })
      .where(eq(quickbooksConnectionsTable.userId, userId));
    return { accessToken: tokens.access_token, realmId: conn.realmId };
  } catch (err) {
    logger.error({ err, userId }, "QuickBooks token refresh failed");
    return null;
  }
}

export async function disconnectQuickbooks(userId: string): Promise<void> {
  const conn = await getQuickbooksConnection(userId);
  if (conn) await revokeToken(decryptSecret(conn.refreshTokenEnc));
  await db.delete(quickbooksConnectionsTable).where(eq(quickbooksConnectionsTable.userId, userId));
}

export async function setQuickbooksEnabled(userId: string, isEnabled: boolean): Promise<void> {
  await db.update(quickbooksConnectionsTable).set({ isEnabled }).where(eq(quickbooksConnectionsTable.userId, userId));
}

export async function setCategoryMap(userId: string, categoryMap: QuickbooksCategoryMap): Promise<void> {
  await db.update(quickbooksConnectionsTable).set({ categoryMap }).where(eq(quickbooksConnectionsTable.userId, userId));
}

export async function setPaymentAccount(userId: string, paymentAccount: QuickbooksAccountRef | null): Promise<void> {
  await db.update(quickbooksConnectionsTable).set({ paymentAccount }).where(eq(quickbooksConnectionsTable.userId, userId));
}

export async function markSynced(userId: string): Promise<void> {
  await db.update(quickbooksConnectionsTable).set({ lastSyncedAt: new Date() }).where(eq(quickbooksConnectionsTable.userId, userId));
}
