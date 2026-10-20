// Google Play Billing, behind one small interface so the rest of the app (and the tests, and the web preview) never touch the purchase library.
// The library is expo-iap (OpenIAP, Google Play Billing on Android). It is required lazily and only on Android, so web and iOS never load it and report available:false.
import { Platform } from "react-native";
import { baseOffer, PLAY_SUBSCRIPTIONS_URL, type PlayOfferDetails, type RawOffer } from "./playPlans";
import { createFakeBilling } from "./playBillingFake";

export type PlayPurchase = {
  productId: string;
  purchaseToken: string;
  /** The slow-card case: Google has the order but the money is not in yet. Nothing to verify until it is purchased. */
  pending: boolean;
  /** Already acknowledged with Google, so the server has seen it (a purchase from an earlier run). */
  acknowledged?: boolean;
  /** Acknowledge it with Google. Called only after the server accepted the purchase. */
  finish(): Promise<void>;
};
export type BillingEvent = { type: "purchase"; purchase: PlayPurchase } | { type: "cancelled" } | { type: "error"; message: string };

export interface PlayBilling {
  readonly available: boolean;
  /** Connects to Google Play; false when it is not reachable (no Play Store, no Play services). */
  init(): Promise<boolean>;
  /** Every base plan of the given subscriptions with Google Play price string. */
  getProducts(ids: string[]): Promise<PlayOfferDetails[]>;
  /** Opens Google Play sheet. The outcome arrives through subscribe(). */
  purchase(productId: string, basePlanId: string, offerToken: string): Promise<void>;
  subscribe(listener: (e: BillingEvent) => void): () => void;
  /** The purchases Google Play holds for this account (a reinstalled phone, or one that was never finished). */
  restore(): Promise<PlayPurchase[]>;
  readonly manageSubscriptionUrl: string;
}

const unavailable: PlayBilling = {
  available: false,
  init: async () => false,
  getProducts: async () => [],
  purchase: async () => undefined,
  subscribe: () => () => undefined,
  restore: async () => [],
  manageSubscriptionUrl: PLAY_SUBSCRIPTIONS_URL,
};

type Iap = typeof import("expo-iap");

function createExpoIapBilling(): PlayBilling {
  const iap = require("expo-iap") as Iap;
  const listeners = new Set<(e: BillingEvent) => void>();
  const emit = (e: BillingEvent) => listeners.forEach((l) => l(e));
  let connected: Promise<boolean> | null = null;

  const wrap = (p: import("expo-iap").Purchase): PlayPurchase => ({
    productId: p.productId,
    purchaseToken: p.purchaseToken ?? "",
    pending: p.purchaseState === "pending",
    acknowledged: (p as { isAcknowledgedAndroid?: boolean | null }).isAcknowledgedAndroid === true,
    finish: async () => { await iap.finishTransaction({ purchase: p, isConsumable: false }); },
  });

  const connect = () => {
    connected ??= (async () => {
      try {
        const ok = await iap.initConnection();
        if (!ok) { connected = null; return false; }
        iap.purchaseUpdatedListener((p) => { if (p.purchaseToken || p.purchaseState === "pending") emit({ type: "purchase", purchase: wrap(p) }); });
        iap.purchaseErrorListener((e) => emit(e.code === iap.ErrorCode.UserCancelled ? { type: "cancelled" } : { type: "error", message: e.message }));
        return true;
      } catch {
        connected = null;
        return false;
      }
    })();
    return connected;
  };

  return {
    available: true,
    init: connect,
    async getProducts(ids) {
      if (!(await connect())) return [];
      const subs = (await iap.fetchProducts({ skus: ids, type: "subs" })) ?? [];
      const out: PlayOfferDetails[] = [];
      for (const s of subs) {
        if (!("subscriptionOffers" in s)) continue;
        const raw: RawOffer[] = (s.subscriptionOffers ?? []).map((o) => ({
          basePlanId: o.basePlanIdAndroid, offerId: o.id, offerToken: o.offerTokenAndroid,
          phases: o.pricingPhasesAndroid?.pricingPhaseList ?? null, displayPrice: o.displayPrice,
        }));
        for (const basePlanId of new Set(raw.map((r) => r.basePlanId).filter((b): b is string => !!b))) {
          const b = baseOffer(raw, basePlanId);
          if (b) out.push({ productId: s.id, basePlanId, ...b });
        }
      }
      return out;
    },
    async purchase(productId, _basePlanId, offerToken) {
      if (!(await connect())) { emit({ type: "error", message: "Google Play is not available" }); return; }
      try {
        await iap.requestPurchase({ type: "subs", request: { google: { skus: [productId], subscriptionOffers: [{ sku: productId, offerToken }] } } });
      } catch (e) {
        const code = (e as { code?: string } | null)?.code;
        emit(code === iap.ErrorCode.UserCancelled ? { type: "cancelled" } : { type: "error", message: e instanceof Error ? e.message : "purchase failed" });
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async restore() {
      if (!(await connect())) return [];
      const owned = await iap.getAvailablePurchases();
      return owned.filter((p) => p.productId.startsWith("quoteai_")).map(wrap);
    },
    manageSubscriptionUrl: PLAY_SUBSCRIPTIONS_URL,
  };
}

let instance: PlayBilling | null = null;

/**
 * The billing for this device. Android builds get the Google Play library; everything else is `available:false` (the plan screen keeps its link out to quoteai.ca).
 * Set EXPO_PUBLIC_FAKE_PLAY_BILLING=1 to preview the plans screen on the web with a fake (never in a release build).
 */
export function getPlayBilling(): PlayBilling {
  if (instance) return instance;
  if (process.env.EXPO_PUBLIC_FAKE_PLAY_BILLING === "1" && __DEV__) instance = createFakeBilling();
  else if (Platform.OS === "android") {
    try { instance = createExpoIapBilling(); } catch { instance = unavailable; }
  } else instance = unavailable;
  return instance;
}

/** For tests and previews. */
export function setPlayBilling(b: PlayBilling | null): void {
  instance = b;
}
