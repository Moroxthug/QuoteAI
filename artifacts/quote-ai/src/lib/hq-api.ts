// Typed client for the owner HQ API (Phase 132). Mirrors the contract at the
// bottom of docs/GROWTH-PLAN.md. All money is integer cents (CAD).
// Shapes the contract leaves open (cohorts, customers, ledger rows, series) are
// normalised below so a small difference in field names does not break the page.
import { demoClient } from "@/lib/hq-fixtures";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type HqRange = { from: string; to: string };

export type HqCosts = {
  ai: number | null; messaging: number | null; email: number | null;
  storage: number | null; infra: number | null; other: number | null;
};

export type HqOverview = {
  range: HqRange;
  money: {
    mrrCents: number | null; arrCents: number | null; newMrrCents: number | null;
    expansionMrrCents: number | null; churnedMrrCents: number | null;
    revenueCents: number | null; refundsCents: number | null;
    taxCollectedCents: number | null; feesCents: number | null;
    costsCents: HqCosts; marketingSpendCents: number | null;
    profitCents: number | null; cashCents: number | null; runwayMonths: number | null;
  };
  customers: {
    total: number; paying: number; trialing: number; free: number;
    newInRange: number; churnedInRange: number; foundingCount: number;
  };
  funnel: { stage: string; count: number; rateFromPrevious: number | null }[];
  sources: {
    source: string; signups: number; paying: number; revenueCents: number | null;
    spendCents: number | null; cacCents: number | null;
  }[];
  unit: {
    arpuCents: number | null; ltvCents: number | null;
    paybackMonths: number | null; grossMarginPct: number | null;
  };
  product: {
    quotesCreated: number; quotesSent: number; quotesAccepted: number;
    wau: number | null; mau: number | null;
  };
  ops: { cronOk: boolean | null; deadRuns: number | null; emailBounceRate: number | null };
  notes: string[];
};

export type HqPoint = { at: string; value: number | null };
export type HqSeriesMetric = "mrr" | "signups" | "revenue" | "costs" | "profit" | "quotes";
export type HqBucket = "day" | "week" | "month";

export type HqCohort = { cohort: string; size: number; retention: (number | null)[] };

export type HqCustomer = {
  id: string; name: string; plan: string | null; since: string | null;
  mtdRevenueCents: number | null; aiCostCents: number | null; marginCents: number | null;
  lastActiveAt: string | null; source: string | null;
};

export type HqExpense = {
  id: string; date: string; category: string; description: string;
  amountCents: number; recurring: boolean;
};
export type HqExpenseInput = {
  date: string; category: string; description: string; amountCents: number; recurring?: boolean;
};
export type HqSpend = { id: string; date: string; source: string; note: string; amountCents: number };
export type HqSpendInput = { date: string; source: string; note: string; amountCents: number };

