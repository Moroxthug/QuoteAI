// Owner HQ (Phase 132): unit economics and the funnel. Pure. Never divides by zero and never invents a number: "not enough data" is null.

const DAYS_PER_MONTH = 30.4375;
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Average monthly revenue per paying customer. 0 when nobody pays (there is nothing to average). */
export function arpuCents(mrrCents: number, payingCustomers: number): number {
  return payingCustomers > 0 ? Math.round(mrrCents / payingCustomers) : 0;
}

/** (revenue - cost of serving it) / revenue, in percent with one decimal. Null with no revenue. */
export function grossMarginPct(revenueCents: number, costOfServiceCents: number): number | null {
  if (revenueCents <= 0) return null;
  return round1(((revenueCents - costOfServiceCents) / revenueCents) * 100);
}

/** Marketing spend per paying customer won. Null when none were won, or when no spend is recorded (cost unknown, never 0). */
export function cacCents(spendCents: number, payingCustomersAcquired: number): number | null {
  if (payingCustomersAcquired <= 0 || spendCents <= 0) return null;
  return Math.round(spendCents / payingCustomersAcquired);
}

/** Share of paying customers lost per month, from a period of any length. Null with nobody paying at the start. */
export function monthlyChurnRate(churnedCustomers: number, payingAtStart: number, days: number): number | null {
  if (payingAtStart <= 0 || days <= 0) return null;
  return (churnedCustomers / payingAtStart) * (DAYS_PER_MONTH / days);
}

export const LTV_MIN_PAYING_AT_START = 10;
export const LTV_MIN_DAYS = 28;

/**
 * LTV = ARPU x gross margin / monthly churn. Null when churn is zero (infinite life is not a number), when the margin is
 * unknown or not positive, or when there is too little data to trust the churn (fewer than 10 paying customers at the start, or under 28 days).
 */
export function ltvCents(p: { arpuCents: number; grossMarginPct: number | null; churnedCustomers: number; payingAtStart: number; days: number }): number | null {
  if (p.payingAtStart < LTV_MIN_PAYING_AT_START || p.days < LTV_MIN_DAYS) return null;
  if (p.grossMarginPct === null || p.grossMarginPct <= 0 || p.arpuCents <= 0) return null;
  const churn = monthlyChurnRate(p.churnedCustomers, p.payingAtStart, p.days);
  if (churn === null || churn <= 0) return null;
  return Math.round((p.arpuCents * (p.grossMarginPct / 100)) / churn);
}

/** Months of gross profit from one customer needed to earn back what it cost to win them. Null without a CAC or margin. */
export function paybackMonths(cac: number | null, arpu: number, grossMarginPctValue: number | null): number | null {
  if (cac === null || grossMarginPctValue === null || grossMarginPctValue <= 0 || arpu <= 0) return null;
  return round1(cac / (arpu * (grossMarginPctValue / 100)));
}

export type FunnelStage = { stage: string; count: number; rateFromPrevious: number | null };

/**
 * Each stage's rate is its count over the previous stage's (or over the stage named in `rateOf`), as a fraction with 4 decimals,
 * kept within 0..1. Null for the first stage and whenever the base count is 0.
 */
export function buildFunnel(stages: Array<{ stage: string; count: number; rateOf?: string }>): FunnelStage[] {
  return stages.map((s, i) => {
    const base = i === 0 ? null : s.rateOf ? (stages.find((x) => x.stage === s.rateOf)?.count ?? null) : stages[i - 1].count;
    const rate = base === null || base <= 0 ? null : Math.min(1, Math.max(0, Math.round((s.count / base) * 10000) / 10000));
    return { stage: s.stage, count: s.count, rateFromPrevious: rate };
  });
}

export type SourceInput = { source: string; signups: number; paying: number; revenueCents: number; spendCents: number };
export type SourceRow = SourceInput & { cacCents: number | null };

/** CAC per channel = that channel's marketing spend / paying customers it brought. Biggest channels first. */
export function buildSources(rows: SourceInput[]): SourceRow[] {
  return rows
    .map((r) => ({ ...r, cacCents: cacCents(r.spendCents, r.paying) }))
    .sort((a, b) => b.signups - a.signups || b.revenueCents - a.revenueCents || a.source.localeCompare(b.source));
}
