import { describe, expect, it } from "vitest";
import { hasActiveStripeSubscription, isPlayManaged, stripeMayWritePlan } from "./provider";

describe("who bills a company", () => {
  it("the Stripe webhook may not write a Play company", () => {
    expect(stripeMayWritePlan({ subscriptionProvider: "play" })).toBe(false);
    expect(stripeMayWritePlan({ subscriptionProvider: "stripe" })).toBe(true);
    expect(stripeMayWritePlan({ subscriptionProvider: null })).toBe(true);
    expect(stripeMayWritePlan(null)).toBe(true);
    expect(isPlayManaged(undefined)).toBe(false);
  });
  it("an active Stripe subscriber cannot start a Play one", () => {
    expect(hasActiveStripeSubscription({ subscriptionProvider: "stripe", subscriptionStatus: "active", subscriptionPlan: "monthly_pro" })).toBe(true);
    // before the backfill: no provider yet, but a Stripe customer and an active plan
    expect(hasActiveStripeSubscription({ subscriptionProvider: null, subscriptionStatus: "active", subscriptionPlan: "monthly_pro", stripeCustomerId: "cus_1" })).toBe(true);
  });
  it("others can: cancelled Stripe, no plan, a Play company, a group-paid plan, a granted plan without Stripe", () => {
    expect(hasActiveStripeSubscription({ subscriptionProvider: "stripe", subscriptionStatus: "cancelled", subscriptionPlan: null, stripeCustomerId: "cus_1" })).toBe(false);
    expect(hasActiveStripeSubscription({ subscriptionProvider: null, subscriptionStatus: null, subscriptionPlan: null })).toBe(false);
    expect(hasActiveStripeSubscription({ subscriptionProvider: "play", subscriptionStatus: "active", subscriptionPlan: "monthly_pro", stripeCustomerId: "cus_old" })).toBe(false);
    expect(hasActiveStripeSubscription({ subscriptionProvider: "stripe", subscriptionStatus: "active", subscriptionPlan: "monthly_pro", planCoveredBy: "org1" })).toBe(false);
    expect(hasActiveStripeSubscription({ subscriptionProvider: null, subscriptionStatus: "active", subscriptionPlan: "monthly_pro", stripeCustomerId: null })).toBe(false);
    expect(hasActiveStripeSubscription(null)).toBe(false);
  });
});