export const EXPENSE_CATEGORIES = ["ai", "messaging", "email", "storage", "infra", "other"] as const;
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
    const body = await r.json().catch(() => ({}));
    throw new HqUnavailableError(r.status, (body as { error?: string }).error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

const qs = (p: Record<string, string | undefined>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : "";
};

// ---- normalisers ----------------------------------------------------------
type Row = Record<string, unknown>;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const rows = (v: unknown): Row[] => {
  if (Array.isArray(v)) return v as Row[];
  if (v && typeof v === "object") {
    const o = v as Row;
    for (const k of ["rows", "items", "data", "customers", "cohorts", "expenses", "spend"]) {
      if (Array.isArray(o[k])) return o[k] as Row[];
    }
  }
  return [];
};

export function normaliseCohorts(raw: unknown): HqCohort[] {
  return rows(raw)
    .map((r) => {
      const ret = r.retention ?? r.values ?? r.months ?? r.rates ?? [];
      return {
        cohort: str(r.cohort) ?? str(r.month) ?? str(r.signupMonth) ?? "",
        size: num(r.size) ?? num(r.signups) ?? num(r.customers) ?? 0,
        retention: Array.isArray(ret) ? ret.map(num) : [],
      };
    })
    .filter((c) => c.cohort);
}

export function normaliseCustomers(raw: unknown): HqCustomer[] {
  return rows(raw).map((r, i) => ({
    id: str(r.id) ?? str(r.companyId) ?? str(r.userId) ?? String(i),
    name: str(r.name) ?? str(r.companyName) ?? str(r.company) ?? str(r.email) ?? "Unnamed",
    plan: str(r.plan),
    since: str(r.since) ?? str(r.createdAt),
    mtdRevenueCents: num(r.mtdRevenueCents) ?? num(r.revenueCents) ?? num(r.mtdRevenue),
    aiCostCents: num(r.aiCostCents) ?? num(r.aiCost),
    marginCents: num(r.marginCents) ?? num(r.margin),
    lastActiveAt: str(r.lastActiveAt) ?? str(r.lastActive),
    source: str(r.source),
  }));
}

const normExpense = (r: Row, i: number): HqExpense => ({
  id: str(r.id) ?? String(i),
  date: str(r.date) ?? str(r.incurredOn) ?? "",
  category: str(r.category) ?? "other",
  description: str(r.description) ?? str(r.vendor) ?? str(r.note) ?? "",
  amountCents: num(r.amountCents) ?? 0,
  recurring: r.recurring === true || (typeof r.recurring === "string" && r.recurring !== "none"),
});
const normSpend = (r: Row, i: number): HqSpend => ({
  id: str(r.id) ?? String(i),
  date: str(r.date) ?? str(r.spentOn) ?? "",
  source: str(r.source) ?? str(r.channel) ?? "other",
  note: str(r.note) ?? str(r.description) ?? "",
  amountCents: num(r.amountCents) ?? 0,
});

// ---- client ---------------------------------------------------------------
export type HqClient = {
  overview(r: HqRange): Promise<HqOverview>;
  series(metric: HqSeriesMetric, bucket: HqBucket, r: HqRange): Promise<HqPoint[]>;
  cohorts(): Promise<HqCohort[]>;
  customers(sort: string, q: string): Promise<HqCustomer[]>;
  expenses(r: HqRange): Promise<HqExpense[]>;
  addExpense(i: HqExpenseInput): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  spend(r: HqRange): Promise<HqSpend[]>;
  addSpend(i: HqSpendInput): Promise<void>;
  deleteSpend(id: string): Promise<void>;
  setCash(cents: number | null): Promise<void>;
  exportUrl(kind: HqExportKind, r: HqRange): string;
};

export const liveClient: HqClient = {
  overview: (r) => call<HqOverview>(`/overview${qs(r)}`),
  series: async (metric, bucket, r) => {
    const raw = await call<unknown>(`/series${qs({ metric, bucket, ...r })}`);
    return rows(raw).map((p) => ({ at: str(p.at) ?? "", value: num(p.value) }));
  },
  cohorts: async () => normaliseCohorts(await call<unknown>("/cohorts")),
  customers: async (sort, q) => normaliseCustomers(await call<unknown>(`/customers${qs({ sort, q })}`)),
  expenses: async (r) => rows(await call<unknown>(`/expenses${qs(r)}`)).map(normExpense),
  addExpense: async (i) => { await call("/expenses", { method: "POST", body: JSON.stringify(i) }); },
  deleteExpense: async (id) => { await call(`/expenses/${encodeURIComponent(id)}`, { method: "DELETE" }); },
  spend: async (r) => rows(await call<unknown>(`/marketing-spend${qs(r)}`)).map(normSpend),
  addSpend: async (i) => { await call("/marketing-spend", { method: "POST", body: JSON.stringify(i) }); },
  deleteSpend: async (id) => { await call(`/marketing-spend/${encodeURIComponent(id)}`, { method: "DELETE" }); },
  setCash: async (cents) => { await call("/settings/cash", { method: "PUT", body: JSON.stringify({ cashCents: cents }) }); },
  exportUrl: (kind, r) => `${BASE}/api/admin/hq/export.csv${qs({ kind, ...r })}`,
};

export function getHqClient(demo: boolean): HqClient {
  return demo ? demoClient : liveClient;
}
