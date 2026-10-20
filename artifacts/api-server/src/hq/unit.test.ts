import { describe, expect, it } from "vitest";
import { arpuCents, buildFunnel, buildSources, cacCents, grossMarginPct, ltvCents, monthlyChurnRate, paybackMonths } from "./unit";

describe("unit economics", () => {
  it("ARPU never divides by zero", () => {
    expect(arpuCents(0, 0)).toBe(0);
    expect(arpuCents(9700, 0)).toBe(0);
    expect(arpuCents(9700, 4)).toBe(2425);
  });
  it("gross margin is null with no revenue", () => {
    expect(grossMarginPct(0, 500)).toBeNull();
    expect(grossMarginPct(10000, 1500)).toBe(85);
    expect(grossMarginPct(10000, 12000)).toBe(-20);
  });
  it("CAC is null when no customer was won", () => {
    expect(cacCents(5000, 0)).toBeNull();
    expect(cacCents(0, 3)).toBe(0);
    expect(cacCents(5000, 4)).toBe(1250);
  });
  it("monthly churn scales the period to a month", () => {
    expect(monthlyChurnRate(2, 20, 30.4375)).toBeCloseTo(0.1, 8);
    expect(monthlyChurnRate(2, 20, 60.875)).toBeCloseTo(0.05, 8);
    expect(monthlyChurnRate(1, 0, 30)).toBeNull();
  });
  it("LTV = ARPU x margin / monthly churn", () => {
    // ARPU $29, margin 80%, churn 10%/month -> $232
    expect(ltvCents({ arpuCents: 2900, grossMarginPct: 80, churnedCustomers: 2, payingAtStart: 20, days: 30.4375 })).toBe(23200);
  });
  it("LTV is null when churn is zero, data is thin, or margin unknown", () => {
    const base = { arpuCents: 2900, grossMarginPct: 80, churnedCustomers: 2, payingAtStart: 20, days: 30 };
    expect(ltvCents({ ...base, churnedCustomers: 0 })).toBeNull();
    expect(ltvCents({ ...base, payingAtStart: 9 })).toBeNull();
    expect(ltvCents({ ...base, days: 27 })).toBeNull();
    expect(ltvCents({ ...base, grossMarginPct: null })).toBeNull();
    expect(ltvCents({ ...base, grossMarginPct: -5 })).toBeNull();
    expect(ltvCents({ ...base, arpuCents: 0 })).toBeNull();
  });
  it("payback months", () => {
    expect(paybackMonths(4640, 2900, 80)).toBe(2);
    expect(paybackMonths(null, 2900, 80)).toBeNull();
    expect(paybackMonths(4640, 0, 80)).toBeNull();
    expect(paybackMonths(4640, 2900, null)).toBeNull();
    expect(paybackMonths(4640, 2900, 0)).toBeNull();
  });
});

describe("funnel", () => {
  it("rates come from the previous stage", () => {
    const f = buildFunnel([{ stage: "visits", count: 1000 }, { stage: "signups", count: 50 }, { stage: "first_quote", count: 20 }, { stage: "paying", count: 0 }]);
    expect(f.map((s) => s.rateFromPrevious)).toEqual([null, 0.05, 0.4, 0]);
  });
  it("is null after an empty stage instead of dividing by zero", () => {
    const f = buildFunnel([{ stage: "a", count: 0 }, { stage: "b", count: 3 }, { stage: "c", count: 0 }, { stage: "d", count: 0 }]);
    expect(f.map((s) => s.rateFromPrevious)).toEqual([null, null, 0, null]);
  });
});

describe("sources", () => {
  it("CAC per channel from its own spend and its own paying customers", () => {
    const rows = buildSources([
      { source: "facebook", signups: 40, paying: 4, revenueCents: 11600, spendCents: 20000 },
      { source: "google", signups: 100, paying: 0, revenueCents: 0, spendCents: 9000 },
      { source: "direct", signups: 10, paying: 2, revenueCents: 3800, spendCents: 0 },
    ]);
    expect(rows.map((r) => [r.source, r.cacCents])).toEqual([["google", null], ["facebook", 5000], ["direct", 0]]);
  });
});
