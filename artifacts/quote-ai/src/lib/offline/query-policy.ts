import type { QueryKey } from "@tanstack/react-query";

// Phase 116 (docs/APP-PLAN.md "Sync I"): which answers are kept on the device
// for the next launch and for no signal, and how long each counts as fresh.
//
//   reference — the price catalog, tax profiles, the company profile, who I am:
//               changes rarely, and every edit screen invalidates its own key,
//               so it is refreshed once a day.
//   list      — quotes, clients, jobs, invoices, the schedule, Today: shown at
//               once from the device, refreshed when the app comes back to the
//               front (or reconnects) once it is 30 s old — not on every tab tap.
//   detail    — one quote / job / invoice: shown at once, refreshed every time
//               it is opened (staleTime 0, as before).
//
// Anything not named here is neither saved nor given a new freshness rule:
// admin, the assistant's conversation, bank feeds, connect links, audit logs,
// the public token pages (the service worker handles those, Phase 77).
// The keys mirror the pages' useQuery calls and the generated client's
// `/api/...` keys — a key renamed there has to be renamed here.

export type QueryClass = "reference" | "list" | "detail";

export const STALE_MS: Record<QueryClass, number> = {
  reference: 24 * 60 * 60_000,
  list: 30_000,
  detail: 0,
};

/** Saved answers older than this are not restored (the list would be misleading, not helpful). */
export const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
/** What one person's saved cache may take on the device (serialized JSON characters, ~bytes). */
const MAX_BYTES = 20 * 1024 * 1024;

const ROOTS: Record<string, QueryClass> = {
  // who and what the app is for
  me: "reference",
  "team-orgs": "reference",
  "push-config": "reference",
  "whatsapp-available": "reference",
  // the work
  jobs: "list",
  invoices: "list",
  contracts: "list",
  leads: "list",
  notifications: "list",
  schedule: "list",
  agenda: "list",
  today: "list",
  "crew-today": "list",
  "team-members": "list",
  workers: "list",
  job: "detail",
  "job-photos": "detail",
  "job-notes": "detail",
  "field-reports": "detail",
  invoice: "detail",
  contract: "detail",
  "contract-by-quote": "detail",
};

/** The generated client's keys are the request path (`/api/quotes/abc`). */
const API_PATHS: Array<[RegExp, QueryClass]> = [
  [/^\/api\/(catalog|tax-profiles|business-profile)$/, "reference"],
  [/^\/api\/payments\/subscription$/, "reference"],
  [/^\/api\/(quotes|clients|quotes\/stats)$/, "list"],
  [/^\/api\/quotes\/[^/]+(\/variants)?$/, "detail"],
  [/^\/api\/clients\/[^/]+\/quotes$/, "detail"],
];

export function classify(key: QueryKey): QueryClass | null {
  const root = key[0];
  if (typeof root !== "string") return null;
  if (root.startsWith("/api/")) {
    for (const [re, cls] of API_PATHS) if (re.test(root)) return cls;
    return null;
  }
  return ROOTS[root] ?? null;
}

export function shouldPersist(key: QueryKey): boolean {
  return classify(key) !== null;
}

export type SavedQuery = { queryKey: QueryKey; queryHash: string; state: { dataUpdatedAt: number }; [k: string]: unknown };

/**
 * What goes into the saved record: nothing older than MAX_AGE_MS, newest first
 * until the MAX_BYTES budget is spent (a big list of old quotes gives way to
 * this week's jobs, never the other way round).
 */
export function prune<Q extends SavedQuery>(queries: Q[], now: number, maxBytes = MAX_BYTES): { kept: Q[]; bytes: number } {
  const fresh = queries.filter((q) => now - q.state.dataUpdatedAt <= MAX_AGE_MS).sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
  const kept: Q[] = [];
  let bytes = 0;
  for (const q of fresh) {
    let size: number;
    try {
      size = JSON.stringify(q).length;
    } catch {
      continue; // not serializable — never saved
    }
    if (bytes + size > maxBytes) continue;
    kept.push(q);
    bytes += size;
  }
  return { kept, bytes };
}
