// The free-quote allowance for the signed-in company. If the endpoint fails there is no data and nothing shows.
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { freeState, type FreeState } from "./allowance";
import { allowanceApi } from "./allowanceApi";
import { useSession } from "./useSession";

export const ALLOWANCE_KEY = ["allowance"] as const;

export function useAllowance(): { state: FreeState; founding: boolean } {
  const { status } = useSession();
  const q = useQuery({ queryKey: ALLOWANCE_KEY, queryFn: allowanceApi.get, enabled: status === "in", retry: false, staleTime: 60_000 });
  return { state: q.isError ? { kind: "none" } : freeState(q.data), founding: !!q.data?.founding };
}

/** After a quote is created or duplicated, the count has moved. */
export const refreshAllowance = (qc: QueryClient): void => void qc.invalidateQueries({ queryKey: ALLOWANCE_KEY });
