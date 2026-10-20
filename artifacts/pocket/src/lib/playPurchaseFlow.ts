// The purchase flow, one object for the whole app: choose a plan -> Google Play sheet -> POST /api/billing/play/verify -> acknowledge with Google.
// Rules (Phase 135): a purchase is finished with Google ONLY after the server accepted it; if the server says no (or cannot be reached) the purchase stays open so a retry, a
// restore or the next app start can finish it. A slow card (PURCHASE_PENDING) is a wait, not an error. Cancelling the sheet is quiet.
// It takes the billing and the server calls as arguments, so the tests run it against a fake.
import type { BillingEvent, PlayBilling, PlayPurchase } from "./playBilling.ts";
import { errorKind, type ErrorKind, type PlanOffer } from "./playPlans.ts";

export type VerifyResult = { plan?: string | null; interval?: string | null; founding?: boolean | null; status?: string | null; expiresAt?: string | null; autoRenewing?: boolean | null };

export type FlowApi = {
  verify(body: { productId: string; purchaseToken: string }): Promise<VerifyResult>;
  restore(body: { purchaseTokens: string[] }): Promise<unknown>;
};

export type Phase = "idle" | "buying" | "verifying" | "pending" | "done" | "restoring" | "restored" | "nothing" | "failed";
export type FlowState = { phase: Phase; error: ErrorKind | null; result: VerifyResult | null };

const IDLE: FlowState = { phase: "idle", error: null, result: null };
const failure = (e: unknown): { status: number; code?: string } => {
  const x = e as { status?: unknown; code?: unknown } | null;
  return { status: typeof x?.status === "number" ? x.status : 0, code: typeof x?.code === "string" ? x.code : undefined };
};

export type PurchaseFlow = ReturnType<typeof createPurchaseFlow>;

export function createPurchaseFlow(billing: PlayBilling, api: FlowApi, hooks: { onApplied?: () => void } = {}) {
  let state: FlowState = IDLE;
  const subs = new Set<() => void>();
  const inflight = new Set<string>();
  let started: Promise<void> | null = null;
  const set = (s: FlowState) => { state = s; subs.forEach((f) => f()); };

  /** `user`: the person started it (an error shows). `recover`: found at app start or a late pending purchase (quiet unless it worked). */
  async function handle(p: PlayPurchase, source: "user" | "recover"): Promise<void> {
    if (p.pending) { set({ phase: "pending", error: null, result: null }); return; }
    if (!p.purchaseToken || inflight.has(p.purchaseToken)) return;
    inflight.add(p.purchaseToken);
    if (source === "user" || state.phase === "buying") set({ phase: "verifying", error: null, result: null });
    try {
      const result = await api.verify({ productId: p.productId, purchaseToken: p.purchaseToken });
      try { await p.finish(); } catch { /* the server already acknowledged it with Google */ }
      if (source === "user" || state.phase !== "idle") set({ phase: "done", error: null, result });
      hooks.onApplied?.();
    } catch (e) {
      const { status, code } = failure(e);
      const kind = errorKind(status, code);
      if (kind === "pending") set({ phase: "pending", error: null, result: null });
      else if (source === "user" || state.phase === "verifying") set({ phase: "failed", error: kind, result: null });
    } finally {
      inflight.delete(p.purchaseToken);
    }
  }

  function onEvent(e: BillingEvent): void {
    if (e.type === "purchase") void handle(e.purchase, state.phase === "buying" || state.phase === "verifying" ? "user" : "recover");
    else if (e.type === "cancelled") { if (state.phase === "buying") set(IDLE); }
    else if (state.phase === "buying") set({ phase: "failed", error: "generic", result: null });
  }

  return {
    getState: (): FlowState => state,
    subscribe(f: () => void): () => void { subs.add(f); return () => { subs.delete(f); }; },
    reset(): void { if (state.phase !== "buying" && state.phase !== "verifying" && state.phase !== "restoring") set(IDLE); },

    /** Connects, listens for purchases, and verifies any purchase Google Play still holds that was never finished (the app was closed mid-purchase). */
    start(): Promise<void> {
      started ??= (async () => {
        if (!billing.available) return;
        billing.subscribe(onEvent);
        if (!(await billing.init())) return;
        try { for (const p of await billing.restore()) if (!p.acknowledged) await handle(p, "recover"); } catch { /* try again next start */ }
      })();
      return started;
    },

    async buy(offer: Pick<PlanOffer, "productId" | "basePlanId" | "offerToken">): Promise<void> {
      if (state.phase === "buying" || state.phase === "verifying" || state.phase === "restoring") return;
      await this.start();
      set({ phase: "buying", error: null, result: null });
      await billing.purchase(offer.productId, offer.basePlanId, offer.offerToken);
    },

    /** "Restore purchases": hand every purchase Google Play holds to the server, which applies the best active one. */
    async restore(): Promise<void> {
      if (state.phase === "buying" || state.phase === "verifying" || state.phase === "restoring") return;
      await this.start();
      set({ phase: "restoring", error: null, result: null });
      let owned: PlayPurchase[];
      try { owned = (await billing.restore()).filter((p) => !p.pending && p.purchaseToken); } catch { set({ phase: "failed", error: "generic", result: null }); return; }
      if (!owned.length) { set({ phase: "nothing", error: null, result: null }); return; }
      try {
        await api.restore({ purchaseTokens: owned.map((p) => p.purchaseToken) });
        for (const p of owned) { try { await p.finish(); } catch { /* already acknowledged */ } }
        set({ phase: "restored", error: null, result: null });
        hooks.onApplied?.();
      } catch (e) {
        const { status, code } = failure(e);
        const kind = errorKind(status, code);
        set(kind === "pending" ? { phase: "pending", error: null, result: null } : { phase: "failed", error: kind, result: null });
      }
    },
  };
}
