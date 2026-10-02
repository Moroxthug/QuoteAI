import { describe, expect, it } from "vitest";
import { correctionMessage, floorAreaOf, isWholeBuilding, quoteProblems } from "./quoteSanity.js";

const USER = "Can you create a quote for a house renovation, house is 342 sqm surface over 3 floors plus basement. Works to do are flooring, walls, plumbing and electrical from scratch, roofing, ceiling, painting, demolition of course and final clean up. Also remember, this is a work for 4 floors, each with 342 sqm surface!";

describe("floorAreaOf", () => {
  it("multiplies by floors when the area is per floor", () => {
    const a = floorAreaOf(USER)!;
    expect(a.areaSqm).toBe(342);
    expect(a.floors).toBeGreaterThanOrEqual(4);
    expect(a.perFloor).toBe(true);
    expect(a.totalSqm).toBe(342 * a.floors);
  });
  it("reads square feet and keeps one floor when nothing says otherwise", () => {
    const a = floorAreaOf("repaint 1,500 sq ft")!;
    expect(Math.round(a.areaSqm)).toBe(139);
    expect(a.floors).toBe(1);
  });
  it("is null with no area", () => expect(floorAreaOf("fix a leaking tap")).toBeNull());
});

describe("quoteProblems", () => {
  const bad = [{ titolo: "Painting", subtotale: 81_070 }, { titolo: "Demolition", subtotale: 17_100 }, { titolo: "Electrical System", subtotale: 22_000 }, { titolo: "Cleanup", subtotale: 5_000 }, { titolo: "Flooring", subtotale: 1_710 }];
  it("flags painting as a third of a house and a total far under the per-metre range", () => {
    expect(isWholeBuilding(USER)).toBe(true);
    const p = quoteProblems(USER, bad, 126_880);
    expect(p.some((x) => /Painting/.test(x))).toBe(true);
    expect(p.some((x) => /per square metre/.test(x))).toBe(true);
    expect(correctionMessage(p, USER)).toMatch(/Rebuild the whole quote/);
  });
  it("accepts a plausible renovation", () => {
    const ok = [{ titolo: "Demolition", subtotale: 100_000 }, { titolo: "Electrical", subtotale: 300_000 }, { titolo: "Painting", subtotale: 150_000 }, { titolo: "Structure and finishes", subtotale: 3_000_000 }, { titolo: "Cleanup", subtotale: 50_000 }];
    expect(quoteProblems(USER, ok, 3_600_000)).toEqual([]);
  });
  it("leaves a small job alone", () => {
    expect(quoteProblems("paint two bedrooms, 30 sqm", [{ titolo: "Painting", subtotale: 1200 }], 1200)).toEqual([]);
  });
});
