import { db, calendarConnectionsTable, type CalendarConnection, type CalendarProvider } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "../lib/crypto.js";
import { exchangeGoogleCode, refreshGoogleToken, revokeGoogleToken, getGoogleAccountEmail } from "../lib/googleCalendarClient.js";
import { exchangeOutlookCode, refreshOutlookToken, getOutlookAccountEmail } from "../lib/outlookCalendarClient.js";
import { logger } from "../lib/logger.js";

export async function listCalendarConnections(userId: string): Promise<CalendarConnection[]> {
  return db.select().from(calendarConnectionsTable).where(eq(calendarConnectionsTable.userId, userId));
}

export async function getCalendarConnection(userId: string, provider: CalendarProvider): Promise<CalendarConnection | null> {
  const [conn] = await db
    .select()
    .from(calendarConnectionsTable)
    .where(and(eq(calendarConnectionsTable.userId, userId), eq(calendarConnectionsTable.provider, provider)));
  return conn ?? null;
}

/** Exchanges an OAuth callback code for tokens, fetches the account email, and stores the connection. */
export async function connectCalendar(userId: string, provider: CalendarProvider, code: string): Promise<CalendarConnection> {
  const tokens =
    provider === "google" ? await exchangeGoogleCode(code) : await exchangeOutlookCode(code);
  const accessToken = tokens.access_token;
  const refreshToken = provider === "google" ? (tokens as { refresh_token?: string }).refresh_token : (tokens as { refresh_token: string }).refresh_token;
  if (!refreshToken) throw new Error(`${provider} did not return a refresh token — reconnect and grant offline access`);
  const accountEmail = await (provider === "google" ? getGoogleAccountEmail(accessToken) : getOutlookAccountEmail(accessToken)).catch(() => "");

  const [conn] = await db
    .insert(calendarConnectionsTable)
    .values({
      userId,
      provider,
      accountEmail,
      accessTokenEnc: encryptSecret(accessToken),
      refreshTokenEnc: encryptSecret(refreshToken),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      isEnabled: true,
    })
    .onConflictDoUpdate({
      target: [calendarConnectionsTable.userId, calendarConnectionsTable.provider],
      set: {
        accountEmail,
        accessTokenEnc: encryptSecret(accessToken),
        refreshTokenEnc: encryptSecret(refreshToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isEnabled: true,
        connectedAt: new Date(),
      },
    })
    .returning();
  return conn!;
}

/** Returns a valid access token, refreshing it first if it's expired or about to. */
export async function getValidCalendarAccessToken(userId: string, provider: CalendarProvider): Promise<string | null> {
  const conn = await getCalendarConnection(userId, provider);
  if (!conn || !conn.isEnabled) return null;

  const expiresSoon = conn.tokenExpiresAt.getTime() - Date.now() < 60_000;
  if (!expiresSoon) return decryptSecret(conn.accessTokenEnc);

  try {
    const tokens = provider === "google" ? await refreshGoogleToken(decryptSecret(conn.refreshTokenEnc)) : await refreshOutlookToken(decryptSecret(conn.refreshTokenEnc));
    const refreshToken = (tokens as { refresh_token?: string }).refresh_token ?? decryptSecret(conn.refreshTokenEnc);
    await db
      .update(calendarConnectionsTable)
      .set({
        accessTokenEnc: encryptSecret(tokens.access_token),
        refreshTokenEnc: encryptSecret(refreshToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      })
      .where(and(eq(calendarConnectionsTable.userId, userId), eq(calendarConnectionsTable.provider, provider)));
    return tokens.access_token;
  } catch (err) {
    logger.error({ err, userId, provider }, "Calendar token refresh failed");
    return null;
  }
}

export async function disconnectCalendar(userId: string, provider: CalendarProvider): Promise<void> {
  const conn = await getCalendarConnection(userId, provider);
  if (conn && provider === "google") await revokeGoogleToken(decryptSecret(conn.refreshTokenEnc));
  await db.delete(calendarConnectionsTable).where(and(eq(calendarConnectionsTable.userId, userId), eq(calendarConnectionsTable.provider, provider)));
}

export async function setCalendarEnabled(userId: string, provider: CalendarProvider, isEnabled: boolean): Promise<void> {
  await db.update(calendarConnectionsTable).set({ isEnabled }).where(and(eq(calendarConnectionsTable.userId, userId), eq(calendarConnectionsTable.provider, provider)));
}

export async function markCalendarSynced(userId: string, provider: CalendarProvider): Promise<void> {
  await db.update(calendarConnectionsTable).set({ lastSyncedAt: new Date() }).where(and(eq(calendarConnectionsTable.userId, userId), eq(calendarConnectionsTable.provider, provider)));
}
