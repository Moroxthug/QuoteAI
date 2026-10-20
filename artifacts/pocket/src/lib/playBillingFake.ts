// A fake Google Play for tests and the web preview. It holds made-up price strings (nothing real: the real ones always come from Google Play) and acts as told.
import type { BillingEvent, PlayBilling, PlayPurchase } from "./playBilling.ts";
import { PLAY_SUBSCRIPTIONS_URL, type PlayOfferDetails } from "./playPlans.ts";

export type FakeOptions = {
  details?: PlayOfferDetails[];
  /** What the next purchase does. */
  outcome?: "purchased" | "pending" | "cancelled" | "error";
  /** Purchases Google Play already holds (restore, or one never finished). */
  owned?: { productId: string; purchaseToken: string; pending?: boolean; acknowledged?: boolean }[];
  connects?: boolean;
};

const PLANS = [["quoteai_starter", "Starter"], ["quoteai_pro", "Pro"], ["quoteai_business", "Business"]] as const;
const defaultDetails = (): PlayOfferDetails[] =>
  PLANS.flatMap(([id], i) => ["monthly", "yearly", "launch"].map((b) => ({ productId: id, basePlanId: b, offerToken: `fake-${id}-${b}`, price: `FAKE ${i + 1}${b === "yearly" ? "0" : ""}.00 ${b}` })));

export type FakeBilling = PlayBilling & { finished: string[]; requests: { productId: string; basePlanId: string; offerToken: string }[]; options: FakeOptions; emit(e: BillingEvent): void; purchaseFor(token: string, productId: string, pending?: boolean, acknowledged?: boolean): PlayPurchase };

export function createFakeBilling(options: FakeOptions = {}): FakeBilling {
  const listeners = new Set<(e: BillingEvent) => void>();
  const finished: string[] = [];
  const requests: FakeBilling["requests"] = [];
  const emit = (e: BillingEvent) => listeners.forEach((l) => l(e));
  const purchaseFor = (purchaseToken: string, productId: string, pending = false, acknowledged = false): PlayPurchase => ({ productId, purchaseToken, pending, acknowledged, finish: async () => { finished.push(purchaseToken); } });
  return {
    available: true,
    options,
    finished,
    requests,
    emit,
    purchaseFor,
    init: async () => options.connects ?? true,
    getProducts: async (ids) => (options.details ?? defaultDetails()).filter((d) => ids.includes(d.productId)),
    async purchase(productId, basePlanId, offerToken) {
      requests.push({ productId, basePlanId, offerToken });
      const o = options.outcome ?? "purchased";
      if (o === "cancelled") emit({ type: "cancelled" });
      else if (o === "error") emit({ type: "error", message: "fake error" });
      else emit({ type: "purchase", purchase: purchaseFor(`fake-token-${requests.length}`, productId, o === "pending") });
    },
    subscribe(l) {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
    restore: async () => (options.owned ?? []).map((p) => purchaseFor(p.purchaseToken, p.productId, p.pending, p.acknowledged)),
    manageSubscriptionUrl: PLAY_SUBSCRIPTIONS_URL,
  };
}
