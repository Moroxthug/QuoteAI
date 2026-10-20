// The purchase flow and the plan list for the screens. One flow for the whole app (a purchase can finish after the person left the plan screen).
import { useEffect, useSyncExternalStore } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { ALLOWANCE_KEY } from "./useAllowance";
import { getPlayBilling } from "./playBilling";
import { productIds, type PlayCatalog, type PlayOfferDetails } from "./playPlans";
import { createPurchaseFlow, type FlowState, type PurchaseFlow, type VerifyResult } from "./playPurchaseFlow";
import { useSession } from "./useSession";

export const PLAY_CATALOG_KEY = ["play-catalog"] as const;
let client: QueryClient | null = null;
let flow: PurchaseFlow | null = null;

/** True on an Android build with the Google Play library. Web and iOS: false, and the plan screen keeps its link to quoteai.ca. */
export const playBillingAvailable = (): boolean => getPlayBilling().available;

export function playFlow(): PurchaseFlow {
  flow ??= createPurchaseFlow(getPlayBilling(), {
    verify: (body) => api<VerifyResult>("/api/billing/play/verify", { method: "POST", body }),
    restore: (body) => api("/api/billing/play/restore", { method: "POST", body }),
  }, {
    // The plan changed: everything that shows the plan, the free-quote counter or the lock re-reads.
    onApplied: () => {
      void client?.invalidateQueries({ queryKey: PLAY_CATALOG_KEY });
      void client?.invalidateQueries({ queryKey: ["plan-overview"] });
      void client?.invalidateQueries({ queryKey: ALLOWANCE_KEY });
    },
  });
  return flow;
}

/** Mounted once in the root layout: connects to Google Play for a signed-in person and finishes any purchase that was left open. */
export function usePlayBillingBoot(): void {
  const { status } = useSession();
  client = useQueryClient();
  useEffect(() => {
    if (status === "in" && playBillingAvailable()) void playFlow().start();
  }, [status]);
}

const IDLE: FlowState = { phase: "idle", error: null, result: null };
export function usePlayFlow(): FlowState {
  const f = playBillingAvailable() ? playFlow() : null;
  return useSyncExternalStore((cb) => (f ? f.subscribe(cb) : () => undefined), () => f?.getState() ?? IDLE, () => IDLE);
}

/** The server's catalog and Google Play's price strings for it. */
export function usePlayPlans(enabled: boolean): { catalog: PlayCatalog | null; details: PlayOfferDetails[]; loading: boolean; failed: boolean; retry: () => void } {
  const catalogQ = useQuery({ queryKey: PLAY_CATALOG_KEY, queryFn: () => api<PlayCatalog>("/api/billing/play/catalog"), enabled, retry: 1, staleTime: 30_000 });
  const ids = catalogQ.data ? productIds(catalogQ.data) : [];
  const detailsQ = useQuery({
    queryKey: ["play-details", ids.join(",")],
    queryFn: async () => { const b = getPlayBilling(); return (await b.init()) ? b.getProducts(ids) : Promise.reject(new Error("play unavailable")); },
    enabled: enabled && ids.length > 0, retry: 1, staleTime: 5 * 60_000,
  });
  return {
    catalog: catalogQ.data ?? null,
    details: detailsQ.data ?? [],
    loading: enabled && (catalogQ.isPending || (ids.length > 0 && detailsQ.isPending)),
    failed: catalogQ.isError || detailsQ.isError,
    retry: () => { void catalogQ.refetch(); void detailsQ.refetch(); },
  };
}
