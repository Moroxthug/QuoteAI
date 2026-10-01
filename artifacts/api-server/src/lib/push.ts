import { db, pushSubscriptionsTable, deviceTokensTable, pushPreferencesTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { readPushKeys, sendWebPush, type PushMessage, type PushSubscriptionInput } from "./webPush";
import { readFcmCredentials, sendFcm } from "./fcm";
import { logger } from "./logger";

// ── Phase 77: push delivery for dashboard notifications ──────────────────────
// A subset of the bell's notification types also reaches the phone: the ones
// a contractor on site wants to know about right away (money in, signatures,
// client messages, crew hours). The subscription row is per browser; a
// browser that stopped listening (404/410) is deleted on the spot, a browser
// that keeps failing is dropped after MAX_FAILURES in a row.

/**
 * Notification types that go out as push as well as into the bell, grouped
 * into the categories a person can turn off for their phone (Phase 119,
 * push_preferences). Bell-only types are not listed.
 */
const PUSH_CATEGORIES = {
  // Signatures
  signatures: ["quote_accepted", "quote_declined", "contract_signed", "contract_declined", "change_order_signed"],
  // Payments
  payments: ["paid", "payment_recorded", "invoice_payment_reported", "etransfer_reported", "invoice_overdue", "milestone_payment_due"],
  // Conversations that need the contractor
  messages: ["client_message", "sms_reply"],
  // Crew hours (Phase 77), a crew member who cannot go on (Phase 86), a job ready to start
  crew: ["time_entry_submitted", "field_blocker", "job_setup_ready"],
  // Phase 79: a job crossing 90 % / 100 % of its cost budget
  budget: ["budget_alert", "budget_exceeded"],
  // Phase 87: a filing deadline or a licence renewal coming up
  compliance: ["compliance_due"],
  // Pocket (Phase 149, Settings → Notifications): a client opened a quote; a crew member arrived or
  // left a site (off until turned on); the 6:30 morning brief.
  views: ["quote_viewed"],
  checkins: ["crew_checkin"],
  brief: ["morning_brief"],
} as const satisfies Record<string, readonly string[]>;

/** Kinds that are off until the person turns them on (stored in push_preferences.enabled). */
export const PUSH_DEFAULT_OFF: ReadonlySet<string> = new Set(["checkins"]);

export type PushCategory = keyof typeof PUSH_CATEGORIES;
export const PUSH_CATEGORY_KEYS = Object.keys(PUSH_CATEGORIES) as PushCategory[];

const CATEGORY_OF_TYPE = new Map<string, PushCategory>(PUSH_CATEGORY_KEYS.flatMap((c) => PUSH_CATEGORIES[c].map((t) => [t, c] as const)));

function pushCategoryOf(type: string): PushCategory | null {
  return CATEGORY_OF_TYPE.get(type) ?? null;
}

const MAX_FAILURES = 5;

export function isPushConfigured(): boolean {
  return readPushKeys() !== null;
}

/** Phase 119: can the phone app get pushes (FIREBASE_SERVICE_ACCOUNT set)? */
export function isAppPushConfigured(): boolean {
  return readFcmCredentials() !== null;
}

export function pushPublicKey(): string | null {
  return readPushKeys()?.publicKey ?? null;
}

/** Upserts a browser subscription for the acting company. Re-subscribing from the same browser (same endpoint) moves the row, never duplicates it. */
export async function saveSubscription(params: { userId: string; memberUserId: string; subscription: PushSubscriptionInput; userAgent?: string | null; language?: "en" | "fr" }) {
  const { endpoint, keys } = params.subscription;
  const [row] = await db
    .insert(pushSubscriptionsTable)
    .values({ userId: params.userId, memberUserId: params.memberUserId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: params.userAgent ?? null, language: params.language ?? "en" })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { userId: params.userId, memberUserId: params.memberUserId, p256dh: keys.p256dh, auth: keys.auth, userAgent: params.userAgent ?? null, language: params.language ?? "en", failedAt: null, failureCount: 0 },
    })
    .returning();
  return row!;
}

