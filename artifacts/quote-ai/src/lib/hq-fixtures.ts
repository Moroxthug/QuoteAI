// Realistic fixtures for /dashboard/admin/hq?demo=1 (layout review only; not real data).
import type {
  HqClient, HqCohort, HqCustomer, HqExpense, HqOverview, HqPoint, HqRange, HqSpend,
  HqSeriesMetric,
} from "@/lib/hq-api";

export const demoOverview = (range: HqRange): HqOverview => ({
  range,
  money: {
    mrrCents: 118_100, arrCents: 1_417_200, newMrrCents: 24_700, expansionMrrCents: 3_800,
    churnedMrrCents: 5_700, revenueCents: 131_400, refundsCents: 1_900, taxCollectedCents: 17_080,
    feesCents: 4_620,
    costsCents: { ai: 21_300, messaging: 4_150, email: 1_200, storage: 900, infra: 9_500, other: null },
    marketingSpendCents: 30_000, profitCents: 62_350, cashCents: 1_850_000, runwayMonths: null,
  },
  customers: { total: 412, paying: 63, trialing: 41, free: 308, newInRange: 87, churnedInRange: 4, foundingCount: 63 },
  funnel: [
    { stage: "Visitors", count: 9_840, rateFromPrevious: null },
    { stage: "Signed up", count: 412, rateFromPrevious: 0.0419 },
    { stage: "Created a quote", count: 231, rateFromPrevious: 0.5607 },
    { stage: "Sent a quote", count: 148, rateFromPrevious: 0.6407 },
    { stage: "Hit the free limit", count: 96, rateFromPrevious: 0.6486 },
    { stage: "Paying", count: 63, rateFromPrevious: 0.6563 },
  ],
  sources: [
    { source: "Google search", signups: 141, paying: 24, revenueCents: 45_600, spendCents: 0, cacCents: 0 },
    { source: "Facebook group", signups: 88, paying: 15, revenueCents: 28_500, spendCents: 12_000, cacCents: 800 },
    { source: "Referral", signups: 52, paying: 12, revenueCents: 22_800, spendCents: 0, cacCents: 0 },
    { source: "Google Ads", signups: 64, paying: 8, revenueCents: 15_200, spendCents: 18_000, cacCents: 2_250 },
    { source: "Direct", signups: 67, paying: 4, revenueCents: 7_600, spendCents: null, cacCents: null },
  ],
  unit: { arpuCents: 1_900, ltvCents: null, paybackMonths: 1.4, grossMarginPct: 0.72 },
  product: { quotesCreated: 1_284, quotesSent: 903, quotesAccepted: 311, wau: 148, mau: 236 },
  ops: { cronOk: true, deadRuns: 2, emailBounceRate: 0.011 },
  notes: [
    "Play Billing fees are not connected yet; revenue from Android will be added in Phase 135.",
    "Infra cost is an estimate from your recurring expenses, not from provider invoices.",
    "Visitors come from the first-party page-view events, which started on 2026-10-12.",
  ],
});

const days = (r: HqRange): string[] => {
  const out: string[] = [];
  const d = new Date(`${r.from}T12:00:00Z`);
  const end = new Date(`${r.to}T12:00:00Z`);
  while (d <= end && out.length < 400) {
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

const m = (v: (number | null)[]) => v;
export const demoCohorts: HqCohort[] = [
  { cohort: "2026-05", size: 38, retention: m([1, 0.68, 0.55, 0.5, 0.47, 0.45]) },
  { cohort: "2026-06", size: 52, retention: m([1, 0.71, 0.59, 0.52, 0.49]) },
  { cohort: "2026-07", size: 74, retention: m([1, 0.66, 0.54, 0.48]) },
  { cohort: "2026-08", size: 96, retention: m([1, 0.7, 0.58]) },
  { cohort: "2026-09", size: 119, retention: m([1, 0.73]) },
  { cohort: "2026-10", size: 87, retention: m([1]) },
];

export const demoCustomers: HqCustomer[] = [
  ["Northline Roofing", "Pro", "2026-06-02", 7_900, 410, "Google search", "2026-10-18"],
  ["Maple & Stone Landscaping", "Starter", "2026-07-14", 2_900, 120, "Facebook group", "2026-10-19"],
  ["Bouchard Plomberie", "Pro", "2026-05-21", 7_900, 980, "Referral", "2026-10-17"],
  ["Prairie HVAC", "Business", "2026-08-30", 24_900, 2_310, "Google Ads", "2026-10-19"],
  ["Kwan Electric", "Founding", "2026-09-09", 1_900, 205, "Google search", "2026-10-12"],
  ["Lakeshore Painting", "Founding", "2026-09-11", 1_900, 88, "Direct", "2026-09-30"],
  ["Atlantic Decks", "Free", "2026-10-03", 0, 31, "Google search", "2026-10-15"],
  ["Cédrik Rénovation", "Founding", "2026-09-25", 1_900, 342, "Referral", "2026-10-18"],
].map(([name, plan, since, rev, ai, source, last], i) => ({
  id: String(i), name: name as string, plan: plan as string, since: since as string,
  mtdRevenueCents: rev as number, aiCostCents: ai as number,
  marginCents: (rev as number) - (ai as number), lastActiveAt: last as string, source: source as string,
}));

let expenses: HqExpense[] = [
  { id: "e1", date: "2026-10-01", category: "infra", description: "Vercel Pro", amountCents: 2_900, recurring: true },
  { id: "e2", date: "2026-10-01", category: "infra", description: "Supabase", amountCents: 3_400, recurring: true },
  { id: "e3", date: "2026-10-05", category: "other", description: "Accountant, Q3", amountCents: 45_000, recurring: false },
];
let spend: HqSpend[] = [
  { id: "s1", date: "2026-10-03", source: "Google Ads", note: "October campaign", amountCents: 18_000 },
  { id: "s2", date: "2026-10-08", source: "Facebook group", note: "Sponsored post", amountCents: 12_000 },
];
let cash: number | null = 1_850_000;
const tick = () => new Promise<void>((res) => setTimeout(res, 150));

export const demoClient: HqClient = {
  overview: async (r) => { await tick(); const o = demoOverview(r); o.money.cashCents = cash; return o; },
  series: async (metric, _b, r) => { await tick(); return demoSeries(metric, r); },
  cohorts: async () => demoCohorts,
  customers: async (_s, q) => demoCustomers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())),
  expenses: async () => [...expenses],
  addExpense: async (i) => { await tick(); expenses = [{ id: `e${Date.now()}`, recurring: false, ...i }, ...expenses]; },
  deleteExpense: async (id) => { await tick(); expenses = expenses.filter((e) => e.id !== id); },
  spend: async () => [...spend],
  addSpend: async (i) => { await tick(); spend = [{ id: `s${Date.now()}`, ...i }, ...spend]; },
  deleteSpend: async (id) => { await tick(); spend = spend.filter((e) => e.id !== id); },
  setCash: async (c) => { await tick(); cash = c; },
  exportUrl: () => "#demo",
};
