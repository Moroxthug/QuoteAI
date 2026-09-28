import type { QueryClient } from "@tanstack/react-query";
import { startOfWeek, addDays } from "date-fns";
import {
  listQuotes, getListQuotesQueryKey,
  listClients, getListClientsQueryKey,
  listCatalogItems, getListCatalogItemsQueryKey,
  listTaxProfiles, getListTaxProfilesQueryKey,
  getBusinessProfile, getGetBusinessProfileQueryKey,
} from "@workspace/api-client-react";
import { jobsApi, type JobSummaryDto } from "@/lib/jobs-api";
import { jobsThisWeek } from "./week";
import { invoicesApi } from "@/lib/invoices-api";
import { scheduleApi } from "@/lib/schedule-api";
import type { PermissionArea, PermissionAction } from "@workspace/permissions";

// Phase 116: what is on the device before anyone needs it offline. Once per
// app start, when the phone is idle and on a real connection, the answers the
// field and the office open most are fetched under the SAME keys their pages
// use, so they are saved with the rest of the cache (query-cache.ts):
//   quotes, clients, the price catalog, tax profiles, the company profile,
//   jobs and invoices (lists), this week's schedule — schedule.tsx's week key —
//   and the full page of every job running this week (milestones, tasks, crew,
//   address), at most 15 of them (week.ts jobsThisWeek).
// A role that can't open a section doesn't fetch it (it would only get a 403).
// Answers already fresh are not asked for again (prefetchQuery + staleTime).

let started = false;

type Can = (area: PermissionArea, action: PermissionAction) => boolean;

function slowLink(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType ?? ""));
}

async function warm(qc: QueryClient, can: Can, isPro: boolean): Promise<void> {
  const tasks: Array<Promise<unknown>> = [
    qc.prefetchQuery({ queryKey: getGetBusinessProfileQueryKey(), queryFn: ({ signal }) => getBusinessProfile({ signal }) }),
    qc.prefetchQuery({ queryKey: getListTaxProfilesQueryKey(), queryFn: ({ signal }) => listTaxProfiles({ signal }) }),
  ];
  if (can("quotes", "view")) {
    tasks.push(qc.prefetchQuery({ queryKey: getListQuotesQueryKey(), queryFn: ({ signal }) => listQuotes({ signal }) }));
    tasks.push(qc.prefetchQuery({ queryKey: getListClientsQueryKey(), queryFn: ({ signal }) => listClients({ signal }) }));
  }
  if (!isPro) {
    await Promise.allSettled(tasks);
    return;
  }
  tasks.push(qc.prefetchQuery({ queryKey: getListCatalogItemsQueryKey(), queryFn: ({ signal }) => listCatalogItems({ signal }) }));
  if (can("invoicing", "view")) tasks.push(qc.prefetchQuery({ queryKey: ["invoices"], queryFn: invoicesApi.list }));
  if (can("jobs", "view")) {
    const from = startOfWeek(new Date(), { weekStartsOn: 1 });
    const to = addDays(from, 7);
    tasks.push(qc.prefetchQuery({ queryKey: ["schedule", from.toISOString(), to.toISOString()], queryFn: () => scheduleApi.window(from, to) }));
  }
  if (can("jobs", "view")) {
    await qc.prefetchQuery({ queryKey: ["jobs"], queryFn: jobsApi.list });
    const list = qc.getQueryData<{ items: JobSummaryDto[] }>(["jobs"]);
    for (const job of jobsThisWeek(list?.items ?? [], new Date())) {
      tasks.push(qc.prefetchQuery({ queryKey: ["job", job.id], queryFn: () => jobsApi.get(job.id) }));
    }
  }
  await Promise.allSettled(tasks);
}

/** Once per app start, when idle and online. Never throws. */
export function warmOfflineSet(qc: QueryClient, can: Can, isPro: boolean): void {
  if (started || typeof window === "undefined" || !navigator.onLine || slowLink()) return;
  started = true;
  const run = () => void warm(qc, can, isPro).catch(() => undefined);
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(run, { timeout: 5_000 });
  else setTimeout(run, 2_000);
}
