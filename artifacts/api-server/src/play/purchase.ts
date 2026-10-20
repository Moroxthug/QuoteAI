// Phase 135: Google's SubscriptionPurchaseV2 (androidpublisher v3, purchases.subscriptionsv2.get) read into what we need. Pure.
import { createHash } from "node:crypto";
import { listPriceCents, monthlyCentsOf, planFromPlay, type PlayPlan } from "./products.js";

export type PlayMoney = { currencyCode?: string; units?: string | number; nanos?: number };

/** The part of SubscriptionPurchaseV2 we read (the reply has more). */
export type SubscriptionPurchaseV2 = {
  kind?: string;
  regionCode?: string;
  latestOrderId?: string;
  startTime?: string;
  subscriptionState?: string;
  acknowledgementState?: string;
  linkedPurchaseToken?: string;
  testPurchase?: Record<string, never>;
  lineItems?: Array<{
    productId?: string;
    expiryTime?: string;
    latestSuccessfulOrderId?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean; recurringPrice?: PlayMoney };
    prepaidPlan?: { allowExtendAfterTime?: string };
    offerDetails?: { basePlanId?: string; offerId?: string; offerTags?: string[] };
  }>;
  canceledStateContext?: Record<string, unknown>;
  pausedStateContext?: { autoResumeTime?: string };
};

/** What the subscription is worth to us right now. */
export type PlayStatus =
  | "active" // paid and current
  | "grace" // payment failed, Google is retrying: keep access
  | "canceled" // cancelled by the user, access until expiry
  | "on_hold" // payment failed past the grace period: no access
  | "paused"
  | "expired"
  | "pending" // payment not completed yet
  | "unknown";

export type PlayPurchase = {
  status: PlayStatus;
  /** Whether the company has the plan right now. */
  entitled: boolean;
  /** Null when the product/base plan pair is not one of ours. */
  plan: PlayPlan | null;
  productId: string | null;
  basePlanId: string | null;
  expiresAt: Date | null;
  autoRenewing: boolean;
  /** The purchase still has to be acknowledged (within 3 days, or Google refunds it). */
  needsAcknowledge: boolean;
  orderId: string | null;
  /** The price of one payment, CAD cents; null when Google did not say (or not in CAD). */
  priceCents: number | null;
  testPurchase: boolean;
};

const STATE: Record<string, PlayStatus> = {
  SUBSCRIPTION_STATE_ACTIVE: "active",
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "grace",
  SUBSCRIPTION_STATE_CANCELED: "canceled",
  SUBSCRIPTION_STATE_ON_HOLD: "on_hold",
  SUBSCRIPTION_STATE_PAUSED: "paused",
  SUBSCRIPTION_STATE_EXPIRED: "expired",
  SUBSCRIPTION_STATE_PENDING: "pending",
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: "expired",
};

/** units + nanos to cents, only for CAD (our books are CAD). */
export function moneyToCents(m: PlayMoney | undefined): number | null {
  if (!m || (m.currencyCode ?? "").toUpperCase() !== "CAD") return null;
  const units = Number(m.units ?? 0);
  const nanos = Number(m.nanos ?? 0);
  if (!Number.isFinite(units) || !Number.isFinite(nanos)) return null;
  const cents = Math.round(units * 100 + nanos / 10_000_000);
  return cents > 0 ? cents : null;
}

/** Reads Google's reply. `now` decides whether a cancelled subscription still has time left. */
export function readPurchase(raw: SubscriptionPurchaseV2, now: Date = new Date()): PlayPurchase {
  const status = STATE[raw.subscriptionState ?? ""] ?? "unknown";
  const line = raw.lineItems?.[0];
  const expiry = line?.expiryTime ? new Date(line.expiryTime) : null;
  const expiresAt = expiry && !Number.isNaN(expiry.getTime()) ? expiry : null;
  const productId = line?.productId ?? null;
  const basePlanId = line?.offerDetails?.basePlanId ?? null;
  const plan = planFromPlay(productId, basePlanId);
  const hasTimeLeft = expiresAt !== null && expiresAt.getTime() > now.getTime();
  // Active and grace period are Google's word that access is owed; a cancelled one only until it runs out.
  const entitled = plan !== null && (status === "active" || status === "grace" || (status === "canceled" && hasTimeLeft));
  const autoRenewing = line?.autoRenewingPlan?.autoRenewEnabled === true && (status === "active" || status === "grace");
  return {
    status: status === "canceled" && !hasTimeLeft ? "expired" : status,
    entitled,
    plan,
    productId,
    basePlanId,
    expiresAt,
    autoRenewing,
    needsAcknowledge: raw.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING",
    orderId: line?.latestSuccessfulOrderId ?? raw.latestOrderId ?? null,
    priceCents: moneyToCents(line?.autoRenewingPlan?.recurringPrice),
    testPurchase: raw.testPurchase !== undefined,
  };
}

/** Our profile status words: "active" is the only one that grants the plan (every gate in the app checks it). */
export function profileStatusOf(p: PlayPurchase): "active" | "cancelled" | "past_due" | "paused" {
  if (p.entitled) return "active";
  if (p.status === "on_hold") return "past_due";
  if (p.status === "paused") return "paused";
  return "cancelled";
}

/** A short stable id for a purchase token (tokens are long and secret-ish: never store them in the books). */
export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 20);
}

/** What one payment brought in (CAD cents): Google's price if present, else the list price. */
export function paymentCentsOf(p: PlayPurchase): number {
  return p.priceCents ?? (p.plan ? listPriceCents(p.plan) : 0);
}

/** The monthly money for subscription_* rows (a yearly price is a twelfth, as for Stripe). */
export function subscriptionMonthlyCents(p: PlayPurchase): number {
  return p.plan ? monthlyCentsOf(p.plan, paymentCentsOf(p)) : 0;
}

/** Idempotency key of the payment of one billing period: the order (renewals have their own) and the expiry it bought. */
export function paymentEventId(token: string, p: PlayPurchase): string {
  return `play_${p.orderId ?? tokenHash(token)}_${p.expiresAt?.getTime() ?? 0}`;
}
export const startedEventId = (token: string): string => `play_start_${tokenHash(token)}`;
export const canceledEventId = (token: string, p: PlayPurchase): string => `play_cancel_${tokenHash(token)}_${p.expiresAt?.getTime() ?? 0}`;