export async function removeSubscription(params: { memberUserId: string; endpoint: string }): Promise<boolean> {
  const rows = await db.delete(pushSubscriptionsTable).where(and(eq(pushSubscriptionsTable.endpoint, params.endpoint), eq(pushSubscriptionsTable.memberUserId, params.memberUserId))).returning({ id: pushSubscriptionsTable.id });
  return rows.length > 0;
}

async function listSubscriptions(userId: string) {
  return db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
}

export type PushSendSummary = { sent: number; failed: number; removed: number; skipped: "not_configured" | "no_subscriptions" | null };

// ── Phase 119: the phone app (Firebase Cloud Messaging) ─────────────────────

/** Registers (or refreshes) one installed app for the acting company. The install id keeps one row per app; a token seen on another install moves. */
export async function saveDeviceToken(params: { userId: string; memberUserId: string; token: string; installId: string; platform: "android" | "ios"; appVersion?: string | null; language?: "en" | "fr" }) {
  const values = { userId: params.userId, memberUserId: params.memberUserId, token: params.token, installId: params.installId, platform: params.platform, appVersion: params.appVersion ?? null, language: params.language ?? "en" };
  return db.transaction(async (tx) => {
    await tx.delete(deviceTokensTable).where(and(eq(deviceTokensTable.token, params.token), sql`${deviceTokensTable.installId} <> ${params.installId}`));
    const [row] = await tx
      .insert(deviceTokensTable)
      .values(values)
      .onConflictDoUpdate({ target: deviceTokensTable.installId, set: { ...values, failedAt: null, failureCount: 0 } })
      .returning();
    return row!;
  });
}

/** Forgets one installed app (sign-out, or the person turned notifications off). */
export async function removeDeviceToken(params: { memberUserId: string; installId: string }): Promise<boolean> {
  const rows = await db.delete(deviceTokensTable).where(and(eq(deviceTokensTable.installId, params.installId), eq(deviceTokensTable.memberUserId, params.memberUserId))).returning({ id: deviceTokensTable.id });
  return rows.length > 0;
}

async function sendToDevices(userId: string, message: PushMessage, wanted: (memberUserId: string) => boolean, summary: PushSendSummary, category?: PushCategory): Promise<number> {
  const creds = readFcmCredentials();
  if (!creds) return 0;
  const rows = (await db.select().from(deviceTokensTable).where(eq(deviceTokensTable.userId, userId))).filter((r) => wanted(r.memberUserId));
  await Promise.all(
    rows.map(async (row) => {
      const result = await sendFcm(creds, row.token, { title: message.title, body: message.body, link: message.link, tag: message.tag, category });
      if (result.ok) {
        summary.sent++;
        await db.update(deviceTokensTable).set({ lastUsedAt: new Date(), failedAt: null, failureCount: 0 }).where(eq(deviceTokensTable.id, row.id));
        return;
      }
      summary.failed++;
      if (result.gone || row.failureCount + 1 >= MAX_FAILURES) {
        summary.removed++;
        await db.delete(deviceTokensTable).where(eq(deviceTokensTable.id, row.id));
        logger.info({ userId, platform: row.platform, status: result.status }, "App push token removed");
        return;
      }
      await db.update(deviceTokensTable).set({ failedAt: new Date(), failureCount: sql`${deviceTokensTable.failureCount} + 1` }).where(eq(deviceTokensTable.id, row.id));
      logger.warn({ userId, status: result.status, error: result.error }, "App push delivery failed");
    }),
  );
  return rows.length;
}

/** Whether a kind is off for someone: listed in muted, or off by default and not turned on. */
const isMuted = (row: { muted: string[]; enabled: string[] } | undefined, c: string) => (PUSH_DEFAULT_OFF.has(c) ? !(row?.enabled ?? []).includes(c) : (row?.muted ?? []).includes(c));

/** The categories one person has off for this company (the default-off ones unless turned on). */
export async function mutedCategories(userId: string, memberUserId: string): Promise<PushCategory[]> {
  const [row] = await db.select({ muted: pushPreferencesTable.muted, enabled: pushPreferencesTable.enabled }).from(pushPreferencesTable).where(and(eq(pushPreferencesTable.userId, userId), eq(pushPreferencesTable.memberUserId, memberUserId)));
  return PUSH_CATEGORY_KEYS.filter((c) => isMuted(row, c));
}

