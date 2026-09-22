import { db, pushSubscriptionsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { readPushKeys, sendWebPush, type PushMessage, type PushSubscriptionInput } from "./webPush";
import { logger } from "./logger";

// ── Phase 77: push delivery for dashboard notifications ──────────────────────
// A subset of the bell's notification types also reaches the phone: the ones
// a contractor on site wants to know about right away (money in, signatures,
// client messages, crew hours). The subscription row is per browser; a
// browser that stopped listening (404/410) is deleted on the spot, a browser
// that keeps failing is dropped after MAX_FAILURES in a row.

/** Notification types that go out as push as well as into the bell. */
const PUSH_NOTIFICATION_TYPES = new Set([
  // Signatures
  "quote_accepted",
  "contract_signed",
  "contract_declined",
  "change_order_signed",
  // Payments
  "paid",
  "payment_recorded",
  "invoice_payment_reported",
  "etransfer_reported",
  "invoice_overdue",
  "milestone_payment_due",
  // Follow-ups: conversations that need the contractor
  "client_message",
  "sms_reply",
  "time_entry_submitted",
  // Phase 79: money — a job crossing 90 % / 100 % of its cost budget
  "budget_alert",
  "budget_exceeded",
  "job_setup_ready",
]);

const MAX_FAILURES = 5;

export function isPushConfigured(): boolean {
  return readPushKeys() !== null;
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

/** Sends one message to every subscribed browser of a company (optionally only one member's). Never throws. */
export async function sendPushToCompany(userId: string, message: PushMessage, opts: { memberUserId?: string } = {}): Promise<PushSendSummary> {
  const keys = readPushKeys();
  if (!keys) return { sent: 0, failed: 0, removed: 0, skipped: "not_configured" };
  const rows = (await listSubscriptions(userId)).filter((r) => !opts.memberUserId || r.memberUserId === opts.memberUserId);
  if (rows.length === 0) return { sent: 0, failed: 0, removed: 0, skipped: "no_subscriptions" };
  const summary: PushSendSummary = { sent: 0, failed: 0, removed: 0, skipped: null };
  await Promise.all(
    rows.map(async (row) => {
      const result = await sendWebPush(keys, { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, { ...message, lang: row.language });
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

/** Called by createNotification: pushes the types in PUSH_NOTIFICATION_TYPES, fire-and-forget. */
export async function pushForNotification(n: { userId: string; type: string; title: string; body?: string; link?: string | null; entityType?: string | null; entityId?: string | null }): Promise<void> {
  if (!PUSH_NOTIFICATION_TYPES.has(n.type)) return;
  if (!isPushConfigured()) return;
  try {
    await sendPushToCompany(n.userId, { title: n.title, body: n.body ?? "", link: n.link ?? "/dashboard/notifications", tag: n.entityType && n.entityId ? `${n.entityType}:${n.entityId}` : n.type });
  } catch (err) {
    logger.error({ err, type: n.type }, "Push for notification failed");
  }
}
