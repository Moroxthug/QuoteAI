import { describe, expect, test } from "vitest";
import { nameKey, taxSetKey } from "./keys.js";

describe("nameKey", () => {
  test("case, spacing, punctuation and accents do not make a second vendor", () => {
    expect(nameKey("  ACME Plumbing Inc. ")).toBe("acme plumbing inc");
    expect(nameKey("acme   plumbing, inc")).toBe("acme plumbing inc");
    expect(nameKey("Rénovations Côté")).toBe(nameKey("Renovations Cote"));
  });
  test("different names stay different", () => {
    expect(nameKey("Home Depot")).not.toBe(nameKey("Home Hardware"));
  });
});

describe("taxSetKey", () => {
  test("one key per tax combination, rates included", () => {
    expect(taxSetKey([{ code: "HST", rate: 13 }])).toBe("HST 13%");
    expect(taxSetKey([{ code: "HST", rate: 15 }])).toBe("HST 15%");
    expect(taxSetKey([{ code: "GST", rate: 5 }, { code: "QST", rate: 9.975 }])).toBe("GST 5% + QST 9.975%");
    expect(taxSetKey([{ code: "GST", rate: 5 }, { code: "PST", rate: 7 }])).toBe("GST 5% + PST 7%");
  });
  test("no tax (or zero-rated lines) is 'none'", () => {
    expect(taxSetKey([])).toBe("none");
    expect(taxSetKey([{ code: "GST", rate: 0 }])).toBe("none");
  });
});
