// The QuickBooks server calls (routes/quickbooks.ts).
import { api } from "./api";
import type { Conn, LogEntry } from "./quickbooks";

type Ref = { id: string; name: string };
export type Accounts = { expenseAccounts: Ref[]; paymentAccounts: Ref[]; incomeAccounts: Ref[]; depositAccounts: Ref[]; taxCodes: Ref[] };

export const quickbooksApi = {
  status: () => api<Conn>("/api/quickbooks/status"),
  log: () => api<{ entries: LogEntry[] }>("/api/quickbooks/sync-log"),
  /** The address of Intuit's own sign-in page. */
  connect: () => api<{ url: string }>("/api/quickbooks/connect"),
  disconnect: () => api<unknown>("/api/quickbooks/disconnect", { method: "DELETE" }),
  toggle: (isEnabled: boolean) => api<unknown>("/api/quickbooks/toggle", { method: "PATCH", body: { isEnabled } }),
  accounts: () => api<Accounts>("/api/quickbooks/accounts"),
  mapping: (body: { paymentAccount?: Ref | null; incomeAccount?: Ref | null; depositAccount?: Ref | null; categoryMap?: Record<string, Ref | null>; taxCodeMap?: Record<string, Ref | null>; pullPayments?: boolean }) => api<unknown>("/api/quickbooks/mapping", { method: "PUT", body }),
  pull: () => api<Record<string, unknown>>("/api/quickbooks/pull", { method: "POST", body: {} }),
  backfill: () => api<Record<string, unknown>>("/api/quickbooks/backfill", { method: "POST", body: {} }),
  retry: (entityType: string, entityId: string) => api<unknown>("/api/quickbooks/sync-log/retry", { method: "POST", body: { entityType, entityId } }),
};
