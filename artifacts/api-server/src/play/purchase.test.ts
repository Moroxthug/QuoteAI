import { describe, expect, it } from "vitest";
import { canceledEventId, moneyToCents, paymentCentsOf, paymentEventId, profileStatusOf, readPurchase, startedEventId, subscriptionMonthlyCents, tokenHash, type SubscriptionPurchaseV2 } from "./purchase";

const NOW = new Date("2026-10-19T15:00:00Z");
const FUTURE = "2026-11-19T15:00:00.123Z";
const PAST = "2026-10-01T15:00:00Z";

/** A reply shaped like the public API reference's SubscriptionPurchaseV2. */
function fixture(over: Partial<SubscriptionPurchaseV2> = {}, line: Record<string, unknown> = {}): SubscriptionPurchaseV2 {
  return {
    kind: "androidpublisher#subscriptionPurchaseV2",
    regionCode: "CA",
    latestOrderId: "GPA.3312-4521-8890-12345",
    startTime: "2026-10-19T14:59:30.500Z",
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    lineItems: [{
      productId: "quoteai_pro",
      expiryTime: FUTURE,
      latestSuccessfulOrderId: "GPA.3312-4521-8890-12345",
      autoRenewingPlan: { autoRenewEnabled: true, recurringPrice: { currencyCode: "CAD", units: "79", nanos: 0 } },
      offerDetails: { basePlanId: "monthly" },
      ...line,
    }],
    ...over,
  };
}
const read = (over: Partial<SubscriptionPurchaseV2> = {}, line: Record<string, unknown> = {}) => readPurchase(fixture(over, line), NOW);

