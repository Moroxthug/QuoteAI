// Phase 135: turning a verified Google Play purchase into the company's plan and the owner's books. The Stripe webhook does the same for Stripe (app.ts); the two never touch the same company.
import { and, eq, inArray } from "drizzle-orm";
import { db, billingEventsTable, businessProfilesTable } from "@workspace/db";
import { subscriptionChanged } from "../groups/service.js";
import { logger } from "../lib/logger.js";
import { isPlayManaged } from "./provider.js";
import { canceledEventId, paymentCentsOf, paymentEventId, profileStatusOf, startedEventId, subscriptionMonthlyCents, type PlayPurchase } from "./purchase.js";

export type AppliedPlay = { plan: string | null; interval: string | null; founding: boolean; status: string; expiresAt: string | null; autoRenewing: boolean };

export const appliedOf = (p: PlayPurchase): AppliedPlay => ({
  plan: p.entitled ? (p.plan?.tier ?? null) : null,
  interval: p.entitled ? (p.plan?.interval ?? null) : null,
  founding: p.entitled ? (p.plan?.founding ?? false) : false,
  status: profileStatusOf(p),
  expiresAt: p.expiresAt?.toISOString() ?? null,
  autoRenewing: p.autoRenewing,
});

/** Which company holds this purchase token (null = nobody). */
export async function ownerOfToken(token: string): Promise<string | null> {
  const [row] = await db.select({ userId: businessProfilesTable.userId }).from(businessProfilesTable).where(eq(businessProfilesTable.playPurchaseToken, token));
  return row?.userId ?? null;
}

async function writeBillingRow(userId: string, row: { providerEventId: string; type: "payment" | "subscription_started" | "subscription_canceled"; plan: string | null; interval: string | null; amountCents: number; founding: boolean; at: Date; raw: Record<string, unknown> }): Promise<void> {
  // Tax 0 and fee 0 on purpose: Google Play prices are what the customer pays, and Google's cut (about 15%) is an estimate shown in the HQ notes, not stored.
  await db.insert(billingEventsTable).values({
    provider: "play", providerEventId: row.providerEventId, type: row.type, userId, customerId: null, plan: row.plan, interval: row.interval,
    amountCents: row.amountCents, taxCents: 0, feeCents: 0, currency: "cad", founding: row.founding ? 1 : 0, at: row.at, raw: row.raw,
  }).onConflictDoNothing({ target: [billingEventsTable.provider, billingEventsTable.providerEventId] });
}

/** The books for one purchase. Every row has a key made of the order / token and the expiry, so running this twice (verify, restore, the daily sync) writes each fact once. Never throws. */
export async function recordPlayBilling(userId: string, token: string, p: PlayPurchase, wasPaying: boolean): Promise<void> {
  try {
    const plan = p.plan?.tier ?? null;
    const interval = p.plan?.interval ?? null;
    const founding = p.plan?.founding ?? false;
    const raw = { productId: p.productId, basePlanId: p.basePlanId, status: p.status, test: p.testPurchase };
    if (p.entitled) {
      await writeBillingRow(userId, { providerEventId: startedEventId(token), type: "subscription_started", plan, interval, amountCents: subscriptionMonthlyCents(p), founding, at: new Date(), raw });
      if (p.status !== "grace" && p.expiresAt) await writeBillingRow(userId, { providerEventId: paymentEventId(token, p), type: "payment", plan, interval, amountCents: paymentCentsOf(p), founding, at: new Date(), raw });
    } else if (p.status === "expired" && wasPaying) {
      await writeBillingRow(userId, { providerEventId: canceledEventId(token, p), type: "subscription_canceled", plan, interval, amountCents: subscriptionMonthlyCents(p), founding, at: p.expiresAt ?? new Date(), raw });
    }
  } catch (err) {
    logger.warn({ err, userId }, "play billing event not saved");
  }
}

/**
 * Sets the company's plan from the purchase. `wasPaying` says the company had the Play plan before this call (for the one cancel event).
 * An entitled purchase also clears a group parent's coverage, like a Stripe checkout does. An expired one hands the company back to "no provider".
 */
export async function applyPlayPurchase(userId: string, token: string, p: PlayPurchase, wasPaying: boolean): Promise<AppliedPlay> {
  const a = appliedOf(p);
  const ended = !p.entitled && a.status === "cancelled";
  const set = {
    subscriptionPlan: a.plan,
    subscriptionStatus: a.status,
    subscriptionInterval: a.interval,
    subscriptionPeriodEnd: p.expiresAt,
    foundingPrice: a.founding,
    subscriptionProvider: ended ? null : ("play" as const),
    playPurchaseToken: token,
    playProductId: p.productId,
    playAutoRenewing: p.autoRenewing,
    ...(p.entitled ? { planCoveredBy: null } : {}),
    ...(ended ? { extraSeats: 0 } : {}),
  };
  await db.insert(businessProfilesTable).values({ userId, ...set }).onConflictDoUpdate({ target: businessProfilesTable.userId, set });
  await subscriptionChanged(userId, p.entitled, ended ? { ended: true } : {}).catch((err: unknown) => logger.warn({ err, userId }, "subscriptionChanged failed after a Play purchase"));
  await recordPlayBilling(userId, token, p, wasPaying);
  logger.info({ userId, plan: a.plan, status: a.status }, "Play purchase applied");
  return a;
}

export type SyncTarget = { userId: string; token: string; status: string | null; periodEnd: Date | null };

/** Companies the daily sync reads: Play billed, and still holding or possibly regaining the plan. */
export async function playCompaniesToSync(): Promise<SyncTarget[]> {
  const rows = await db.select({ userId: businessProfilesTable.userId, token: businessProfilesTable.playPurchaseToken, status: businessProfilesTable.subscriptionStatus, periodEnd: businessProfilesTable.subscriptionPeriodEnd })
    .from(businessProfilesTable)
    .where(and(eq(businessProfilesTable.subscriptionProvider, "play"), inArray(businessProfilesTable.subscriptionStatus, ["active", "past_due", "paused"])));
  return rows.filter((r): r is SyncTarget => !!r.token);
}

/** The Stripe webhook's guard (Phase 135): a company billed by Google Play keeps its Play plan whatever Stripe says about an old subscription. */
export async function playManagedUser(userId: string): Promise<boolean> {
  const [p] = await db.select({ subscriptionProvider: businessProfilesTable.subscriptionProvider }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return isPlayManaged(p);
}

export async function playManagedCustomer(stripeCustomerId: string): Promise<boolean> {
  const [p] = await db.select({ subscriptionProvider: businessProfilesTable.subscriptionProvider }).from(businessProfilesTable).where(eq(businessProfilesTable.stripeCustomerId, stripeCustomerId));
  return isPlayManaged(p);
}
