// Realistic fixtures for /dashboard/admin/hq?demo=1 (layout review only; not real data).
// Shapes match the as-built backend.
import type {
  HqClient, HqCohorts, HqCustomer, HqExpense, HqOverview, HqPoint, HqRange, HqSpend, HqSeriesMetric,
} from "@/lib/hq-api";

export const demoOverview = (range: HqRange): HqOverview => ({
  range,
  money: {
    mrrCents: 118_100, arrCents: 1_417_200, newMrrCents: 24_700, expansionMrrCents: 3_800,
    contractionMrrCents: 1_200, churnedMrrCents: 5_700, revenueCents: 131_400, refundsCents: 1_900,
    taxCollectedCents: 17_080, feesCents: 4_620,
    costsCents: { ai: 21_300, messaging: 4_150, email: 1_200, storage: 900, infra: 9_500, other: 0 },
    marketingSpendCents: 30_000, profitCents: 62_350, cashCents: 1_850_000, runwayMonths: null,
  },
  customers: { total: 412, paying: 63, trialing: 41, free: 308, newInRange: 87, churnedInRange: 4, foundingCount: 63 },
  funnel: [
    { stage: "visits", count: 9_840, rateFromPrevious: null },
    { stage: "signups", count: 412, rateFromPrevious: 0.0419 },
    { stage: "first_quote", count: 231, rateFromPrevious: 0.5607 },
    { stage: "quote_sent", count: 148, rateFromPrevious: 0.6407 },
    { stage: "quote_accepted", count: 71, rateFromPrevious: 0.4797 },
    { stage: "paying", count: 63, rateFromPrevious: 0.8873 },
  ],
  sources: [
    { source: "google_organic", signups: 141, paying: 24, revenueCents: 45_600, spendCents: 0, cacCents: 0 },
    { source: "facebook", signups: 88, paying: 15, revenueCents: 28_500, spendCents: 12_000, cacCents: 800 },
    { source: "referral", signups: 52, paying: 12, revenueCents: 22_800, spendCents: 0, cacCents: 0 },
    { source: "google_ads", signups: 64, paying: 8, revenueCents: 15_200, spendCents: 18_000, cacCents: 2_250 },
    { source: "unknown", signups: 67, paying: 4, revenueCents: 7_600, spendCents: 0, cacCents: null },
  ],
  unit: { arpuCents: 1_900, ltvCents: null, paybackMonths: 1.4, grossMarginPct: 72.4 },
  product: { quotesCreated: 1_284, quotesSent: 903, quotesAccepted: 311, wau: 148, mau: 236 },
  ops: { cronOk: true, deadRuns: 2, emailBounceRate: 0.011 },
  notes: [
    "Revenue and profit include the list-price estimate for subscribers without billing events.",
    "Usage costs are metered in US cents and are not converted to CAD.",
    "Play Billing is not connected yet; Android revenue will be added in Phase 135.",
  ],
});

const days = (r: HqRange): string[] => {
  const out: string[] = [];
  const d = new Date(`${r.from}T12:00:00Z`);
  const end = new Date(`${r.to}T12:00:00Z`);
  while (d <= end && out.length < 800) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
};

export const demoSeries = (metric: HqSeriesMetric, r: HqRange): HqPoint[] =>
  days(r).map((at, i) => {
    const wave = 1 + 0.25 * Math.sin(i / 2.3);
    const base = { revenue: 4_400, costs: 1_900, profit: 2_500, mrr: 100_000 + i * 600, signups: 3, quotes: 40 }[metric];
    return { at, value: Math.round(base * wave) };
  });

export const demoCohorts: HqCohorts = {
  months: 6,
  cohorts: [
    { month: "2026-05", signups: 38, active: [100, 68.4, 55.3, 50, 47.4, 44.7], paying: [10.5, 13.2, 15.8, 15.8, 15.8, 18.4] },
    { month: "2026-06", signups: 52, active: [100, 71.2, 59.6, 51.9, 48.1, null], paying: [11.5, 15.4, 17.3, 17.3, 19.2, null] },
    { month: "2026-07", signups: 74, active: [100, 66.2, 54.1, 48.6, null, null], paying: [9.5, 12.2, 14.9, 16.2, null, null] },
    { month: "2026-08", signups: 96, active: [100, 70.8, 58.3, null, null, null], paying: [12.5, 15.6, 16.7, null, null, null] },
    { month: "2026-09", signups: 119, active: [100, 73.1, null, null, null, null], paying: [11.8, 14.3, null, null, null, null] },
    { month: "2026-10", signups: 87, active: [100, null, null, null, null, null], paying: [12.6, null, null, null, null, null] },
  ],
  notes: ["Billing history starts 2026-07, so earlier paying percentages are blank where unknown."],
};

