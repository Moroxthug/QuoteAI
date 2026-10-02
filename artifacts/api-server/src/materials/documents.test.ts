import { describe, expect, it } from "vitest";
import { priceSeries } from "./suppliers.js";
import { almostReady, changedIn, docState, readOf, storePrices, topMover } from "./documents.js";

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);
const rc = (iso: string, ...lines: [string, number | null][]) => ({ at: d(iso), lines: lines.map(([description, unitPrice]) => ({ description, unitPrice })) });
const now = d("2026-09-30");

describe("documents", () => {
  it("finds the item that moved most", () => {
    const s = priceSeries([rc("2026-06-01", ["Drywall 1/2 4x8", 18.4], ["Stud 2x4x8", 5.6]), rc("2026-09-01", ["Drywall 1/2 4x8", 19.95], ["Stud 2x4x8", 5.5])]);
    expect(topMover(s, now)?.name).toBe("Drywall 1/2 4x8");
    expect(topMover(priceSeries([rc("2026-06-01", ["Stud", 5])]), now)).toBeNull();
  });
  it("lists the newest price at each store, newest sale first", () => {
    const costs = [
      { vendor: "Home Depot #7011", date: d("2026-09-26"), lines: rc("", ["Drywall 1/2 4x8", 19.95]).lines },
      { vendor: "Gypsum Supply", date: d("2026-09-24"), lines: rc("", ["drywall 1/2 4×8", 19.1]).lines },
      { vendor: "Home Depot", date: d("2026-08-01"), lines: rc("", ["Drywall 1/2 4x8", 18.4]).lines },
    ];
    expect(storePrices(costs, "Drywall 1/2 4x8")).toEqual([
      { name: "Home Depot #7011", at: "2026-09-26", price: 19.95 },
      { name: "Gypsum Supply", at: "2026-09-24", price: 19.1 },
    ]);
  });
  it("finds the item with two of three prices", () => {
    const s = priceSeries([rc("2026-08-01", ["Insulation R14 bag", 71.5], ["Joint compound", 23]), rc("2026-09-01", ["Insulation R14 bag", 73.2], ["Joint compound", 24]), rc("2026-09-10", ["Joint compound", 24.5])]);
    expect(almostReady(s)?.name).toBe("Insulation R14 bag");
    expect(almostReady(priceSeries([rc("2026-08-01", ["Only once", 5])]))).toBeNull();
  });
  it("reads a receipt and an old quote", () => {
    expect(readOf({ vendor: "Kent", lines: [{ description: "Bag", unitPrice: 5 }, { description: "Smudge", unitPrice: null }] })).toEqual({ vendor: "Kent", prices: 1, unread: 1, names: ["Bag"] });
    expect(readOf({ fornitore: "Acme", lavorazioni: [{ tipo: "Painting", prezzoUnitario: 8 }] })).toEqual({ vendor: "Acme", prices: 1, unread: 0, names: ["Painting"] });
    expect(readOf(null).prices).toBe(0);
  });
  it("names the state of a document", () => {
    expect(docState("processing", 0)).toBe("reading");
    expect(docState("error", 0)).toBe("check");
    expect(docState("done", 2)).toBe("check");
    expect(docState("done", 0)).toBe("read");
  });
  it("counts items that moved", () => {
    expect(changedIn(["Drywall 1/2 4x8", "Tape"], ["drywall 1/2 4×8"])).toBe(1);
  });
});
