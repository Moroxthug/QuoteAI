import { describe, expect, it } from "vitest";
import { billingRowFromStripeEvent, isTrackedEvent, monthlyCents, normalizeAttribution } from "./growth.js";

describe("normalizeAttribution", () => {
  it("names the channel from utm_source first", () => {
    expect(normalizeAttribution({ source: "Google", medium: "cpc", campaign: "contractor-quotes" }).source).toBe("google");
    expect(normalizeAttribution({ source: "fb" }).source).toBe("facebook");
    expect(normalizeAttribution({ source: "my newsletter!" }).source).toBe("my_newsletter_");
  });
  it("falls back to the referrer's site, and to direct", () => {
    expect(normalizeAttribution({ referrer: "https://www.google.com/search?q=x" }).source).toBe("google");
    expect(normalizeAttribution({ referrer: "https://l.facebook.com/l.php" }).source).toBe("facebook");
    expect(normalizeAttribution({ referrer: "https://some-blog.example/post" }).source).toBe("referral_site");
    expect(normalizeAttribution({ referrer: "https://quoteai.ca/pricing" }).source).toBe("direct");
    expect(normalizeAttribution({}).source).toBe("direct");
  });
  it("a referral code wins over everything and the platform defaults to web", () => {
    const a = normalizeAttribution({ source: "google", referralCode: "ABC123", platform: "android" });
    expect(a.source).toBe("referral");
    expect(a.referralCode).toBe("ABC123");
    expect(a.platform).toBe("android");
    expect(normalizeAttribution({ platform: "plan9" }).platform).toBe("web");
  });
});

describe("tracked events", () => {
  it("only the fixed list is accepted", () => {
    expect(isTrackedEvent("paywall_view")).toBe(true);
    expect(isTrackedEvent("drop table")).toBe(false);
    expect(isTrackedEvent(42)).toBe(false);
  });
});

describe("monthlyCents", () => {
  it("counts a yearly price as a twelfth, so MRR is comparable", () => {
    expect(monthlyCents({ price: { unit_amount: 1900, recurring: { interval: "month" } }, quantity: 1 })).toBe(1900);
    expect(monthlyCents({ price: { unit_amount: 19000, recurring: { interval: "year" } }, quantity: 1 })).toBe(1583);
    expect(monthlyCents({ price: { unit_amount: 1900, recurring: { interval: "month" } }, quantity: 3 })).toBe(5700);
    expect(monthlyCents(undefined)).toBe(0);
  });
});

describe("billingRowFromStripeEvent", () => {
  const at = 1_790_000_000;
  it("a paid invoice is a payment with its tax and the founding flag", () => {
    const row = billingRowFromStripeEvent({ id: "evt_1", type: "invoice.paid", created: at, data: { object: { customer: "cus_1", amount_paid: 2147, currency: "cad", total_taxes: [{ amount: 247 }], lines: { data: [{ price: { unit_amount: 1900, recurring: { interval: "month" }, metadata: { quoteai_launch: "1" } }, quantity: 1 }] } } } });
    expect(row).toMatchObject({ type: "payment", amountCents: 2147, taxCents: 247, currency: "cad", founding: 1, customerId: "cus_1", providerEventId: "evt_1" });
    expect(row?.at.getTime()).toBe(at * 1000);
  });
  it("older invoices carry the tax in total_tax_amounts or tax", () => {
    expect(billingRowFromStripeEvent({ id: "e", type: "invoice.paid", data: { object: { amount_paid: 100, total_tax_amounts: [{ amount: 5 }, { amount: 8 }] } } })?.taxCents).toBe(13);
    expect(billingRowFromStripeEvent({ id: "e", type: "invoice.paid", data: { object: { amount_paid: 100, tax: 12 } } })?.taxCents).toBe(12);
  });
  it("refunds, disputes and subscription changes", () => {
    expect(billingRowFromStripeEvent({ id: "e", type: "charge.refunded", data: { object: { customer: "c", amount_refunded: 500, currency: "cad" } } })).toMatchObject({ type: "refund", amountCents: 500 });
    expect(billingRowFromStripeEvent({ id: "e", type: "charge.dispute.created", data: { object: { amount: 2900, currency: "cad" } } })).toMatchObject({ type: "dispute", amountCents: 2900 });
    const sub = { customer: "c", items: { data: [{ price: { unit_amount: 2900, recurring: { interval: "month" } }, quantity: 1 }] } };
    expect(billingRowFromStripeEvent({ id: "e1", type: "customer.subscription.created", data: { object: sub } })).toMatchObject({ type: "subscription_started", amountCents: 2900 });
    expect(billingRowFromStripeEvent({ id: "e2", type: "customer.subscription.updated", data: { object: sub } })?.type).toBe("subscription_changed");
    expect(billingRowFromStripeEvent({ id: "e3", type: "customer.subscription.deleted", data: { object: sub } })?.type).toBe("subscription_canceled");
  });
  it("other events are not the books' business", () => {
    expect(billingRowFromStripeEvent({ id: "e", type: "customer.created", data: { object: {} } })).toBeNull();
  });
});
