import { describe, expect, it } from "vitest";
import { latestPrice, priceHistory, priceSeries, reservedOf, sameItem, stockLevel, suggestedQty, totalOf, vendorMatches } from "./suppliers.js";

const r = (iso: string, description: string, unitPrice: number | null) => ({ at: new Date(iso), lines: [{ description, unitPrice }] });

describe("supplier receipts", () => {
  it("matches a vendor to a supplier by name", () => {
    expect(vendorMatches("Home Depot #7011", "Home Depot Pro")).toBe(true);
    expect(vendorMatches("HOME DEPOT", "Home Depot")).toBe(true);
    expect(vendorMatches("Canadian Tire", "Home Depot Pro")).toBe(false);
    expect(vendorMatches("", "Lumber Plus")).toBe(false);
    expect(vendorMatches("Lumber", "Lumber Plus")).toBe(true);
    expect(vendorMatches("Pro", "Home Depot Pro")).toBe(false);
  });
  it("calls the same item by different spellings the same", () => {
    expect(sameItem('Drywall 1/2" 4×8', "drywall 1/2 4x8")).toBe(true);
    expect(sameItem("Joint compound 17 L", "Painter tape")).toBe(false);
  });
  it("builds the price history: moved items first, the steady ones after, only the window", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const series = priceSeries([
      r("2026-04-02", "Drywall 4x8", 18.4), r("2026-06-02", "Drywall 4x8", 19.25), r("2026-09-15", "Drywall 4x8", 19.95),
      r("2026-04-02", "Screws 5 lb", 38.97), r("2026-08-02", "Screws 5 lb", 38.97),
      r("2026-09-02", "Studs", 5.49), r("2026-01-02", "Old thing", 1), r("2026-01-20", "Old thing", 2),
      r("2026-09-02", "No price", null),
    ]);
    const rows = priceHistory(series, now);
    expect(rows.map((x) => x.name)).toEqual(["Drywall 4x8", "Screws 5 lb"]);
    expect(rows[0]).toMatchObject({ from: 18.4, to: 19.95, when: "2026-09-15", points: [18.4, 19.25, 19.95] });
    expect(Math.round(rows[0]!.changePct)).toBe(8);
    expect(rows[1]!.when).toBeNull();
  });
  it("keeps one price a day and finds the newest and the one before", () => {
    const s = priceSeries([r("2026-09-01T08:00:00Z", "Tape", 8), r("2026-09-01T16:00:00Z", "Tape", 8.2), r("2026-09-20", "Tape", 8.49)]);
    expect(s[0]!.points).toHaveLength(2);
    expect(latestPrice(s, "tape")).toEqual({ price: 8.49, before: 8.2, at: "2026-09-20" });
    expect(latestPrice(s, "something else")).toBeNull();
  });
});

describe("stock", () => {
  const base = { shopQty: 8, truckQty: 0, sites: [], reserved: [], par: 30 };
  it("adds up the places and what is set aside", () => {
    const s = { ...base, truckQty: 2, sites: [{ name: "Hart", qty: 3 }], reserved: [{ qty: 4, job: "A" }, { qty: 1, job: "B" }] };
    expect(totalOf(s)).toBe(13);
    expect(reservedOf(s)).toBe(5);
  });
  it("tells low from short from fine", () => {
    expect(stockLevel(base)).toBe("low");
    expect(stockLevel({ ...base, par: 5 })).toBe("ok");
    expect(stockLevel({ ...base, reserved: [{ qty: 24, job: "Hart" }] })).toBe("short");
    expect(stockLevel({ ...base, par: 8 })).toBe("ok");
  });
  it("suggests an order up to twice the reorder level", () => {
    expect(suggestedQty(base)).toBe(52);
    expect(suggestedQty({ ...base, par: 3, shopQty: 5 })).toBe(1);
  });
});
