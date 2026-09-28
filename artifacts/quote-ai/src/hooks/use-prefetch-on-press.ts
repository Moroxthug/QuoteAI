import { useCallback, useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getGetQuoteQueryKey, getQuote, getListClientQuotesQueryKey, listClientQuotes } from "@workspace/api-client-react";
import { prefetchRoute } from "@/lib/route-chunks";
import { jobsApi } from "@/lib/jobs-api";
import { invoicesApi } from "@/lib/invoices-api";
import { contractsApi } from "@/lib/contracts-api";

// Phase 115 (docs/APP-PLAN.md "Instant"): a row that opens a detail screen
// starts loading that screen when it is pressed, before the finger lifts —
// both the page's code (prefetchRoute) and its main request, under the SAME
// query key and fetcher the detail page uses, so the page mounts onto a warm
// cache instead of a skeleton. The keys below mirror:
//   quotes/[id].tsx      useGetQuote(id)            → getGetQuoteQueryKey(id)
//   jobs/[id].tsx, jobs/setup.tsx                   → ["job", id]
//   invoices/[id].tsx                               → ["invoice", id]
//   contracts/[id].tsx                              → ["contract", id]
//   clients/[name].tsx   useListClientQuotes(id)    → getListClientQuotesQueryKey(id)
// Change one there, change it here.

/** A prefetched answer counts as fresh this long: hover then press doesn't ask twice. */
const PREFETCH_STALE_MS = 30_000;
/** Hover has to rest this long before it prefetches (a pointer passing over a list shouldn't fetch every row). */
const HOVER_DELAY_MS = 80;

const DETAIL_ROUTES: Array<[RegExp, (qc: QueryClient, id: string) => Promise<void>]> = [
  [/^\/dashboard\/quotes\/([^/]+)$/, (qc, id) => qc.prefetchQuery({ queryKey: getGetQuoteQueryKey(id), queryFn: ({ signal }) => getQuote(id, { signal }), staleTime: PREFETCH_STALE_MS })],
  [/^\/dashboard\/jobs\/([^/]+)(?:\/setup)?$/, (qc, id) => qc.prefetchQuery({ queryKey: ["job", id], queryFn: () => jobsApi.get(id), staleTime: PREFETCH_STALE_MS })],
  [/^\/dashboard\/invoices\/([^/]+)$/, (qc, id) => qc.prefetchQuery({ queryKey: ["invoice", id], queryFn: () => invoicesApi.get(id), staleTime: PREFETCH_STALE_MS })],
  [/^\/dashboard\/contracts\/([^/]+)$/, (qc, id) => qc.prefetchQuery({ queryKey: ["contract", id], queryFn: () => contractsApi.get(id), staleTime: PREFETCH_STALE_MS })],
  [/^\/dashboard\/clients\/([^/]+)$/, (qc, id) => qc.prefetchQuery({ queryKey: getListClientQuotesQueryKey(id), queryFn: ({ signal }) => listClientQuotes(id, { signal }), staleTime: PREFETCH_STALE_MS })],
];

/** Starts loading the page chunk and the main request for `href`. A no-op for anything else; never throws. */
function prefetchScreen(qc: QueryClient, href: string): void {
  prefetchRoute(href);
  const path = href.split(/[?#]/)[0]!.replace(/\/+$/, "");
  for (const [re, run] of DETAIL_ROUTES) {
    const m = re.exec(path);
    if (m) {
      // prefetchQuery swallows errors; a failed prefetch is simply retried by the page.
      void run(qc, decodeURIComponent(m[1]!));
      return;
    }
  }
}

export type PressPrefetchProps = {
  onPointerDown?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
};

/**
 * Props to spread on a row that links to `href`: prefetch on press
 * (pointerdown), on a resting hover (desktop) and on keyboard focus.
 *
 *   const press = usePrefetchOnPress();
 *   <tr {...rowLink(go)} {...press(href)}>
 */
export function usePrefetchOnPress(): (href: string | null | undefined) => PressPrefetchProps {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return useCallback(
    (href) => {
      if (!href) return {};
      const now = () => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        prefetchScreen(qc, href);
      };
      return {
        onPointerDown: now,
        onFocus: now,
        onMouseEnter: () => {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(now, HOVER_DELAY_MS);
        },
        onMouseLeave: () => {
          if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        },
      };
    },
    [qc],
  );
}