export async function setMutedCategories(userId: string, memberUserId: string, muted: PushCategory[]): Promise<PushCategory[]> {
  const off = new Set(muted.filter((c) => c in PUSH_CATEGORIES));
  const mutedRow = [...off].filter((c) => !PUSH_DEFAULT_OFF.has(c));
  const enabled = [...PUSH_DEFAULT_OFF].filter((c) => !off.has(c as PushCategory));
  await db
    .insert(pushPreferencesTable)
    .values({ userId, memberUserId, muted: mutedRow, enabled })
    .onConflictDoUpdate({ target: [pushPreferencesTable.userId, pushPreferencesTable.memberUserId], set: { muted: mutedRow, enabled, updatedAt: new Date() } });
  return PUSH_CATEGORY_KEYS.filter((c) => off.has(c));
}

/** Whether a member of a company has this category off (people with no row get the defaults). */
async function mutingTest(userId: string, category: PushCategory): Promise<(memberUserId: string) => boolean> {
  const rows = await db.select({ memberUserId: pushPreferencesTable.memberUserId, muted: pushPreferencesTable.muted, enabled: pushPreferencesTable.enabled }).from(pushPreferencesTable).where(eq(pushPreferencesTable.userId, userId));
  const byMember = new Map(rows.map((r) => [r.memberUserId, r]));
  return (memberUserId) => isMuted(byMember.get(memberUserId), category);
}

/** Sends one message to every subscribed browser and installed app of a company (optionally only one member's, or leaving out the people who muted its category). Never throws. */
export async function sendPushToCompany(userId: string, message: PushMessage, opts: { memberUserId?: string; category?: PushCategory } = {}): Promise<PushSendSummary> {
  const keys = readPushKeys();
  if (!keys && !isAppPushConfigured()) return { sent: 0, failed: 0, removed: 0, skipped: "not_configured" };
  const summary: PushSendSummary = { sent: 0, failed: 0, removed: 0, skipped: null };
  const muted = opts.category ? await mutingTest(userId, opts.category) : () => false;
  const wanted = (memberUserId: string) => (!opts.memberUserId || memberUserId === opts.memberUserId) && !muted(memberUserId);
  const devices = await sendToDevices(userId, message, wanted, summary, opts.category);
  const rows = keys ? (await listSubscriptions(userId)).filter((r) => wanted(r.memberUserId)) : [];
  if (rows.length === 0 && devices === 0) return { ...summary, skipped: "no_subscriptions" };
  await Promise.all(
    rows.map(async (row) => {
      const result = await sendWebPush(keys!, { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, { ...message, lang: row.language });
      if (result.ok) {
        summary.sent++;
        await db.update(pushSubscriptionsTable).set({ lastUsedAt: new Date(), failedAt: null, failureCount: 0 }).where(eq(pushSubscriptionsTable.id, row.id));
        return;
      }
      summary.failed++;
      if (result.gone || row.failureCount + 1 >= MAX_FAILURES) {
        summary.removed++;
        await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, row.id));
        logger.info({ userId, endpoint: row.endpoint.slice(0, 60), status: result.status }, "Push subscription removed");
        return;
      }
      await db.update(pushSubscriptionsTable).set({ failedAt: new Date(), failureCount: sql`${pushSubscriptionsTable.failureCount} + 1` }).where(eq(pushSubscriptionsTable.id, row.id));
      logger.warn({ userId, status: result.status, error: result.error }, "Push delivery failed");
    }),
  );
  return summary;
}

/** Called by createNotification: pushes the types in PUSH_CATEGORIES to the people who have not muted theirs, fire-and-forget. */
export async function pushForNotification(n: { userId: string; type: string; title: string; body?: string; link?: string | null; entityType?: string | null; entityId?: string | null }): Promise<void> {
  const category = pushCategoryOf(n.type);
  if (!category) return;
  if (!isPushConfigured() && !isAppPushConfigured()) return;
  try {
    await sendPushToCompany(n.userId, { title: n.title, body: n.body ?? "", link: n.link ?? "/dashboard/notifications", tag: n.entityType && n.entityId ? `${n.entityType}:${n.entityId}` : n.type }, { category });
  } catch (err) {
    logger.error({ err, type: n.type }, "Push for notification failed");
  }
}
