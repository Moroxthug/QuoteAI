import {
  db,
  googleLsaConnectionsTable,
  googleLsaImportLogTable,
  leadsTable,
  leadEventsTable,
  type GoogleLsaConnection,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "../lib/crypto.js";
import { exchangeCode, refreshAccessToken, queryNewLeads, type GoogleLsaLeadRow } from "../lib/googleLsaClient.js";
import { automationSettingsFor, leadFollowupDays, stageDueAt } from "../lib/followupCadence.js";
import { logger } from "../lib/logger.js";

export async function getGoogleLsaConnection(userId: string): Promise<GoogleLsaConnection | null> {
  const [conn] = await db.select().from(googleLsaConnectionsTable).where(eq(googleLsaConnectionsTable.userId, userId));
  return conn ?? null;
}

/**
 * Exchanges the OAuth code for a refresh token and stores the connection. Google OAuth alone
 * doesn't tell us which LSA account to poll, so the caller (the callback route) passes the
 * customer's LSA account id through as a query param collected from the user.
 */
export async function connectGoogleLsa(userId: string, code: string, lsaCustomerId: string): Promise<GoogleLsaConnection> {
  const tokens = await exchangeCode(code);
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token — the account may already be connected elsewhere; revoke access at myaccount.google.com/permissions and try again");
  }

  const [conn] = await db
    .insert(googleLsaConnectionsTable)
    .values({
      userId,
      lsaCustomerId,
      refreshTokenEnc: encryptSecret(tokens.refresh_token),
      isEnabled: true,
    })
    .onConflictDoUpdate({
      target: googleLsaConnectionsTable.userId,
      set: {
        lsaCustomerId,
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        isEnabled: true,
        connectedAt: new Date(),
      },
    })
    .returning();
  return conn!;
}

export async function disconnectGoogleLsa(userId: string): Promise<void> {
  await db.delete(googleLsaConnectionsTable).where(eq(googleLsaConnectionsTable.userId, userId));
}

export async function setGoogleLsaEnabled(userId: string, isEnabled: boolean): Promise<void> {
  await db.update(googleLsaConnectionsTable).set({ isEnabled }).where(eq(googleLsaConnectionsTable.userId, userId));
}

async function logImport(userId: string, leadId: string, leadType: string | null, status: "imported" | "duplicate" | "failed", raw: Record<string, unknown>, error?: string): Promise<void> {
  await db.insert(googleLsaImportLogTable).values({ userId, googleLsaLeadId: leadId, leadType, status, error: error ?? null, raw });
}

/**
 * Polls one connection's LSA account for leads created since `lastPolledAt` (or the last 24h on
 * first poll), writes each new one into the Phase 9 leads pipeline with CASL consent recorded (the
 * customer's own contact through Google's LSA platform is the consent basis), and logs every attempt
 * either way. Dedup is by checking the import log for the lead id before inserting, same pattern as
 * Meta Lead Ads' webhook dedup.
 */
export async function pollLeadsForConnection(conn: GoogleLsaConnection): Promise<{ fetched: number; imported: number }> {
  const since = conn.lastPolledAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString().slice(0, 19).replace("T", " ");

  const refreshToken = decryptSecret(conn.refreshTokenEnc);
  const { access_token: accessToken } = await refreshAccessToken(refreshToken);

  const rows = await queryNewLeads(conn.lsaCustomerId, accessToken, sinceIso);

  let imported = 0;
  for (const row of rows) {
    imported += await importOneLead(conn, row);
  }

  await db.update(googleLsaConnectionsTable).set({ lastPolledAt: new Date() }).where(eq(googleLsaConnectionsTable.userId, conn.userId));
  return { fetched: rows.length, imported };
}

async function importOneLead(conn: GoogleLsaConnection, row: GoogleLsaLeadRow): Promise<number> {
  const lead = row.localServicesLead;
  const leadId = lead.id;

  const [existing] = await db
    .select({ id: googleLsaImportLogTable.id })
    .from(googleLsaImportLogTable)
    .where(eq(googleLsaImportLogTable.googleLsaLeadId, leadId));
  if (existing) {
    logger.info({ leadId }, "Google LSA lead deduplicated");
    return 0;
  }

  try {
    // The `local_services_lead` resource itself carries no contact details — those live on the
    // linked `local_services_lead_conversation` resource (transcript/phone number), which is out
    // of scope for this scaffold and left as a follow-up query once developer-token access is live.
    const [inserted] = await db
      .insert(leadsTable)
      .values({
        userId: conn.userId,
        name: "Google Local Services Ads lead",
        source: "google_lsa",
        status: "new",
        consentSource: "google_lsa",
        googleLsaLeadId: leadId,
        googleLsaLeadType: lead.leadType ?? null,
        googleLsaCategory: lead.category ?? null,
        nextFollowUpAt: stageDueAt(leadFollowupDays(await automationSettingsFor(conn.userId)), 0),
      })
      .returning();

    await db.insert(leadEventsTable).values({
      leadId: inserted!.id,
      userId: conn.userId,
      type: "created",
      payload: { source: "google_lsa", googleLsaLeadId: leadId, leadType: lead.leadType, category: lead.category },
    });
    await db.insert(leadEventsTable).values({
      leadId: inserted!.id,
      userId: conn.userId,
      type: "consent_recorded",
      payload: { consentSource: "google_lsa" },
    });

    await db.update(googleLsaConnectionsTable).set({ lastLeadAt: new Date() }).where(eq(googleLsaConnectionsTable.userId, conn.userId));
    await logImport(conn.userId, leadId, lead.leadType ?? null, "imported", lead as unknown as Record<string, unknown>);
    return 1;
  } catch (err) {
    logger.error({ err, userId: conn.userId, leadId }, "Google LSA lead import failed");
    await logImport(conn.userId, leadId, lead.leadType ?? null, "failed", {}, err instanceof Error ? err.message : String(err));
    return 0;
  }
}
