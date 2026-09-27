// Phase 99: Pro runs a fixed number of jobs at once. The server answers 402
// JOB_LIMIT (with `limit`) when opening one more would pass it; every place a
// job is opened — Start job, from a quote, confirming a setup, restoring from
// the archive — shows the same translated message instead of the server's
// English one.

import { ACTIVE_JOB_LIMIT } from "@/lib/plans";

type Translate = (key: string) => string;

export function jobLimitToast(err: unknown, t: Translate): { title: string; description: string } | null {
  const e = err as (Error & { code?: string; limit?: number; body?: { limit?: number } }) | null;
  if (e?.code !== "JOB_LIMIT") return null;
  const limit = e.limit ?? e.body?.limit ?? ACTIVE_JOB_LIMIT.monthly_pro ?? 3;
  return { title: t("jobs.jobLimitTitle"), description: t("jobs.jobLimitDesc").replace("{n}", String(limit)) };
}
