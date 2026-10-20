import { afterEach, describe, expect, it } from "vitest";
import { allowanceOf, freeQuotesEnforced, freeQuotesLimit, freeQuotesUsedBody, isBlocked } from "./freeQuotes.js";
import { launchCustomerLimit, launchOfferFor, LAUNCH_PRICE_CENTS, STANDARD_PRICE_CENTS } from "./launchPrice.js";
import { isLaunchPrice, resolvePrice } from "./billing.js";

describe("launch offer", () => {
  it("is on until the hundredth paying customer, then the price is $29 for new customers", () => {
    expect(launchOfferFor(0, 100, true)).toMatchObject({ active: true, remaining: 100, launchPriceCents: 1900, standardPriceCents: 2900 });
    expect(launchOfferFor(99, 100, true)).toMatchObject({ active: true, remaining: 1 });
    expect(launchOfferFor(100, 100, true)).toMatchObject({ active: false, remaining: 0 });
    expect(launchOfferFor(250, 100, true).remaining).toBe(0);
  });
  it("is off when this deployment has no Stripe launch price", () => {
    expect(launchOfferFor(3, 100, false).active).toBe(false);
  });
  it("the prices are the owner's: $19 then $29", () => {
    expect(LAUNCH_PRICE_CENTS).toBe(1900);
    expect(STANDARD_PRICE_CENTS).toBe(2900);
  });
  it("the customer limit reads its setting and ignores nonsense", () => {
    expect(launchCustomerLimit({})).toBe(100);
    expect(launchCustomerLimit({ LAUNCH_CUSTOMER_LIMIT: "250" })).toBe(250);
    expect(launchCustomerLimit({ LAUNCH_CUSTOMER_LIMIT: "-4" })).toBe(100);
    expect(launchCustomerLimit({ LAUNCH_CUSTOMER_LIMIT: "abc" })).toBe(100);
  });
});

describe("launch price in billing", () => {
  const prev = process.env.STRIPE_PRICE_STARTER_LAUNCH;
  afterEach(() => { if (prev === undefined) delete process.env.STRIPE_PRICE_STARTER_LAUNCH; else process.env.STRIPE_PRICE_STARTER_LAUNCH = prev; });
  it("the launch price id resolves to Starter monthly and is a founding price", () => {
    process.env.STRIPE_PRICE_STARTER_LAUNCH = "price_launch_19";
    expect(resolvePrice("price_launch_19")).toEqual({ tier: "monthly_starter", interval: "month" });
    expect(isLaunchPrice("price_launch_19")).toBe(true);
    expect(isLaunchPrice({ id: "price_other", metadata: { quoteai_launch: "1" } })).toBe(true);
    expect(isLaunchPrice({ id: "price_other" })).toBe(false);
    expect(isLaunchPrice(null)).toBe(false);
  });
});

describe("free quotes", () => {
  it("three by default, a setting can change it, nonsense is ignored", () => {
    expect(freeQuotesLimit({})).toBe(3);
    expect(freeQuotesLimit({ FREE_QUOTES_LIMIT: "5" })).toBe(5);
    expect(freeQuotesLimit({ FREE_QUOTES_LIMIT: "999" })).toBe(3);
  });
  it("blocking is off unless switched on", () => {
    expect(freeQuotesEnforced({})).toBe(false);
    expect(freeQuotesEnforced({ FREE_QUOTES_ENFORCED: "1" })).toBe(true);
  });
  it("counts what is left and only blocks when it is switched on and nothing is left", () => {
    expect(allowanceOf({ paid: false, used: 1, limit: 3, enforced: true })).toMatchObject({ left: 2, limit: 3 });
    expect(isBlocked(allowanceOf({ paid: false, used: 2, limit: 3, enforced: true }))).toBe(false);
    expect(isBlocked(allowanceOf({ paid: false, used: 3, limit: 3, enforced: true }))).toBe(true);
    expect(isBlocked(allowanceOf({ paid: false, used: 7, limit: 3, enforced: true }))).toBe(true);
    expect(isBlocked(allowanceOf({ paid: false, used: 3, limit: 3, enforced: false }))).toBe(false);
  });
  it("a paid plan has no limit and is never blocked", () => {
    const a = allowanceOf({ paid: true, used: 40, limit: 3, enforced: true });
    expect(a).toMatchObject({ paid: true, limit: null, left: null });
    expect(isBlocked(a)).toBe(false);
  });
  it("the refusal carries a code the apps recognise", () => {
    expect(freeQuotesUsedBody(allowanceOf({ paid: false, used: 3, limit: 3, enforced: true }))).toMatchObject({ code: "FREE_QUOTES_USED", limit: 3, used: 3 });
  });
});
