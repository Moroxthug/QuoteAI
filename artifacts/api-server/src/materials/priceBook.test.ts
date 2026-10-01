import { describe, expect, it } from "vitest";
import { itemKey, kindOf, monthUse, priceChange, usageOf } from "./priceBook.js";

const q = (iso: string, ...lines: string[]) => ({ createdAt: new Date(iso), capitoli: [{ titolo: "A", voci: lines.map((descrizione) => ({ descrizione, um: "each", quantita: 1, prezzoUnitario: 1 })) }] as never });

describe("price book", () => {
  it("keeps a stored kind and guesses the rest from the unit", () => {
    expect(kindOf("assembly", "each")).toBe("assembly");
    expect(kindOf(null, "Each")).toBe("material");
    expect(kindOf(null, "hours")).toBe("labour");
    expect(kindOf(undefined, "sqft")).toBe("labour");
  });
  it("matches descriptions without caring about case or spacing", () => {
    expect(itemKey("  Paint  walls ")).toBe("paint walls");
  });
  it("finds the newest quote that used an item and counts this month's lines", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    const quotes = [q("2026-09-24T10:00:00Z", "Paint walls"), q("2026-10-01T09:00:00Z", "paint  walls", "Trim"), q("2026-10-01T08:00:00Z", "Other")];
    const u = usageOf(quotes, now);
    expect(u.get("paint walls")).toEqual({ lastUsedAt: "2026-10-01T09:00:00.000Z", usesThisMonth: 1 });
    expect(u.get("trim")?.usesThisMonth).toBe(1);
    expect(monthUse(quotes, new Set(["paint walls", "trim"]), now)).toEqual({ lines: 2, quotes: 1 });
  });
  it("records a price change only when the price moved", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    expect(priceChange(3.1, 3.4, now)).toEqual({ previousPrice: 3.1, priceChangedAt: now });
    expect(priceChange(3.4, 3.4, now)).toBeNull();
  });
});
