// Phase 135: who bills a company's subscription. Pure, so the Stripe webhook's guard can be tested without a database.

export type ProviderLike = { subscriptionProvider?: string | null } | null | undefined;

/** True when Google Play bills this company: the Stripe webhook and Stripe sync paths must leave its plan alone. */
export const isPlayManaged = (p: ProviderLike): boolean => p?.subscriptionProvider === "play";

/** Whether a Stripe event may change this company's plan (an unknown company is left to the caller's own handling). */
export const stripeMayWritePlan = (p: ProviderLike): boolean => !isPlayManaged(p);

export type SubscriptionFacts = {
  subscriptionProvider?: string | null;
  subscriptionStatus?: string | null;
  subscriptionPlan?: string | null;
  stripeCustomerId?: string | null;
  planCoveredBy?: string | null;
};

/** True when the company pays for its own plan through Stripe right now: then it cannot also start a Play subscription (ALREADY_STRIPE_SUBSCRIBER). */
export function hasActiveStripeSubscription(p: SubscriptionFacts | null | undefined): boolean {
  if (!p || isPlayManaged(p)) return false;
  if (p.subscriptionStatus !== "active" || !p.subscriptionPlan || p.subscriptionPlan === "free") return false;
  if (p.planCoveredBy) return false; // a group parent pays; the company may still choose to pay for itself
  return p.subscriptionProvider === "stripe" || !!p.stripeCustomerId;
}
