// Phase 135: the daily Google Play sync. Every company billed by Play is re-read from Google: renewals extend the period (and write the payment), a cancelled subscription keeps access until it ends,
// an expired, refunded or revoked one goes back to no plan (one subscription_canceled row), a company on hold or paused stops having the plan until Google says otherwise.
// Real-time developer notifications (Pub/Sub) are a later upgrade; until then a change reaches us within a day.
import { logger } from "../lib/logger.js";
import { applyPlayPurchase, playCompaniesToSync, type SyncTarget } from "./entitlement.js";
import { PlayError, playClientFromEnv, type PlayClient } from "./client.js";
import { readPurchase } from "./purchase.js";

export type PlaySyncResult = { ran: boolean; reason?: "not_configured"; checked: number; updated: number; ended: number; acknowledged: number; errors: number };

export type PlaySyncDeps = {
  client: Pick<PlayClient, "getSubscription" | "acknowledge"> | null;
  list: () => Promise<SyncTarget[]>;
  apply: typeof applyPlayPurchase;
  now: () => Date;
};

const defaults = (): PlaySyncDeps => ({ client: playClientFromEnv(), list: playCompaniesToSync, apply: applyPlayPurchase, now: () => new Date() });

export async function runPlaySync(over: Partial<PlaySyncDeps> = {}): Promise<PlaySyncResult> {
  const d = { ...defaults(), ...over };
  const out: PlaySyncResult = { ran: false, checked: 0, updated: 0, ended: 0, acknowledged: 0, errors: 0 };
  if (!d.client) return { ...out, reason: "not_configured" };
  out.ran = true;
  const targets = await d.list();
  let unavailableInARow = 0;
  for (const t of targets) {
    out.checked += 1;
    try {
      let purchase;
      try {
        purchase = readPurchase(await d.client.getSubscription(t.token), d.now());
        unavailableInARow = 0;
      } catch (err) {
        if (err instanceof PlayError && err.code === "PURCHASE_NOT_VALID") {
          // Google forgets old tokens: a purchase it no longer knows, past its period, is over. Before that, something is off and a person should look.
          if (t.periodEnd && t.periodEnd.getTime() < d.now().getTime()) purchase = readPurchase({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED" }, d.now());
          else throw err;
        } else throw err;
      }
      if (purchase.needsAcknowledge && purchase.entitled && purchase.productId) {
        try {
          await d.client.acknowledge(purchase.productId, t.token);
          out.acknowledged += 1;
        } catch (err) {
          logger.warn({ err, userId: t.userId }, "play acknowledge failed in the daily sync");
        }
      }
      await d.apply(t.userId, t.token, purchase, true);
      out.updated += 1;
      if (!purchase.entitled && purchase.status === "expired") out.ended += 1;
    } catch (err) {
      out.errors += 1;
      logger.error({ err, userId: t.userId }, "play sync failed for a company");
      if (err instanceof PlayError && err.code === "PLAY_NOT_CONFIGURED") break; // the key is the problem: every company would fail the same way
      if (err instanceof PlayError && err.code === "PLAY_UNAVAILABLE" && ++unavailableInARow >= 3) break; // Google is down: try again tomorrow
    }
  }
  return out;
}
