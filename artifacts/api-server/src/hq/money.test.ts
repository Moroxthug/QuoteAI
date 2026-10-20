import { describe, expect, it } from "vitest";
import { PLAY_REVENUE_NOTE, estimatedRevenueExact, listMonthlyCents, moneyTotals, mrrAt, mrrMovements, mrrStateAt, profitCents, runwayMonths, type SubEvent } from "./money";

const at = (s: string) => new Date(`${s}T12:00:00Z`);
const ev = (key: string, type: SubEvent["type"], amountCents: number, day: string): SubEvent => ({ key, type, amountCents, at: at(day) });

describe("Google Play in the books (Phase 135)", () => {
  it("the HQ says Play revenue is gross and the 15% is an estimate", () => {
    expect(PLAY_REVENUE_NOTE).toBe("Google Play revenue is gross; Google keeps about 15% (estimated, not measured).");
  });
  it("a Play subscription event counts in MRR like a Stripe one", () => {
    const m = mrrMovements([ev("play-user", "subscription_started", 7900, "2026-10-05")], at("2026-10-01"), at("2026-10-31"));
    expect(m).toMatchObject({ newCents: 7900, newCustomers: 1 });
  });
});

describe("MRR movements", () => {
  const events: SubEvent[] = [
    ev("a", "subscription_started", 1900, "2026-09-10"), // before the range
    ev("b", "subscription_started", 7900, "2026-10-02"), // new
    ev("a", "subscription_changed", 7900, "2026-10-05"), // expansion +6000
    ev("c", "subscription_started", 2900, "2026-09-20"),
    ev("c", "subscription_canceled", 2900, "2026-10-09"), // churn
    ev("b", "subscription_changed", 2900, "2026-10-12"), // contraction 5000
    ev("b", "subscription_changed", 2900, "2026-10-13"), // same amount: nothing
    ev("d", "subscription_started", 1900, "2026-11-02"), // after the range
  ];
  const from = at("2026-10-01");
  const to = at("2026-10-31");

  it("splits new, expansion, contraction and churn", () => {
    expect(mrrMovements(events, from, to)).toEqual({ newCents: 7900, expansionCents: 6000, contractionCents: 5000, churnedCents: 2900, newCustomers: 1, churnedCustomers: 1 });
  });
  it("a yearly plan arrives already as a twelfth", () => {
    const m = mrrMovements([ev("y", "subscription_started", Math.round(19000 / 12), "2026-10-03")], from, to);
    expect(m.newCents).toBe(1583);
  });
  it("a cancellation with no known start still counts as churn using its own amount", () => {
    const m = mrrMovements([ev("z", "subscription_canceled", 2900, "2026-10-04")], from, to);
    expect(m.churnedCents).toBe(2900);
    expect(m.churnedCustomers).toBe(1);
  });
  it("re-subscribing after a cancellation is new again", () => {
    const m = mrrMovements([ev("r", "subscription_started", 1900, "2026-08-01"), ev("r", "subscription_canceled", 1900, "2026-09-01"), ev("r", "subscription_started", 1900, "2026-10-05")], from, to);
    expect(m.newCents).toBe(1900);
    expect(m.churnedCents).toBe(0);
  });
  it("is empty with no events", () => {
    expect(mrrMovements([], from, to)).toEqual({ newCents: 0, expansionCents: 0, contractionCents: 0, churnedCents: 0, newCustomers: 0, churnedCustomers: 0 });
  });
  it("MRR state at a moment", () => {
    expect(mrrAt(events, at("2026-10-01"))).toBe(1900 + 2900);
    expect(mrrAt(events, at("2026-10-31"))).toBe(7900 + 2900); // a upgraded to 7900; b downgraded to 2900; c gone
    expect(mrrStateAt(events, at("2026-10-31")).get("c")).toBe(0);
    expect(mrrAt([], at("2026-10-31"))).toBe(0);
  });
});

describe("money totals and profit", () => {
  it("keeps tax out of revenue", () => {
    const t = moneyTotals([
      { type: "payment", amountCents: 2147, taxCents: 247, feeCents: 92 }, // $19 + 13% HST
      { type: "payment", amountCents: 3277, taxCents: 377, feeCents: 125 },
      { type: "refund", amountCents: 1000, taxCents: 0, feeCents: 0 },
      { type: "dispute", amountCents: 3277, taxCents: 0, feeCents: 1500 },
    ]);
    expect(t).toEqual({ grossCents: 5424, revenueCents: 1900 + 2900, taxCollectedCents: 624, refundsCents: 1000, disputesCents: 3277, feesCents: 1717 });
  });
  it("profit = revenue - refunds - fees - costs - marketing", () => {
    expect(profitCents({ revenueCents: 10000, refundsCents: 500, feesCents: 300, costsCents: 2000, marketingSpendCents: 1500 })).toBe(5700);
    expect(profitCents({ revenueCents: 0, refundsCents: 0, feesCents: 0, costsCents: 4000, marketingSpendCents: 0 })).toBe(-4000);
  });
  it("runway: null when cash unknown or not burning", () => {
    expect(runwayMonths(null, -100000, 30)).toBeNull();
    expect(runwayMonths(500000, 100, 30)).toBeNull();
    expect(runwayMonths(500000, 0, 30)).toBeNull();
  });
  it("runway: cash over the monthly burn, scaled from the range length", () => {
    expect(runwayMonths(500000, -100000, 30.4375)).toBe(5);
    expect(runwayMonths(500000, -50000, 15.21875)).toBe(5);
    expect(runwayMonths(0, -100, 30)).toBe(0);
  });
  it("estimated revenue prorates list price from the signup day", () => {
    const list = [{ monthlyCents: 2900, sinceYmd: "2026-01-01" }, { monthlyCents: 7900, sinceYmd: "2026-10-16" }, { monthlyCents: 1900, sinceYmd: "2026-11-01" }];
    // Oct 1-30 is 30 days; the second customer only has Oct 16-30 (15 days); the third is not a customer yet
    expect(estimatedRevenueExact(list, "2026-10-01", "2026-10-30")).toBeCloseTo((2900 * 30) / 30.4375 + (7900 * 15) / 30.4375, 6);
    expect(estimatedRevenueExact([], "2026-10-01", "2026-10-30")).toBe(0);
  });
  it("list price per month", () => {
    expect(listMonthlyCents(29, "month")).toBe(2900);
    expect(listMonthlyCents(79, null)).toBe(7900);
    expect(listMonthlyCents(29, "year", 290)).toBe(2417);
    expect(listMonthlyCents(null, "month")).toBe(0);
  });
});
