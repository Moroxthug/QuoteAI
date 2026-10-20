// Free quotes (docs/GROWTH-PLAN.md Phase 133): GET /api/me/allowance for the counter, and the 402 FREE_QUOTES_USED answer
// that POST /api/quotes, /api/quotes/manual and /api/quotes/:id/duplicate give when blocking is on and the free quotes are gone.
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

export type Allowance = {
  freeQuotes: { paid: boolean; used: number; limit: number | null; left: number | null; enforced: boolean };
  founding?: boolean;
};

export const ALLOWANCE_KEY = ["/api/me/allowance"] as const;

/** What the counter says: nothing (paid, unlimited, unknown), counting, or used (none left and the server blocks). */
export function freeQuotesState(a: Allowance | null | undefined): { kind: "none" } | { kind: "counting" | "used"; left: number; limit: number } {
  const f = a?.freeQuotes;
  if (!f || f.paid || f.limit == null || f.left == null || !(f.limit > 0)) return { kind: "none" };
  const left = Math.max(0, f.left);
  return { kind: left === 0 && f.enforced ? "used" : "counting", left, limit: f.limit };
}

export function useAllowance() {
  const q = useQuery({
    queryKey: ALLOWANCE_KEY,
    queryFn: async (): Promise<Allowance> => {
      const res = await fetch("/api/me/allowance", { credentials: "include", headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as Allowance;
    },
    retry: false,
    staleTime: 60_000,
  });
  return q.isError ? ({ kind: "none" } as const) : freeQuotesState(q.data);
}

export const refreshAllowance = (qc: QueryClient): void => void qc.invalidateQueries({ queryKey: ALLOWANCE_KEY });

// The one "free quotes used" dialog: the create handlers call reportFreeQuotesUsed(err) and the dialog opens.
let open = false;
const subs = new Set<() => void>();
const set = (v: boolean) => { open = v; subs.forEach((f) => f()); };
export const useFreeQuotesUsedOpen = (): boolean => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => open, () => false);
export const closeFreeQuotesUsed = (): void => set(false);

export const isFreeQuotesUsedError = (err: unknown): boolean => {
  const e = err as { status?: number; data?: { code?: string } } | null;
  return e?.status === 402 && e.data?.code === "FREE_QUOTES_USED";
};

/** True when the error was the free-quotes answer (the dialog is open): the caller shows nothing else. */
export function reportFreeQuotesUsed(err: unknown, qc?: QueryClient): boolean {
  if (!isFreeQuotesUsedError(err)) return false;
  if (qc) refreshAllowance(qc);
  set(true);
  return true;
}
