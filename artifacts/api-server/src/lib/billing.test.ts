import { afterEach, describe, expect, it, vi } from "vitest";
import { annualBillingAvailable, applicationFeeCents, connectFeeBps, connectFeePercentLabel, isPilotPromoCode, pilotPromoCode, planForPrice, planPriceIdFor, resolvePrice, yearlyPriceFor, yearlyPriceIdFor } from "./billing.js";

afterEach(() => vi.unstubAllEnvs());

function stubYearly(ids: Partial<Record<"STARTER" | "PRO" | "BUSINESS", string>>) {
  for (const k of ["STARTER", "PRO", "BUSINESS"] as const) vi.stubEnv(`STRIPE_PRICE_YEARLY_${k}`, ids[k] ?? "");
}
function stubMonthly(ids: Partial<Record<"STARTER" | "PRO" | "BUSINESS", string>>) {
  for (const k of ["STARTER", "PRO", "BUSINESS"] as const) vi.stubEnv(`STRIPE_PRICE_${k}`, ids[k] ?? "");
}

describe("annual billing config", () => {
  it("is unavailable until all three self-serve yearly price ids are set (Elite is custom)", () => {
    stubYearly({});
    expect(annualBillingAvailable()).toBe(false);
    stubYearly({ STARTER: "a", PRO: "b" });
    expect(annualBillingAvailable()).toBe(false);
    stubYearly({ STARTER: "a", PRO: "b", BUSINESS: "c" });
    expect(annualBillingAvailable()).toBe(true);
    expect(yearlyPriceIdFor("monthly_elite")).toBeNull();
  });

  it("charges 10 months for a year", () => {
    expect(yearlyPriceFor(29)).toBe(290);
    expect(yearlyPriceFor(249)).toBe(2490);
  });

  it("resolves monthly and yearly price ids back to a tier + interval", () => {
    stubMonthly({ PRO: "price_m_pro", BUSINESS: "price_m_biz" });
    stubYearly({ PRO: "price_y_pro" });
    expect(resolvePrice("price_m_pro")).toEqual({ tier: "monthly_pro", interval: "month" });
    expect(resolvePrice({ id: "price_m_biz" })).toEqual({ tier: "monthly_business", interval: "month" });
    expect(resolvePrice("price_y_pro")).toEqual({ tier: "monthly_pro", interval: "year" });
    expect(resolvePrice("price_unknown")).toBeNull();
    expect(resolvePrice(undefined)).toBeNull();
  });

  it("a custom price made for one Elite customer resolves through its quoteai_plan metadata", () => {
    stubMonthly({});
    expect(resolvePrice({ id: "price_custom_acme", metadata: { quoteai_plan: "monthly_elite" }, recurring: { interval: "year" } })).toEqual({ tier: "monthly_elite", interval: "year" });
    expect(resolvePrice({ id: "price_custom_x", metadata: { quoteai_plan: "not_a_plan" } })).toBeNull();
    expect(planForPrice({ id: "price_custom_acme", metadata: { quoteai_plan: "monthly_elite" } })).toBe("monthly_elite");
  });

  it("one-off quote prices map back for the admin tools, and an unconfigured plan has no price", () => {
    vi.stubEnv("STRIPE_PRICE_ONESHOT_CLEAN", "price_one_clean");
    vi.stubEnv("STRIPE_PRICE_STARTER", "");
    expect(planForPrice("price_one_clean")).toBe("oneshot_clean");
    expect(planPriceIdFor("monthly_starter")).toBeNull();
    expect(planPriceIdFor("monthly_elite")).toBeNull();
  });
});

describe("pilot promo code (Phase 81)", () => {
  it("is absent until PILOT_PROMO_CODE is set, and blank counts as absent", () => {
    vi.stubEnv("PILOT_PROMO_CODE", "");
    expect(pilotPromoCode()).toBeNull();
    vi.stubEnv("PILOT_PROMO_CODE", "   ");
    expect(pilotPromoCode()).toBeNull();
    vi.stubEnv("PILOT_PROMO_CODE", " PILOT2026 ");
    expect(pilotPromoCode()).toBe("PILOT2026");
  });

  it("only ever matches the configured code, ignoring case and surrounding space", () => {
    vi.stubEnv("PILOT_PROMO_CODE", "PILOT2026");
    expect(isPilotPromoCode("PILOT2026")).toBe(true);
    expect(isPilotPromoCode(" pilot2026 ")).toBe(true);
    expect(isPilotPromoCode("SOMETHINGELSE")).toBe(false);
    expect(isPilotPromoCode("")).toBe(false);
    expect(isPilotPromoCode(undefined)).toBe(false);
    expect(isPilotPromoCode(42)).toBe(false);
  });

  it("matches nothing at all when no pilot code is configured", () => {
    vi.stubEnv("PILOT_PROMO_CODE", "");
    expect(isPilotPromoCode("PILOT2026")).toBe(false);
    expect(isPilotPromoCode("")).toBe(false);
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
