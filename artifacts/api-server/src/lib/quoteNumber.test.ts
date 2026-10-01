import { describe, expect, it } from "vitest";
import { nextQuoteNumber } from "./quoteNumber.js";

describe("nextQuoteNumber", () => {
  it("starts at 001", () => expect(nextQuoteNumber([], 2026)).toBe("Q-2026-001"));
  it("counts on from the highest, ignoring old-style numbers and other years", () => {
    expect(nextQuoteNumber(["No. 40.2026 - 2026-01-05", "Q-2026-007", "Q-2025-099", null, "Q-2026-003"], 2026)).toBe("Q-2026-008");
  });
  it("grows past three digits", () => expect(nextQuoteNumber(["Q-2026-999"], 2026)).toBe("Q-2026-1000"));
});