describe("subscription states", () => {
  it("ACTIVE: entitled, renewing, plan from product + base plan", () => {
    const p = read();
    expect(p).toMatchObject({ status: "active", entitled: true, autoRenewing: true, productId: "quoteai_pro", basePlanId: "monthly", priceCents: 7900, orderId: "GPA.3312-4521-8890-12345", testPurchase: false });
    expect(p.plan).toEqual({ tier: "monthly_pro", interval: "month", founding: false });
    expect(p.expiresAt?.toISOString()).toBe("2026-11-19T15:00:00.123Z");
    expect(profileStatusOf(p)).toBe("active");
  });
  it("IN_GRACE_PERIOD: still entitled", () => {
    const p = read({ subscriptionState: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" });
    expect(p).toMatchObject({ status: "grace", entitled: true });
    expect(profileStatusOf(p)).toBe("active");
  });
  it("ON_HOLD: no access, past_due", () => {
    const p = read({ subscriptionState: "SUBSCRIPTION_STATE_ON_HOLD" }, { expiryTime: PAST });
    expect(p).toMatchObject({ status: "on_hold", entitled: false, autoRenewing: false });
    expect(profileStatusOf(p)).toBe("past_due");
  });
  it("PAUSED: no access", () => {
    const p = read({ subscriptionState: "SUBSCRIPTION_STATE_PAUSED" });
    expect(p).toMatchObject({ status: "paused", entitled: false });
    expect(profileStatusOf(p)).toBe("paused");
  });
  it("CANCELED: access until expiry, not renewing", () => {
    const p = read({ subscriptionState: "SUBSCRIPTION_STATE_CANCELED", canceledStateContext: { userInitiatedCancellation: {} } }, { autoRenewingPlan: { autoRenewEnabled: false } });
    expect(p).toMatchObject({ status: "canceled", entitled: true, autoRenewing: false });
    expect(profileStatusOf(p)).toBe("active");
  });
  it("CANCELED after its expiry is expired", () => {
    const p = read({ subscriptionState: "SUBSCRIPTION_STATE_CANCELED" }, { expiryTime: PAST });
    expect(p).toMatchObject({ status: "expired", entitled: false });
    expect(profileStatusOf(p)).toBe("cancelled");
  });
  it("EXPIRED: no access, cancelled", () => {
    const p = read({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED" }, { expiryTime: PAST });
    expect(p).toMatchObject({ status: "expired", entitled: false });
    expect(profileStatusOf(p)).toBe("cancelled");
  });
  it("PENDING: not entitled yet", () => {
    const p = read({ subscriptionState: "SUBSCRIPTION_STATE_PENDING", lineItems: [{ productId: "quoteai_pro", offerDetails: { basePlanId: "monthly" } }] });
    expect(p).toMatchObject({ status: "pending", entitled: false, expiresAt: null });
  });
  it("PENDING_PURCHASE_CANCELED counts as over", () => {
    expect(read({ subscriptionState: "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED" })).toMatchObject({ status: "expired", entitled: false });
  });
  it("an unknown or missing state never entitles", () => {
    expect(read({ subscriptionState: "SUBSCRIPTION_STATE_UNSPECIFIED" })).toMatchObject({ status: "unknown", entitled: false });
    expect(read({ subscriptionState: undefined })).toMatchObject({ status: "unknown", entitled: false });
  });
});

describe("fields", () => {
  it("acknowledgement state", () => {
    expect(read().needsAcknowledge).toBe(true);
    expect(read({ acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" }).needsAcknowledge).toBe(false);
    expect(read({ acknowledgementState: undefined }).needsAcknowledge).toBe(false);
  });
  it("the founding base plan", () => {
    const p = read({}, { productId: "quoteai_starter", offerDetails: { basePlanId: "launch", offerId: "intro" }, autoRenewingPlan: { autoRenewEnabled: true, recurringPrice: { currencyCode: "CAD", units: "19" } } });
    expect(p.plan).toEqual({ tier: "monthly_starter", interval: "month", founding: true });
    expect(p.priceCents).toBe(1900);
  });
  it("a product we do not sell is not entitled, even when active", () => {
    const p = read({}, { productId: "someone_elses" });
    expect(p.plan).toBeNull();
    expect(p.entitled).toBe(false);
  });
  it("no line items", () => {
    const p = readPurchase({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [] }, NOW);
    expect(p).toMatchObject({ entitled: false, plan: null, productId: null, expiresAt: null });
  });
  it("a bad expiry date is null", () => {
    expect(read({}, { expiryTime: "soon" }).expiresAt).toBeNull();
  });
  it("test purchases are flagged", () => {
    expect(read({ testPurchase: {} }).testPurchase).toBe(true);
  });
  it("order id falls back to the latest order", () => {
    expect(read({}, { latestSuccessfulOrderId: undefined }).orderId).toBe("GPA.3312-4521-8890-12345");
  });
});

describe("money", () => {
  it("units and nanos to cents, CAD only", () => {
    expect(moneyToCents({ currencyCode: "CAD", units: "249", nanos: 0 })).toBe(24900);
    expect(moneyToCents({ currencyCode: "CAD", units: 28, nanos: 990_000_000 })).toBe(2899);
    expect(moneyToCents({ currencyCode: "CAD", nanos: 990_000_000 })).toBe(99);
    expect(moneyToCents({ currencyCode: "USD", units: "20" })).toBeNull();
    expect(moneyToCents({ currencyCode: "CAD", units: "0" })).toBeNull();
    expect(moneyToCents(undefined)).toBeNull();
  });
  it("payment: Google's price, else the list price; MRR counts a twelfth of a yearly plan", () => {
    expect(paymentCentsOf(read())).toBe(7900);
    const noPrice = read({}, { autoRenewingPlan: undefined });
    expect(paymentCentsOf(noPrice)).toBe(7900);
    const yearly = read({}, { offerDetails: { basePlanId: "yearly" }, autoRenewingPlan: undefined });
    expect(paymentCentsOf(yearly)).toBe(79000);
    expect(subscriptionMonthlyCents(yearly)).toBe(6583);
  });
});

describe("books keys", () => {
  it("are stable, per period, and never contain the token", () => {
    const token = "abcdefghijklmnopqrstuvwxyz.secret-token";
    const p = read();
    expect(tokenHash(token)).toBe(tokenHash(token));
    expect(tokenHash(token)).toHaveLength(20);
    expect(paymentEventId(token, p)).toBe(`play_GPA.3312-4521-8890-12345_${p.expiresAt!.getTime()}`);
    expect(paymentEventId(token, read({}, { expiryTime: "2026-12-19T15:00:00Z", latestSuccessfulOrderId: "GPA.3312-4521-8890-12345..0" }))).not.toBe(paymentEventId(token, p));
    expect(paymentEventId(token, read({ latestOrderId: undefined }, { latestSuccessfulOrderId: undefined }))).toContain(tokenHash(token));
    for (const id of [startedEventId(token), canceledEventId(token, p), paymentEventId(token, p)]) expect(id).not.toContain("secret");
  });
});
