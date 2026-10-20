// Owner HQ (Phase 132): money maths. Pure: rows in, numbers out. All money is integer cents.

import { daysInclusive } from "./time";

const DAYS_PER_MONTH_EST = 30.4375;

/** A subscriber with no recorded billing events: what they would have paid at list price. */
export type EstimatedCustomer = { monthlyCents: number; sinceYmd: string };

/** Estimated (not measured) revenue ex tax inside [from, to]: list price per month, prorated by days, from the day they signed up. */
export function estimatedRevenueExact(list: EstimatedCustomer[], from: string, to: string): number {
  let sum = 0;
  for (const c of list) {
    const start = c.sinceYmd > from ? c.sinceYmd : from;
    if (start > to) continue;
    sum += (c.monthlyCents * daysInclusive(start, to)) / DAYS_PER_MONTH_EST;
  }
  return sum;
}

export type SubEventType = "subscription_started" | "subscription_changed" | "subscription_canceled";

/** One subscription row from billing_events. `amountCents` is the MONTHLY-equivalent recurring amount (a yearly price counts as 1/12). */
export type SubEvent = { key: string; type: SubEventType; amountCents: number; at: Date };

export type MrrMovement = {
  newCents: number;
  expansionCents: number;
  /** Downgrades that stay subscribed. Not in the contract's three buckets, so it is reported separately. */
  contractionCents: number;
  churnedCents: number;
  newCustomers: number;
  churnedCustomers: number;
};

const byTime = (a: SubEvent, b: SubEvent): number => a.at.getTime() - b.at.getTime();

/** Each customer's monthly recurring amount after every event strictly before `before` (0 = not subscribed). */
export function mrrStateAt(events: SubEvent[], before: Date): Map<string, number> {
  const state = new Map<string, number>();
  for (const e of [...events].sort(byTime)) {
    if (e.at.getTime() >= before.getTime()) break;
    state.set(e.key, e.type === "subscription_canceled" ? 0 : Math.max(0, e.amountCents));
  }
  return state;
}

export function mrrAt(events: SubEvent[], before: Date): number {
  let sum = 0;
  for (const v of mrrStateAt(events, before).values()) sum += v;
  return sum;
}

/** New / expansion / contraction / churned MRR for events inside [from, to). Earlier events set each customer's starting point. */
export function mrrMovements(events: SubEvent[], from: Date, to: Date): MrrMovement {
  const out: MrrMovement = { newCents: 0, expansionCents: 0, contractionCents: 0, churnedCents: 0, newCustomers: 0, churnedCustomers: 0 };
  const state = new Map<string, number>();
  for (const e of [...events].sort(byTime)) {
    if (e.at.getTime() >= to.getTime()) break;
    const prior = state.get(e.key) ?? 0;
    const amount = Math.max(0, e.amountCents);
    const next = e.type === "subscription_canceled" ? 0 : amount;
    state.set(e.key, next);
    if (e.at.getTime() < from.getTime()) continue;
    if (next > prior) {
      if (prior === 0) {
        out.newCents += next;
        out.newCustomers += 1;
      } else out.expansionCents += next - prior;
    } else if (next < prior) {
      if (next === 0) {
        out.churnedCents += prior;
        out.churnedCustomers += 1;
      } else out.contractionCents += prior - next;
    } else if (e.type === "subscription_canceled" && prior === 0) {
      // A cancellation for a subscription whose start we never saw (before billing_events existed): the event carries its amount.
      out.churnedCents += amount;
      out.churnedCustomers += 1;
    }
  }
  return out;
}

export type MoneyRow = { type: "payment" | "refund" | "dispute"; amountCents: number; taxCents: number; feeCents: number };

export type MoneyTotals = {
  grossCents: number;
  /** Paid minus tax: GST/HST collected is owed to the CRA and is not revenue. */
  revenueCents: number;
  taxCollectedCents: number;
  refundsCents: number;
  disputesCents: number;
  feesCents: number;
};

export function moneyTotals(rows: MoneyRow[]): MoneyTotals {
  const t: MoneyTotals = { grossCents: 0, revenueCents: 0, taxCollectedCents: 0, refundsCents: 0, disputesCents: 0, feesCents: 0 };
  for (const r of rows) {
    t.feesCents += r.feeCents;
    if (r.type === "payment") {
      t.grossCents += r.amountCents;
      t.taxCollectedCents += r.taxCents;
      t.revenueCents += r.amountCents - r.taxCents;
    } else if (r.type === "refund") t.refundsCents += r.amountCents;
    else t.disputesCents += r.amountCents;
  }
  return t;
}

/** Revenue (ex tax) minus refunds, fees, costs and marketing spend. Disputes are not deducted until they are lost and show up as a refund. */
export function profitCents(p: { revenueCents: number; refundsCents: number; feesCents: number; costsCents: number; marketingSpendCents: number }): number {
  return p.revenueCents - p.refundsCents - p.feesCents - p.costsCents - p.marketingSpendCents;
}

const DAYS_PER_MONTH = 30.4375;

/** Months of cash left at the period's average monthly net burn. Null when cash is unknown or the period did not burn cash. */
export function runwayMonths(cashCents: number | null, periodProfitCents: number, days: number): number | null {
  if (cashCents === null || !Number.isFinite(cashCents) || days <= 0 || periodProfitCents >= 0) return null;
  if (cashCents <= 0) return 0;
  const monthlyBurn = (-periodProfitCents * DAYS_PER_MONTH) / days;
  return Math.round((cashCents / monthlyBurn) * 10) / 10;
}

/** A plan's list price as a monthly cents figure (yearly prices count as a twelfth). */
export function listMonthlyCents(priceCad: number | null | undefined, interval: string | null | undefined, yearlyPriceCad?: number | null): number {
  if (priceCad === null || priceCad === undefined || priceCad <= 0) return 0;
  if (interval === "year") return Math.round(((yearlyPriceCad ?? priceCad * 12) * 100) / 12);
  return Math.round(priceCad * 100);
}
