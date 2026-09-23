import type Stripe from "stripe";
import { addonPriceIdFor, type AddonKind, type BillingInterval } from "./billing.js";
import { getUncachableStripeClient } from "../stripeClient.js";

// ── Phase 90/91: add-on quantities on a company's own subscription ───────────
// The one place that talks to Stripe about add-ons: set the quantity of one
// add-on item (create it, update it, or remove it at 0), prorated. Replaceable
// in tests — the e2e suite has no Stripe account.

export class AddonError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export type AddonBilling = { stripeCustomerId: string | null; interval: BillingInterval };
type AddonDriver = { setQuantity(billing: AddonBilling, kind: AddonKind, quantity: number): Promise<void> };

const stripeDriver: AddonDriver = {
  async setQuantity(billing, kind, quantity) {
    const priceId = addonPriceIdFor(kind, billing.interval);
    if (!priceId) throw new AddonError(409, kind === "group_company" ? "GROUP_BILLING_UNAVAILABLE" : "SEATS_UNAVAILABLE", "This add-on is not set up yet.");
    if (!billing.stripeCustomerId) throw new AddonError(409, "NO_SUBSCRIPTION", "There is no active subscription to add it to.");
    const stripe: Stripe = await getUncachableStripeClient();
    const subs = await stripe.subscriptions.list({ customer: billing.stripeCustomerId, status: "active", limit: 1 });
    const sub = subs.data[0];
    if (!sub) throw new AddonError(409, "NO_SUBSCRIPTION", "There is no active subscription to add it to.");
    const item = sub.items.data.find((i) => i.price?.id === priceId);
    if (quantity <= 0) {
      if (item) await stripe.subscriptionItems.del(item.id, { proration_behavior: "create_prorations" });
      return;
    }
    if (item) await stripe.subscriptionItems.update(item.id, { quantity, proration_behavior: "create_prorations" });
    else await stripe.subscriptionItems.create({ subscription: sub.id, price: priceId, quantity, proration_behavior: "create_prorations" });
  },
};

let driver: AddonDriver = stripeDriver;

export function setAddonDriverForTests(next: AddonDriver | null): void {
  driver = next ?? stripeDriver;
}

export function setAddonQuantity(billing: AddonBilling, kind: AddonKind, quantity: number): Promise<void> {
  return driver.setQuantity(billing, kind, Math.max(0, Math.floor(quantity)));
}
