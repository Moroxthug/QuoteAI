import {
  db,
  metaLeadAdsConnectionsTable,
  metaLeadAdsImportLogTable,
  leadsTable,
  leadEventsTable,
  type MetaLeadAdsConnection,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "../lib/crypto.js";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getFirstPage,
  subscribePageToLeadgen,
  getLeadData,
  extractContactFields,
} from "../lib/metaLeadAdsClient.js";
import { automationSettingsFor, leadFollowupDays, stageDueAt } from "../lib/followupCadence.js";
import { logger } from "../lib/logger.js";

const USER_TOKEN_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000; // Meta long-lived user tokens last ~60 days

export async function getMetaLeadAdsConnection(userId: string): Promise<MetaLeadAdsConnection | null> {
  const [conn] = await db.select().from(metaLeadAdsConnectionsTable).where(eq(metaLeadAdsConnectionsTable.userId, userId));
  return conn ?? null;
}

export async function getMetaLeadAdsConnectionByPageId(pageId: string): Promise<MetaLeadAdsConnection | null> {
  const [conn] = await db.select().from(metaLeadAdsConnectionsTable).where(eq(metaLeadAdsConnectionsTable.pageId, pageId));
  return conn ?? null;
}

/**
 * Exchanges the OAuth code for a long-lived user token, resolves the first Page it grants access
 * to, subscribes that Page to the leadgen webhook field, and stores the connection.
 */
export async function connectMetaLeadAds(userId: string, code: string): Promise<MetaLeadAdsConnection> {
  const shortLived = await exchangeCodeForToken(code);
  const longLived = await exchangeForLongLivedToken(shortLived.access_token);

  const page = await getFirstPage(longLived.access_token);
  if (!page) throw new Error("This Facebook account doesn't manage any Pages to connect");

  await subscribePageToLeadgen(page.id, page.access_token);

  const [conn] = await db
    .insert(metaLeadAdsConnectionsTable)
    .values({
      userId,
      pageId: page.id,
      pageName: page.name,
      pageAccessTokenEnc: encryptSecret(page.access_token),
      userTokenExpiresAt: new Date(Date.now() + (longLived.expires_in ? longLived.expires_in * 1000 : USER_TOKEN_LIFETIME_MS)),
      isEnabled: true,
    })
    .onConflictDoUpdate({
      target: metaLeadAdsConnectionsTable.userId,
      set: {
        pageId: page.id,
        pageName: page.name,
        pageAccessTokenEnc: encryptSecret(page.access_token),
        userTokenExpiresAt: new Date(Date.now() + (longLived.expires_in ? longLived.expires_in * 1000 : USER_TOKEN_LIFETIME_MS)),
        isEnabled: true,
        connectedAt: new Date(),
      },
    })
    .returning();
  return conn!;
}

export async function disconnectMetaLeadAds(userId: string): Promise<void> {
  await db.delete(metaLeadAdsConnectionsTable).where(eq(metaLeadAdsConnectionsTable.userId, userId));
}

export async function setMetaLeadAdsEnabled(userId: string, isEnabled: boolean): Promise<void> {
  await db.update(metaLeadAdsConnectionsTable).set({ isEnabled }).where(eq(metaLeadAdsConnectionsTable.userId, userId));
}

async function logImport(userId: string, metaLeadId: string, formId: string | null, status: "imported" | "duplicate" | "failed", raw: Record<string, unknown>, error?: string): Promise<void> {
  await db.insert(metaLeadAdsImportLogTable).values({ userId, metaLeadId, formId, status, error: error ?? null, raw });
}

/**
 * Imports one Lead Ads submission after a `leadgen` webhook event: fetches the full lead payload,
 * writes it into the Phase 9 leads pipeline with CASL consent recorded (the customer's own Meta
 * instant-form opt-in is the consent basis), and logs the attempt either way.
 */
export async function importLeadFromWebhook(pageId: string, leadgenId: string): Promise<void> {
  const conn = await getMetaLeadAdsConnectionByPageId(pageId);
  if (!conn || !conn.isEnabled) return;

  const [existing] = await db
    .select({ id: metaLeadAdsImportLogTable.id })
    .from(metaLeadAdsImportLogTable)
    .where(eq(metaLeadAdsImportLogTable.metaLeadId, leadgenId));
  if (existing) {
    logger.info({ leadgenId }, "Meta Lead Ads webhook deduplicated");
    return;
  }

  try {
    const pageAccessToken = decryptSecret(conn.pageAccessTokenEnc);
    const leadData = await getLeadData(leadgenId, pageAccessToken);
    const { name, email, phone } = extractContactFields(leadData.field_data);

    if (!name && !email && !phone) {
      await logImport(conn.userId, leadgenId, leadData.form_id ?? null, "failed", leadData as unknown as Record<string, unknown>, "No usable contact fields in submission");
      return;
    }

    const [lead] = await db
      .insert(leadsTable)
      .values({
        userId: conn.userId,
        name: name ?? "Facebook lead",
        email,
        phone,
        preferredChannel: email ? "email" : phone ? "sms" : "email",
        source: "meta_lead_ads",
        status: "new",
        consentSource: "meta_lead_ads",
        metaLeadId: leadgenId,
        metaFormId: leadData.form_id ?? null,
        metaCampaignId: leadData.campaign_id ?? null,
        metaCampaignName: leadData.campaign_name ?? null,
        metaAdId: leadData.ad_id ?? null,
        nextFollowUpAt: stageDueAt(leadFollowupDays(await automationSettingsFor(conn.userId)), 0),
      })
      .returning();

    await db.insert(leadEventsTable).values({
      leadId: lead!.id,
      userId: conn.userId,
      type: "created",
      payload: { source: "meta_lead_ads", metaLeadId: leadgenId, formId: leadData.form_id, adId: leadData.ad_id, campaignId: leadData.campaign_id },
    });
    await db.insert(leadEventsTable).values({
      leadId: lead!.id,
      userId: conn.userId,
      type: "consent_recorded",
      payload: { consentSource: "meta_lead_ads" },
    });

    await db.update(metaLeadAdsConnectionsTable).set({ lastLeadAt: new Date() }).where(eq(metaLeadAdsConnectionsTable.userId, conn.userId));
    await logImport(conn.userId, leadgenId, leadData.form_id ?? null, "imported", leadData as unknown as Record<string, unknown>);
  } catch (err) {
    logger.error({ err, pageId, leadgenId }, "Meta Lead Ads import failed");
    await logImport(conn.userId, leadgenId, null, "failed", {}, err instanceof Error ? err.message : String(err));
  }
}
