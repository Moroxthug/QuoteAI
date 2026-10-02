// Analytics: the server calls (routes/analytics.ts). Both are for the plans with business analytics; the others get a 403 PLAN_REQUIRED, which comes back
// as `{ locked: true }` so the screen keeps showing the plan card while the query refetches.
import { api, ApiFailure } from "./api";
import type { CompanyAnalytics, Insights } from "./analytics";

export type Locked = { locked: true };
export const isLocked = (x: unknown): x is Locked => !!x && typeof x === "object" && "locked" in x;

async function gated<T>(path: string): Promise<T | Locked> {
  try {
    return await api<T>(path);
  } catch (e) {
    if (e instanceof ApiFailure && e.status === 403) return { locked: true };
    throw e;
  }
}

export const analyticsApi = {
  company: () => gated<CompanyAnalytics>("/api/analytics/company?months=48"),
  insights: () => gated<Insights>("/api/analytics/insights?months=48"),
};
