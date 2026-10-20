// Typed client for the owner HQ API (Phase 132), matching the as-built backend
// (artifacts/api-server/src/routes/admin-hq.ts, src/hq/). Money is integer cents.
// Usage costs are metered in US cents by the backend (not converted).
import { demoClient } from "@/lib/hq-fixtures";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type HqRange = { from: string; to: string };

export type HqCosts = {
  ai: number; messaging: number; email: number; storage: number; infra: number; other: number;
};

export type HqFunnelStage = "visits" | "signups" | "first_quote" | "quote_sent" | "quote_accepted" | "paying";

export type HqOverview = {
  range: HqRange;
  money: {
    mrrCents: number; arrCents: number; newMrrCents: number; expansionMrrCents: number;
    contractionMrrCents: number; churnedMrrCents: number;
    revenueCents: number; refundsCents: number; taxCollectedCents: number; feesCents: number;
    costsCents: HqCosts; marketingSpendCents: number; profitCents: number;
    cashCents: number | null; runwayMonths: number | null;
  };
  customers: {
    total: number; paying: number; trialing: number; free: number;
    newInRange: number; churnedInRange: number; foundingCount: number;
    /** Not sent by the backend today; the page falls back to 100 when absent. */
    foundingLimit?: number;
  };
  funnel: { stage: HqFunnelStage; count: number; rateFromPrevious: number | null }[];
  sources: {
    source: string; signups: number; paying: number; revenueCents: number;
    spendCents: number; cacCents: number | null;
  }[];
  unit: {
    arpuCents: number; ltvCents: number | null; paybackMonths: number | null; grossMarginPct: number | null;
  };
  product: { quotesCreated: number; quotesSent: number; quotesAccepted: number; wau: number; mau: number };
  ops: { cronOk: boolean | null; deadRuns: number | null; emailBounceRate: number | null };
  notes: string[];
};

export type HqPoint = { at: string; value: number };
export type HqSeriesMetric = "mrr" | "signups" | "revenue" | "costs" | "profit" | "quotes";
export type HqBucket = "day" | "week" | "month";

export type HqCohorts = {
  months: number;
  cohorts: { month: string; signups: number; active: (number | null)[]; paying: (number | null)[] }[];
  notes: string[];
};

export type HqCustomerSort = "since" | "company" | "plan" | "revenue" | "aiCost" | "margin";
export type HqCustomer = {
  userId: string; companyName: string | null; email: string | null; plan: string | null;
  status: string | null; interval: string | null; since: string | null; source: string | null;
  founding: boolean; mtdRevenueCents: number; estimated: boolean;
  aiCostCents: number; costCents: number; marginCents: number; lastActiveAt: string | null;
};
export type HqCustomers = {
  customers: HqCustomer[]; total: number; limit: number; offset: number; month: string; notes: string[];
};
export type HqCustomerQuery = { sort: HqCustomerSort; dir: "asc" | "desc"; q: string; limit: number; offset: number };

export const EXPENSE_CATEGORIES = [
  "infrastructure", "ai", "messaging", "email", "software", "marketing", "payment_fees",
  "legal_accounting", "payroll", "tax", "other",
] as const;
export const EXPENSE_CADENCES = ["one_off", "monthly", "yearly"] as const;
export type HqCadence = (typeof EXPENSE_CADENCES)[number];

export type HqExpense = {
  id: string; name: string; category: string; amountCents: number; currency: string;
  cadence: HqCadence; startsOn: string; endsOn: string | null; note: string | null;
  createdAt: string; countedCentsInRange: number;
};
export type HqExpenses = { range: HqRange; items: HqExpense[]; totalInRangeCents: number };
export type HqExpenseInput = {
  name: string; category: string; amountCents: number; cadence: HqCadence;
  startsOn: string; endsOn?: string | null; note?: string | null;
};

export type HqSpend = {
  id: string; channel: string; campaign: string | null; spentOn: string; amountCents: number;
  currency: string; note: string | null; createdAt: string;
};
export type HqSpendList = {
  range: HqRange; items: HqSpend[]; totalCents: number;
  byChannel: { channel: string; amountCents: number }[]; truncated: boolean;
};
export type HqSpendInput = {
  channel: string; campaign?: string | null; spentOn: string; amountCents: number; note?: string | null;
};

export type HqCash = { cashCents: number | null; updatedAt: string | null };

export const EXPORT_KINDS = ["revenue", "expenses", "customers"] as const;
export type HqExportKind = (typeof EXPORT_KINDS)[number];

export class HqUnavailableError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE}/api/admin/hq${path}`, {
      ...init,
      redirect: "manual",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new HqUnavailableError(0, "Network error");
  }
  if (r.type === "opaqueredirect" || r.status === 302 || r.status === 403 || r.status === 401) {
    throw new HqUnavailableError(403, "Forbidden");
  }
  const ct = r.headers.get("content-type") ?? "";
  if (!r.ok || !ct.includes("json")) {
    const body = (await r.json().catch(() => ({}))) as { error?: string; issues?: { path: string; message: string }[] };
    const detail = body.issues?.length ? `: ${body.issues.map((i) => `${i.path} ${i.message}`).join("; ")}` : "";
    throw new HqUnavailableError(r.status, `${body.error ?? `HTTP ${r.status}`}${detail}`);
  }
  return r.json() as Promise<T>;
}

const qs = (p: Record<string, string | number | undefined>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
};

export type HqClient = {
  overview(r: HqRange): Promise<HqOverview>;
  series(metric: HqSeriesMetric, bucket: HqBucket, r: HqRange): Promise<HqPoint[]>;
  cohorts(months?: number): Promise<HqCohorts>;
  customers(q: HqCustomerQuery): Promise<HqCustomers>;
  expenses(r: HqRange): Promise<HqExpenses>;
  addExpense(i: HqExpenseInput): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  spend(r: HqRange): Promise<HqSpendList>;
  addSpend(i: HqSpendInput): Promise<void>;
  deleteSpend(id: string): Promise<void>;
  setCash(cents: number | null): Promise<HqCash>;
  exportUrl(kind: HqExportKind, r: HqRange): string;
};

export const liveClient: HqClient = {
  overview: (r) => call<HqOverview>(`/overview${qs(r)}`),
  series: (metric, bucket, r) => call<HqPoint[]>(`/series${qs({ metric, bucket, ...r })}`),
  cohorts: (months = 12) => call<HqCohorts>(`/cohorts${qs({ months })}`),
  customers: (q) => call<HqCustomers>(`/customers${qs(q)}`),
  expenses: (r) => call<HqExpenses>(`/expenses${qs(r)}`),
  addExpense: async (i) => { await call("/expenses", { method: "POST", body: JSON.stringify(i) }); },
  deleteExpense: async (id) => { await call(`/expenses/${encodeURIComponent(id)}`, { method: "DELETE" }); },
  spend: (r) => call<HqSpendList>(`/marketing-spend${qs(r)}`),
  addSpend: async (i) => { await call("/marketing-spend", { method: "POST", body: JSON.stringify(i) }); },
  deleteSpend: async (id) => { await call(`/marketing-spend/${encodeURIComponent(id)}`, { method: "DELETE" }); },
  setCash: (cashCents) => call<HqCash>("/settings/cash", { method: "PUT", body: JSON.stringify({ cashCents }) }),
  exportUrl: (kind, r) => `${BASE}/api/admin/hq/export.csv${qs({ kind, ...r })}`,
};

export function getHqClient(demo: boolean): HqClient {
  return demo ? demoClient : liveClient;
}
