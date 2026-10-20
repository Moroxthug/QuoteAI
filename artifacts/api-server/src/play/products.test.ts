import { describe, expect, it } from "vitest";
import { catalogProducts, listPriceCents, monthlyCentsOf, planFromPlay, playPackageName } from "./products";

describe("Play product mapping", () => {
  it("maps every product and base plan to tier, interval and founding", () => {
    expect(planFromPlay("quoteai_starter", "monthly")).toEqual({ tier: "monthly_starter", interval: "month", founding: false });
    expect(planFromPlay("quoteai_starter", "yearly")).toEqual({ tier: "monthly_starter", interval: "year", founding: false });
    expect(planFromPlay("quoteai_starter", "launch")).toEqual({ tier: "monthly_starter", interval: "month", founding: true });
    expect(planFromPlay("quoteai_pro", "monthly")).toEqual({ tier: "monthly_pro", interval: "month", founding: false });
    expect(planFromPlay("quoteai_pro", "yearly")).toEqual({ tier: "monthly_pro", interval: "year", founding: false });
    expect(planFromPlay("quoteai_business", "yearly")).toEqual({ tier: "monthly_business", interval: "year", founding: false });
  });
  it("refuses what is not ours", () => {
    expect(planFromPlay("quoteai_pro", "launch")).toBeNull();
    expect(planFromPlay("quoteai_business", "launch")).toBeNull();
    expect(planFromPlay("other_app", "monthly")).toBeNull();
    expect(planFromPlay("quoteai_starter", "weekly")).toBeNull();
    expect(planFromPlay("toString", "monthly")).toBeNull();
    expect(planFromPlay("quoteai_starter", "constructor")).toBeNull();
    expect(planFromPlay(null, "monthly")).toBeNull();
    expect(planFromPlay("quoteai_starter", undefined)).toBeNull();
  });
  it("lists launch only while the offer is active", () => {
    expect(catalogProducts(false)).toHaveLength(6);
    expect(catalogProducts(false).some((p) => p.basePlanId === "launch")).toBe(false);
    const on = catalogProducts(true);
    expect(on).toHaveLength(7);
    expect(on.filter((p) => p.basePlanId === "launch")).toEqual([{ productId: "quoteai_starter", basePlanId: "launch", tier: "monthly_starter", interval: "month", founding: true }]);
  });
  it("prices: list, founding, yearly is ten months, MRR counts a twelfth", () => {
    expect(listPriceCents({ tier: "monthly_starter", interval: "month", founding: false })).toBe(2900);
    expect(listPriceCents({ tier: "monthly_starter", interval: "month", founding: true })).toBe(1900);
    expect(listPriceCents({ tier: "monthly_pro", interval: "year", founding: false })).toBe(79000);
    expect(monthlyCentsOf({ tier: "monthly_pro", interval: "year", founding: false }, 79000)).toBe(6583);
    expect(monthlyCentsOf({ tier: "monthly_pro", interval: "month", founding: false }, 7900)).toBe(7900);
  });
  it("package name defaults to ca.quoteai.app", () => {
    expect(playPackageName({})).toBe("ca.quoteai.app");
    expect(playPackageName({ GOOGLE_PLAY_PACKAGE_NAME: " ca.example " })).toBe("ca.example");
  });
});
