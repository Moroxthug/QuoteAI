import { afterEach, describe, expect, it, vi } from "vitest";
import { annualBillingAvailable, applicationFeeCents, connectFeeBps, connectFeePercentLabel, resolvePrice, yearlyPriceFor } from "./billing.js";

const MONTHLY = { price_m_starter: "monthly_starter", price_m_pro: "monthly_pro", price_m_elite: "monthly_elite" };

afterEach(() => vi.unstubAllEnvs());

function stubYearly(ids: Partial<Record<"STARTER" | "PRO" | "ELITE", string>>) {
  for (const k of ["STARTER", "PRO", "ELITE"] as const) vi.stubEnv(`STRIPE_PRICE_YEARLY_${k}`, ids[k] ?? "");
}

describe("annual billing config", () => {
  it("is unavailable until all three yearly price ids are set", () => {
    stubYearly({});
    expect(annualBillingAvailable()).toBe(false);
    stubYearly({ STARTER: "a", PRO: "b" });
    expect(annualBillingAvailable()).toBe(false);
    stubYearly({ STARTER: "a", PRO: "b", ELITE: "c" });
    expect(annualBillingAvailable()).toBe(true);
  });

  it("charges 10 months for a year", () => {
    expect(yearlyPriceFor(19)).toBe(190);
    expect(yearlyPriceFor(59)).toBe(590);
  });

  it("resolves monthly and yearly price ids back to a tier + interval", () => {
    stubYearly({ PRO: "price_y_pro" });
    expect(resolvePrice("price_m_pro", MONTHLY)).toEqual({ tier: "monthly_pro", interval: "month" });
    expect(resolvePrice("price_y_pro", MONTHLY)).toEqual({ tier: "monthly_pro", interval: "year" });
    expect(resolvePrice("price_unknown", MONTHLY)).toBeNull();
    expect(resolvePrice(undefined, MONTHLY)).toBeNull();
  });
});

describe("Connect application fee", () => {
  it("defaults to 0.5 % and clamps nonsense", () => {
    vi.stubEnv("STRIPE_CONNECT_FEE_BPS", "");
    expect(connectFeeBps()).toBe(50);
    vi.stubEnv("STRIPE_CONNECT_FEE_BPS", "75");
    expect(connectFeeBps()).toBe(75);
    vi.stubEnv("STRIPE_CONNECT_FEE_BPS", "abc");
    expect(connectFeeBps()).toBe(50);
    vi.stubEnv("STRIPE_CONNECT_FEE_BPS", "-5");
    expect(connectFeeBps()).toBe(50);
    vi.stubEnv("STRIPE_CONNECT_FEE_BPS", "99999");
    expect(connectFeeBps()).toBe(500);
    vi.stubEnv("STRIPE_CONNECT_FEE_BPS", "0");
    expect(connectFeeBps()).toBe(0);
  });

  it("rounds half-up in cents and never exceeds the charge", () => {
    expect(applicationFeeCents(100_000, 50)).toBe(500); // $1,000 → $5.00
    expect(applicationFeeCents(12_345, 50)).toBe(62); // 61.725 → 62
    expect(applicationFeeCents(1, 50)).toBe(0);
    expect(applicationFeeCents(1, 10_000)).toBe(1);
    expect(applicationFeeCents(5_000, 0)).toBe(0);
    expect(applicationFeeCents(-5, 50)).toBe(0);
  });

  it("labels the percentage tidily", () => {
    expect(connectFeePercentLabel(50)).toBe("0.5");
    expect(connectFeePercentLabel(100)).toBe("1");
    expect(connectFeePercentLabel(125)).toBe("1.25");
  });
});