const cust = (
  i: number, companyName: string, plan: string, since: string, rev: number, ai: number, source: string, last: string, founding = false,
): HqCustomer => ({
  userId: `u${i}`, companyName, email: `owner${i}@example.test`, plan, status: rev ? "active" : "free", interval: "month",
  since, source, founding, mtdRevenueCents: rev, estimated: i % 4 === 0, aiCostCents: ai, costCents: ai,
  marginCents: rev - ai, lastActiveAt: last,
});
const demoCustomers: HqCustomer[] = [
  cust(1, "Northline Roofing", "monthly_pro", "2026-06-02", 7_900, 410, "google_organic", "2026-10-18"),
  cust(2, "Maple & Stone Landscaping", "monthly_starter", "2026-07-14", 1_900, 120, "facebook", "2026-10-19", true),
  cust(3, "Bouchard Plomberie", "monthly_pro", "2026-05-21", 7_900, 980, "referral", "2026-10-17"),
  cust(4, "Prairie HVAC", "monthly_business", "2026-08-30", 24_900, 2_310, "google_ads", "2026-10-19"),
  cust(5, "Kwan Electric", "monthly_starter", "2026-09-09", 1_900, 205, "google_organic", "2026-10-12", true),
  cust(6, "Lakeshore Painting", "monthly_starter", "2026-09-11", 1_900, 88, "unknown", "2026-09-30", true),
  cust(7, "Atlantic Decks", "free", "2026-10-03", 0, 31, "google_organic", "2026-10-15"),
  cust(8, "Cedrik Renovation", "monthly_starter", "2026-09-25", 1_900, 342, "referral", "2026-10-18", true),
];

const sortKey = (c: HqCustomer, s: string): string | number => {
  switch (s) {
    case "company": return (c.companyName ?? "").toLowerCase();
    case "plan": return c.plan ?? "";
    case "revenue": return c.mtdRevenueCents;
    case "aiCost": return c.aiCostCents;
    case "margin": return c.marginCents;
    default: return c.since ?? "";
  }
};

let expenses: HqExpense[] = [
  { id: "e1", name: "Vercel Pro", category: "infrastructure", amountCents: 2_900, currency: "CAD", cadence: "monthly", startsOn: "2026-01-01", endsOn: null, note: null, createdAt: "2026-01-01T00:00:00Z", countedCentsInRange: 2_900 },
  { id: "e2", name: "Supabase", category: "infrastructure", amountCents: 3_400, currency: "CAD", cadence: "monthly", startsOn: "2026-01-01", endsOn: null, note: null, createdAt: "2026-01-01T00:00:00Z", countedCentsInRange: 3_400 },
  { id: "e3", name: "Accountant, Q3", category: "legal_accounting", amountCents: 45_000, currency: "CAD", cadence: "one_off", startsOn: "2026-10-05", endsOn: null, note: "Quarterly filing", createdAt: "2026-10-05T00:00:00Z", countedCentsInRange: 45_000 },
];
let spend: HqSpend[] = [
  { id: "s1", channel: "google_ads", campaign: "October", spentOn: "2026-10-03", amountCents: 18_000, currency: "CAD", note: null, createdAt: "2026-10-03T00:00:00Z" },
  { id: "s2", channel: "facebook", campaign: null, spentOn: "2026-10-08", amountCents: 12_000, currency: "CAD", note: "Sponsored post", createdAt: "2026-10-08T00:00:00Z" },
];
let cash: number | null = 1_850_000;
const tick = () => new Promise<void>((res) => setTimeout(res, 150));

export const demoClient: HqClient = {
  overview: async (r) => { await tick(); const o = demoOverview(r); o.money.cashCents = cash; return o; },
  series: async (metric, _b, r) => { await tick(); return demoSeries(metric, r); },
  cohorts: async () => demoCohorts,
  customers: async (q) => {
    const needle = q.q.trim().toLowerCase();
    const list = demoCustomers
      .filter((c) => !needle || [c.companyName, c.email, c.plan, c.source].some((s) => s?.toLowerCase().includes(needle)))
      .sort((a, b) => {
        const x = sortKey(a, q.sort), y = sortKey(b, q.sort);
        return (x < y ? -1 : x > y ? 1 : 0) * (q.dir === "asc" ? 1 : -1);
      });
    return { customers: list.slice(q.offset, q.offset + q.limit), total: list.length, limit: q.limit, offset: q.offset, month: "2026-10", notes: ["Costs are in US cents."] };
  },
  expenses: async (r) => ({ range: r, items: [...expenses], totalInRangeCents: expenses.reduce((a, e) => a + e.countedCentsInRange, 0) }),
  addExpense: async (i) => {
    await tick();
    expenses = [{ id: `e${Date.now()}`, currency: "CAD", endsOn: null, note: null, createdAt: new Date().toISOString(), countedCentsInRange: i.amountCents, ...i }, ...expenses];
  },
  deleteExpense: async (id) => { await tick(); expenses = expenses.filter((e) => e.id !== id); },
  spend: async (r) => ({
    range: r, items: [...spend], totalCents: spend.reduce((a, s) => a + s.amountCents, 0),
    byChannel: [], truncated: false,
  }),
  addSpend: async (i) => {
    await tick();
    spend = [{ id: `s${Date.now()}`, currency: "CAD", campaign: null, note: null, createdAt: new Date().toISOString(), ...i, channel: i.channel.toLowerCase() }, ...spend];
  },
  deleteSpend: async (id) => { await tick(); spend = spend.filter((e) => e.id !== id); },
  setCash: async (c) => { await tick(); cash = c; return { cashCents: c, updatedAt: new Date().toISOString() }; },
  exportUrl: () => "#demo",
};
