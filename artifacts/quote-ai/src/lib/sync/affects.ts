import type { QueryKey } from "@tanstack/react-query";

// Phase 117 (docs/APP-PLAN.md "Sync II"): which saved answers a change makes
// out of date. Used by the live feed (another device changed job X) and by
// the outbox (our queued change to job X just went through), so both refetch
// exactly what shows that row — the job page, its lists, Today — and nothing
// else. The keys mirror the pages' useQuery calls (see offline/query-policy.ts).

export type Change = {
  /** job | milestone | task | note | photo | cost | time | report | change_order | schedule | quote | client | invoice | contract | lead */
  entity: string;
  id: string | null;
  /** The job (or, for a quote variant, the quote) the row hangs off. */
  parentId: string | null;
};

const JOB_PARTS = new Set(["job", "milestone", "task", "note", "photo", "cost", "time", "report", "change_order"]);
/** Keys shaped [root, jobId, …] that show one job. */
const JOB_KEYED = new Set(["job", "job-photos", "job-notes", "field-reports", "job-analytics", "permits"]);
/** Lists and boards that show jobs, their dates and their progress. */
const JOB_LISTS = new Set(["jobs", "today", "agenda", "schedule", "crew-today"]);

export function affects(c: Change, key: QueryKey): boolean {
  const root = key[0];
  if (typeof root !== "string") return false;
  const jobId = c.entity === "job" ? c.id : c.parentId;

  if (JOB_PARTS.has(c.entity)) {
    if (JOB_KEYED.has(root)) return !jobId || key[1] === undefined || key[1] === jobId;
    if (JOB_LISTS.has(root)) return true;
    if (c.entity === "cost" && root === "costs-review") return true;
    if (c.entity === "time" && (root === "time-entries" || root === "pay-period")) return true;
    return false;
  }

  switch (c.entity) {
    case "schedule":
      return root === "schedule" || root === "agenda" || root === "today" || root === "crew-today" || (root === "job" && !!jobId && key[1] === jobId);
    case "quote": {
      const quoteId = c.parentId ?? c.id;
      if (root === "/api/quotes" || root === "/api/quotes/stats" || root === "/api/clients" || root === "today" || root === "leads") return true;
      if (quoteId && (root === `/api/quotes/${quoteId}` || root === `/api/quotes/${quoteId}/variants`)) return true;
      if (root === "contract-by-quote") return !quoteId || key[1] === quoteId;
      return root.startsWith("/api/clients/");
    }
    case "client":
      return root === "/api/clients" || root.startsWith("/api/clients/") || root === "client-thread";
    case "invoice":
      if (root === "invoices" || root === "today") return true;
      if (root === "invoice") return !c.id || key[1] === undefined || key[1] === c.id;
      return root === "job" && !!c.parentId && key[1] === c.parentId;
    case "contract":
      if (root === "contracts" || root === "contract-by-quote") return true;
      if (root === "contract") return !c.id || key[1] === undefined || key[1] === c.id;
      return root === "job" && !!c.parentId && key[1] === c.parentId;
    case "lead":
      return root === "leads" || root === "today";
    default:
      return false;
  }
}

/** One predicate for a batch of changes, for `invalidateQueries({ predicate })`. */
export function affectsAny(changes: Change[]): (q: { queryKey: QueryKey }) => boolean {
  return (q) => changes.some((c) => affects(c, q.queryKey));
}
