import { db, waveConnectionsTable, type WaveConnection, type WaveCategoryMap, type WaveAccountRef } from "@workspace/db";
import { eq } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "../lib/crypto.js";
import { exchangeCodeForTokens, refreshAccessToken, revokeToken, getBusiness, getFirstBusiness } from "../lib/waveClient.js";
import { logger } from "../lib/logger.js";

export async function getWaveConnection(userId: string): Promise<WaveConnection | null> {
  const [conn] = await db.select().from(waveConnectionsTable).where(eq(waveConnectionsTable.userId, userId));
  return conn ?? null;
}

/** Exchanges an OAuth callback code for tokens, resolves the business, and stores the connection. */
export async function connectWave(userId: string, code: string): Promise<WaveConnection> {
  const tokens = await exchangeCodeForTokens(code);

  let business = tokens.businessId ? await getBusiness(tokens.access_token, tokens.businessId).catch(() => null) : null;
  if (!business) business = await getFirstBusiness(tokens.access_token).catch(() => null);
  if (!business) throw new Error("Could not resolve a Wave business for this connection");

  const [conn] = await db
    .insert(waveConnectionsTable)
    .values({
      userId,
      businessId: business.id,
      businessName: business.name,
      accessTokenEnc: encryptSecret(tokens.access_token),
      refreshTokenEnc: encryptSecret(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      isEnabled: true,
    })
    .onConflictDoUpdate({
      target: waveConnectionsTable.userId,
      set: {
        businessId: business.id,
        businessName: business.name,
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

/** Returns a valid access token + businessId, refreshing it first if it's expired or about to. */
export async function getValidAccessToken(userId: string): Promise<{ accessToken: string; businessId: string } | null> {
  const conn = await getWaveConnection(userId);
  if (!conn) return null;

  const expiresSoon = conn.tokenExpiresAt.getTime() - Date.now() < 60_000;
  if (!expiresSoon) {
    return { accessToken: decryptSecret(conn.accessTokenEnc), businessId: conn.businessId };
  }

  try {
    const tokens = await refreshAccessToken(decryptSecret(conn.refreshTokenEnc));
    await db
      .update(waveConnectionsTable)
      .set({
        accessTokenEnc: encryptSecret(tokens.access_token),
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      })
      .where(eq(waveConnectionsTable.userId, userId));
    return { accessToken: tokens.access_token, businessId: conn.businessId };
  } catch (err) {
    logger.error({ err, userId }, "Wave token refresh failed");
    return null;
  }
}

export async function disconnectWave(userId: string): Promise<void> {
  await revokeToken();
  await db.delete(waveConnectionsTable).where(eq(waveConnectionsTable.userId, userId));
}

export async function setWaveEnabled(userId: string, isEnabled: boolean): Promise<void> {
  await db.update(waveConnectionsTable).set({ isEnabled }).where(eq(waveConnectionsTable.userId, userId));
}

export async function setCategoryMap(userId: string, categoryMap: WaveCategoryMap): Promise<void> {
  await db.update(waveConnectionsTable).set({ categoryMap }).where(eq(waveConnectionsTable.userId, userId));
}

export async function setPaymentAccount(userId: string, paymentAccount: WaveAccountRef | null): Promise<void> {
  await db.update(waveConnectionsTable).set({ paymentAccount }).where(eq(waveConnectionsTable.userId, userId));
}

export async function setIncomeAccount(userId: string, incomeAccount: WaveAccountRef | null): Promise<void> {
  await db.update(waveConnectionsTable).set({ incomeAccount }).where(eq(waveConnectionsTable.userId, userId));
}

export async function markSynced(userId: string): Promise<void> {
  await db.update(waveConnectionsTable).set({ lastSyncedAt: new Date() }).where(eq(waveConnectionsTable.userId, userId));
}
