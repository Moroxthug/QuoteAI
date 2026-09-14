import { db, emailConnectionsTable, type EmailConnection, type EmailProvider } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "../lib/crypto.js";
import { exchangeGmailCode, refreshGmailToken, revokeGmailToken, getGmailAccountEmail } from "../lib/gmailSendClient.js";
import { logger } from "../lib/logger.js";

export async function listEmailConnections(userId: string): Promise<EmailConnection[]> {
  return db.select().from(emailConnectionsTable).where(eq(emailConnectionsTable.userId, userId));
}

export async function getEmailConnection(userId: string, provider: EmailProvider): Promise<EmailConnection | null> {
  const [conn] = await db
    .select()
    .from(emailConnectionsTable)
    .where(and(eq(emailConnectionsTable.userId, userId), eq(emailConnectionsTable.provider, provider)));
  return conn ?? null;
}

/** Exchanges an OAuth callback code for tokens, fetches the account email, and stores the connection. */
export async function connectEmailAccount(userId: string, provider: EmailProvider, code: string): Promise<EmailConnection> {
  const tokens = await exchangeGmailCode(code);
  const accessToken = tokens.access_token;
  const refreshToken = tokens.refresh_token;
  if (!refreshToken) throw new Error(`${provider} did not return a refresh token — reconnect and grant offline access`);
  const accountEmail = await getGmailAccountEmail(accessToken).catch(() => "");

  const [conn] = await db
    .insert(emailConnectionsTable)
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
      target: [emailConnectionsTable.userId, emailConnectionsTable.provider],
      set: {
        accountEmail,
        accessTokenEnc: encryptSecret(accessToken),
        refreshTokenEnc: encryptSecret(refreshToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isEnabled: true,
        connectedAt: new Date(),
        lastSendError: null,
      },
    })
    .returning();
  return conn!;
}

/** Returns a valid access token + the connected address, refreshing the token first if needed. Never throws. */
export async function getValidEmailAccessToken(userId: string, provider: EmailProvider): Promise<{ accessToken: string; accountEmail: string } | null> {
  const conn = await getEmailConnection(userId, provider);
  if (!conn || !conn.isEnabled) return null;

  const expiresSoon = conn.tokenExpiresAt.getTime() - Date.now() < 60_000;
  if (!expiresSoon) return { accessToken: decryptSecret(conn.accessTokenEnc), accountEmail: conn.accountEmail };

  try {
    const tokens = await refreshGmailToken(decryptSecret(conn.refreshTokenEnc));
    const refreshToken = tokens.refresh_token ?? decryptSecret(conn.refreshTokenEnc);
    await db
      .update(emailConnectionsTable)
      .set({ accessTokenEnc: encryptSecret(tokens.access_token), refreshTokenEnc: encryptSecret(refreshToken), tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000) })
      .where(and(eq(emailConnectionsTable.userId, userId), eq(emailConnectionsTable.provider, provider)));
    return { accessToken: tokens.access_token, accountEmail: conn.accountEmail };
  } catch (err) {
    logger.error({ err, userId, provider }, "Gmail send token refresh failed");
    return null;
  }
}

export async function disconnectEmailAccount(userId: string, provider: EmailProvider): Promise<void> {
  const conn = await getEmailConnection(userId, provider);
  if (conn) await revokeGmailToken(decryptSecret(conn.refreshTokenEnc));
  await db.delete(emailConnectionsTable).where(and(eq(emailConnectionsTable.userId, userId), eq(emailConnectionsTable.provider, provider)));
}

export async function setEmailConnectionEnabled(userId: string, provider: EmailProvider, isEnabled: boolean): Promise<void> {
  await db.update(emailConnectionsTable).set({ isEnabled }).where(and(eq(emailConnectionsTable.userId, userId), eq(emailConnectionsTable.provider, provider)));
}

export async function markEmailSendResult(userId: string, provider: EmailProvider, error: string | null): Promise<void> {
  await db.update(emailConnectionsTable).set({ lastSendAt: new Date(), lastSendError: error }).where(and(eq(emailConnectionsTable.userId, userId), eq(emailConnectionsTable.provider, provider)));
}
